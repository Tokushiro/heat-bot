import { Request, Response } from 'express';
import { RobotAPIFactory } from '../../api/factories/RobotAPIFactory';
import { TelemetryService } from '../../services/telemetry/TelemetryService';
import { emitTelemetry } from '../../services/telemetry/TelemetryEventBus';
import { emitRobotEvent, robotEventBus } from '../../services/telemetry/RobotEventBus';

const robotAPI = RobotAPIFactory.getInstance();

// =============================================================================
// CONTINUOUS MOVEMENT STATE
// =============================================================================

interface ContinuousMovementState {
    active: boolean;
    direction: 'up' | 'down' | 'left' | 'right' | null;
    intervalId: NodeJS.Timeout | null;
    currentTestId: number;
}

let continuousMovement: ContinuousMovementState = {
    active: false,
    direction: null,
    intervalId: null,
    currentTestId: 0
};

/**
 * Start continuous movement in a direction
 * Interval-based: sends small increments every 100ms while button is held
 */
async function startContinuousMovement(direction: string, testId: number): Promise<void> {
    // Stop any existing movement first
    if (continuousMovement.active) {
        await stopContinuousMovement();
    }

    const stepSize = 0.05; // 5cm per interval (smooth continuous movement)
    const intervalMs = 100; // Update every 100ms

    continuousMovement.active = true;
    continuousMovement.direction = direction as any;
    continuousMovement.currentTestId = testId;

    console.log(`[RobotController] Starting continuous movement: ${direction}`);

    emitRobotEvent("manual_control_started", {
        direction,
        testId,
        timestamp: new Date().toISOString()
    });

    // Interval-based movement
    continuousMovement.intervalId = setInterval(async () => {
        try {
            const currentPos = await robotAPI.getCurrentPosition();
            let targetX = currentPos.x;
            let targetY = currentPos.y;

            // Calculate target based on direction
            switch (direction) {
                case 'up':
                    targetY += stepSize;
                    break;
                case 'down':
                    targetY -= stepSize;
                    break;
                case 'left':
                    targetX -= stepSize;
                    break;
                case 'right':
                    targetX += stepSize;
                    break;
            }

            // Move to target
            await robotAPI.moveTo(targetX, targetY);

            // Emit telemetry for UI updates
            const timestamp = new Date();
            emitTelemetry({
                test_id: testId,
                robot_position_x: targetX,
                robot_position_y: targetY,
                timestamp
            });

            // Also emit robot event for manual control page
            emitRobotEvent("manual_move_result", {
                direction,
                action: 'continue',
                success: true,
                position: { x: targetX, y: targetY },
                timestamp: timestamp.toISOString()
            });

            // Log telemetry if test context provided
            if (testId > 0) {
                TelemetryService.recordSample({
                    test_id: testId,
                    robot_position_x: targetX,
                    robot_position_y: targetY,
                    timestamp
                }).catch(err => {
                    console.warn("[RobotController] Failed to record telemetry:", err);
                });
            }

        } catch (error) {
            console.error("[RobotController] Continuous movement error:", error);
            await stopContinuousMovement();
            emitRobotEvent("robot_error", {
                error: error instanceof Error ? error.message : "Unknown error",
                context: "continuous_movement",
                timestamp: new Date().toISOString()
            });
        }
    }, intervalMs);
}

/**
 * Stop continuous movement
 */
async function stopContinuousMovement(): Promise<void> {
    if (continuousMovement.intervalId) {
        clearInterval(continuousMovement.intervalId);
        continuousMovement.intervalId = null;
    }

    if (continuousMovement.active) {
        console.log(`[RobotController] Stopping continuous movement: ${continuousMovement.direction}`);

        await robotAPI.stopMovement();

        const currentPos = await robotAPI.getCurrentPosition();

        emitRobotEvent("manual_control_stopped", {
            direction: continuousMovement.direction,
            position: currentPos,
            timestamp: new Date().toISOString()
        });

        // Emit final position
        if (currentPos) {
            const timestamp = new Date();
            emitTelemetry({
                test_id: continuousMovement.currentTestId,
                robot_position_x: currentPos.x,
                robot_position_y: currentPos.y,
                timestamp
            });
        }
    }

    continuousMovement.active = false;
    continuousMovement.direction = null;
}

// =============================================================================
// HTTP ENDPOINTS
// =============================================================================

