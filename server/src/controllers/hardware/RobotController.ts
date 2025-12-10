import { Request, Response } from 'express';
import { RobotAPIFactory } from '../../api/factories/RobotAPIFactory';
import { TelemetryService } from '../../services/telemetry/TelemetryService';
import { emitTelemetry } from '../../services/telemetry/TelemetryEventBus';
import { emitRobotEvent, robotEventBus } from '../../services/telemetry/RobotEventBus';

const robotAPI = RobotAPIFactory.getInstance();

/**
 * Handle manual robot movement commands
 * Supports directional movement (up, down, left, right) with start/stop actions
 */
export async function handleMoveCommand(req: Request, res: Response) {
    try {
        const { direction, action, test_id, test_step_id } = req.body;
        const commandTimestamp = new Date().toISOString();

        if (!direction || !action) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: direction, action'
            });
        }

        emitRobotEvent("manual_move_command", { direction, action, timestamp: commandTimestamp });

        // For manual control, we'll use simple step movements
        // Each direction maps to a small Cartesian movement
        const stepSize = 0.1; // 10cm steps

        if (action === 'start') {
            // Get current position
            const currentPos = await robotAPI.getCurrentPosition();

            // Calculate target position based on direction
            let targetX = currentPos.x;
            let targetY = currentPos.y;

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
                default:
                    return res.status(400).json({
                        success: false,
                        error: `Invalid direction: ${direction}`
                    });
            }

            // Move to target position
            const result = await robotAPI.moveTo(targetX, targetY);

            // Log telemetry snapshot if test context provided
            if (test_id && result.position) {
                TelemetryService.recordSample({
                    test_id,
                    test_step_id,
                    robot_position_x: result.position.x,
                    robot_position_y: result.position.y,
                    timestamp: new Date()
                }).catch(err => {
                    console.warn("[RobotController] Failed to record telemetry:", err);
                });
            }

            // Broadcast manual telemetry for UI (test_id 0 marks manual)
            if (result.position) {
                const resultTimestamp = new Date().toISOString();
                emitTelemetry({
                    test_id: 0,
                    robot_position_x: result.position.x,
                    robot_position_y: result.position.y,
                    timestamp: resultTimestamp
                });
                emitRobotEvent("manual_move_result", {
                    direction,
                    action: 'start',
                    success: result.success,
                    position: result.position,
                    duration: result.duration,
                    timestamp: resultTimestamp
                });
            } else {
                emitRobotEvent("manual_move_result", {
                    direction,
                    action: 'start',
                    success: result.success,
                    duration: result.duration,
                    timestamp: new Date().toISOString()
                });
            }

            return res.status(200).json({
                success: result.success,
                direction,
                action: 'start',
                position: result.position,
                duration: result.duration
            });

        } else if (action === 'stop') {
            // Stop movement immediately
            await robotAPI.stopMovement();

            const currentPos = await robotAPI.getCurrentPosition();

            // Log telemetry snapshot if test context provided
            if (test_id && currentPos) {
                TelemetryService.recordSample({
                    test_id,
                    test_step_id,
                    robot_position_x: currentPos.x,
                    robot_position_y: currentPos.y,
                    timestamp: new Date()
                }).catch(err => {
                    console.warn("[RobotController] Failed to record telemetry:", err);
                });
            }

            if (currentPos) {
                const stopTimestamp = new Date().toISOString();
                emitTelemetry({
                    test_id: 0,
                    robot_position_x: currentPos.x,
                    robot_position_y: currentPos.y,
                    timestamp: stopTimestamp
                });
                emitRobotEvent("manual_move_result", {
                    direction,
                    action: 'stop',
                    success: true,
                    position: currentPos,
                    timestamp: stopTimestamp
                });
            } else {
                emitRobotEvent("manual_move_result", {
                    direction,
                    action: 'stop',
                    success: true,
                    timestamp: new Date().toISOString()
                });
            }

            return res.status(200).json({
                success: true,
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
        const moving = robotAPI.isRobotMoving();

        return res.status(200).json({
            success: true,
            isMoving: moving
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
