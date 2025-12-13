import { Request, Response } from 'express';
import { StandAPIFactory } from '../../api/factories/StandAPIFactory';

/**
 * Stand Controller
 *
 * REST API controller for rotating stand operations.
 * Provides endpoints for manual and automated detector angle control.
 */

/**
 * Initialize the stand
 * POST /api/stand/initialize
 */
export async function initialize(req: Request, res: Response) {
    try {
        console.log('[StandController] Initialize request received');

        const stand = StandAPIFactory.getStandAPI();
        await stand.initialize();

        const status = stand.getStatus();

        return res.status(200).json({
            message: 'Stand initialized successfully',
            status
        });
    } catch (error) {
        console.error('[StandController] Initialize error:', error);
        return res.status(500).json({
            error: 'Failed to initialize stand',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Set detector angle
 * POST /api/stand/set-angle
 * Body: { angle: number }
 */
export async function setAngle(req: Request, res: Response) {
    try {
        const { angle } = req.body;

        if (typeof angle !== 'number') {
            return res.status(400).json({ error: 'Angle must be a number' });
        }

        if (angle < 0 || angle >= 360) {
            return res.status(400).json({ error: 'Angle must be between 0 and 360' });
        }

        console.log(`[StandController] Set angle request: ${angle}°`);

        const stand = StandAPIFactory.getStandAPI();

        if (!stand.isReady()) {
            return res.status(400).json({ error: 'Stand not ready. Initialize first.' });
        }

        await stand.setDetectorAngle(angle);

        const status = stand.getStatus();

        return res.status(200).json({
            message: `Detector angle set to ${angle}°`,
            status
        });
    } catch (error) {
        console.error('[StandController] Set angle error:', error);
        return res.status(500).json({
            error: 'Failed to set detector angle',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Step detector angle by delta
 * POST /api/stand/step-angle
 * Body: { delta: number }
 */
export async function stepAngle(req: Request, res: Response) {
    try {
        const { delta } = req.body;

        if (typeof delta !== 'number') {
            return res.status(400).json({ error: 'Delta must be a number' });
        }

        console.log(`[StandController] Step angle request: ${delta > 0 ? '+' : ''}${delta}°`);

        const stand = StandAPIFactory.getStandAPI();

        if (!stand.isReady()) {
            return res.status(400).json({ error: 'Stand not ready. Initialize first.' });
        }

        await stand.stepDetectorAngle(delta);

        const status = stand.getStatus();

        return res.status(200).json({
            message: `Detector angle stepped by ${delta}°`,
            status
        });
    } catch (error) {
        console.error('[StandController] Step angle error:', error);
        return res.status(500).json({
            error: 'Failed to step detector angle',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Get current angle
 * GET /api/stand/current-angle
 */
export async function getCurrentAngle(req: Request, res: Response) {
    try {
        const stand = StandAPIFactory.getStandAPI();
        const angle = stand.getCurrentAngle();

        return res.status(200).json({
            angle,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[StandController] Get current angle error:', error);
        return res.status(500).json({
            error: 'Failed to get current angle',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Calibrate zero angle
 * POST /api/stand/calibrate
 */
export async function calibrateZero(req: Request, res: Response) {
    try {
        console.log('[StandController] Calibrate zero angle request');

        const stand = StandAPIFactory.getStandAPI();

        if (!stand.isReady()) {
            return res.status(400).json({ error: 'Stand not ready. Initialize first.' });
        }

        await stand.calibrateZeroAngle();

        const status = stand.getStatus();

        return res.status(200).json({
            message: 'Zero angle calibrated successfully',
            status
        });
    } catch (error) {
        console.error('[StandController] Calibrate error:', error);
        return res.status(500).json({
            error: 'Failed to calibrate zero angle',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Get stand status
 * GET /api/stand/status
 */
export async function getStatus(req: Request, res: Response) {
    try {
        const stand = StandAPIFactory.getStandAPI();
        const status = stand.getStatus();

        return res.status(200).json(status);
    } catch (error) {
        console.error('[StandController] Get status error:', error);
        return res.status(500).json({
            error: 'Failed to get stand status',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Disconnect stand
 * POST /api/stand/disconnect
 */
export async function disconnect(req: Request, res: Response) {
    try {
        console.log('[StandController] Disconnect request');

        const stand = StandAPIFactory.getStandAPI();
        await stand.disconnect();

        return res.status(200).json({
            message: 'Stand disconnected successfully'
        });
    } catch (error) {
        console.error('[StandController] Disconnect error:', error);
        return res.status(500).json({
            error: 'Failed to disconnect stand',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