/**
 * Handle manual robot movement commands
 * Supports continuous movement (hold-to-move) with start/stop actions
 */
export async function handleMoveCommand(req: Request, res: Response) {
    try {
        const { direction, action, test_id } = req.body;
        const commandTimestamp = new Date().toISOString();

        if (!direction || !action) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: direction, action'
            });
        }

        if (!['up', 'down', 'left', 'right'].includes(direction)) {
            return res.status(400).json({
                success: false,
                error: `Invalid direction: ${direction}`
            });
        }

        emitRobotEvent("manual_move_command", { direction, action, timestamp: commandTimestamp });

        if (action === 'start') {
            // Start continuous movement
            await startContinuousMovement(direction, test_id || 0);

            return res.status(200).json({
                success: true,
                message: 'Continuous movement started',
                direction,
                action: 'start'
            });

        } else if (action === 'stop') {
            // Stop continuous movement
            await stopContinuousMovement();

            const currentPos = await robotAPI.getCurrentPosition();

            return res.status(200).json({
                success: true,
                message: 'Movement stopped',
                direction,
                action: 'stop',
                position: currentPos
            });

        } else {
            return res.status(400).json({
                success: false,
                error: `Invalid action: ${action}. Must be 'start' or 'stop'`
            });
        }

    } catch (error) {
        console.error('[RobotController] Move command error:', error);
        emitRobotEvent("robot_error", {
            error: error instanceof Error ? error.message : "Unknown error",
            context: "manual_move_command",
            timestamp: new Date().toISOString()
        });
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Mark manual control session as started (used for logging/SSE)
 */
export async function startManualControl(_req: Request, res: Response) {
    const timestamp = new Date().toISOString();
    emitRobotEvent("manual_control_started", { timestamp });
    return res.status(200).json({ success: true, message: "Manual control armed" });
}

/**
 * Mark manual control session as stopped and halt movement
 */
export async function stopManualControl(_req: Request, res: Response) {
    const timestamp = new Date().toISOString();

    try {
        // Stop any continuous movement
        await stopContinuousMovement();

        // Also stop robot
        await robotAPI.stopMovement();
    } catch (error) {
        console.warn("[RobotController] Failed to stop robot during manual stop:", error);
    }

    emitRobotEvent("manual_control_stopped", { timestamp });
    return res.status(200).json({ success: true, message: "Manual control disarmed" });
}

/**
 * Get current robot position
 */
export async function getCurrentPosition(req: Request, res: Response) {
    try {
        const position = await robotAPI.getCurrentPosition();

        return res.status(200).json({
            success: true,
            position
        });

    } catch (error) {
        console.error('[RobotController] Get position error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Stop robot movement
 */
export async function stopMovement(req: Request, res: Response) {
    try {
        // Stop continuous movement if active
        await stopContinuousMovement();

        // Also stop robot
        await robotAPI.stopMovement();

        const position = await robotAPI.getCurrentPosition();

        return res.status(200).json({
            success: true,
            message: 'Robot stopped',
            position
        });

    } catch (error) {
        console.error('[RobotController] Stop movement error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Home robot to origin (0, 0, 0)
 */
export async function homeRobot(req: Request, res: Response) {
    try {
        const result = await robotAPI.homeRobot();

        return res.status(200).json({
            success: result.success,
            message: 'Robot homed to origin',
            position: result.position,
            duration: result.duration
        });

    } catch (error) {
        console.error('[RobotController] Home robot error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Check if robot is moving
 */
export function isMoving(req: Request, res: Response) {
    try {
        const moving = robotAPI.isRobotMoving() || continuousMovement.active;

        return res.status(200).json({
            success: true,
            isMoving: moving,
            continuousMode: continuousMovement.active,
            direction: continuousMovement.direction
        });

    } catch (error) {
        console.error('[RobotController] Is moving error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * SSE stream of robot events (manual control, movement notifications, errors)
 */
export function robotEventStream(req: Request, res: Response) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const send = (event: string, data: unknown) => {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    send("connected", { timestamp: new Date().toISOString() });

    const onEvent = (payload: any) => {
        const eventType = payload?.type || "robot_event";
        send(eventType, payload);
    };

    robotEventBus.on("event", onEvent);

    req.on("close", () => {
        robotEventBus.off("event", onEvent);
        res.end();
    });
}
