import { Request, Response } from 'express';
import { RobotAPIFactory } from '../../api/factories/RobotAPIFactory';

const robotAPI = RobotAPIFactory.getInstance();

/**
 * Handle manual robot movement commands
 * Supports directional movement (up, down, left, right) with start/stop actions
 */
export async function handleMoveCommand(req: Request, res: Response) {
    try {
        const { direction, action } = req.body;

        if (!direction || !action) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: direction, action'
            });
        }

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
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
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
