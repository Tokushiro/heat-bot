import { Request, Response } from 'express';
import { EnvironmentAPIFactory } from '../../api/factories/EnvironmentAPIFactory';

/**
 * Environment Controller
 *
 * REST API controller for environmental monitoring (temperature, humidity).
 * Provides endpoints for reading ambient conditions during tests.
 */

/**
 * Initialize the environment sensor
 * POST /api/environment/initialize
 */
export async function initialize(req: Request, res: Response) {
    try {
        console.log('[EnvironmentController] Initialize request received');

        const environment = EnvironmentAPIFactory.getEnvironmentAPI();
        await environment.initialize();

        const status = environment.getStatus();

        return res.status(200).json({
            message: 'Environment sensor initialized successfully',
            status
        });
    } catch (error) {
        console.error('[EnvironmentController] Initialize error:', error);
        return res.status(500).json({
            error: 'Failed to initialize environment sensor',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Get current temperature
 * GET /api/environment/temperature
 */
export async function getTemperature(req: Request, res: Response) {
    try {
        const environment = EnvironmentAPIFactory.getEnvironmentAPI();
        const temperature = environment.getTemperature();

        return res.status(200).json({
            temperature,
            unit: '°C',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[EnvironmentController] Get temperature error:', error);
        return res.status(500).json({
            error: 'Failed to get temperature',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Get current humidity
 * GET /api/environment/humidity
 */
export async function getHumidity(req: Request, res: Response) {
    try {
        const environment = EnvironmentAPIFactory.getEnvironmentAPI();
        const humidity = environment.getHumidity();

        return res.status(200).json({
            humidity,
            unit: '% RH',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[EnvironmentController] Get humidity error:', error);
        return res.status(500).json({
            error: 'Failed to get humidity',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Get complete environmental reading
 * GET /api/environment/reading
 */
export async function getReading(req: Request, res: Response) {
    try {
        const environment = EnvironmentAPIFactory.getEnvironmentAPI();
        const reading = environment.getReading();

        return res.status(200).json(reading);
    } catch (error) {
        console.error('[EnvironmentController] Get reading error:', error);
        return res.status(500).json({
            error: 'Failed to get environmental reading',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Get reading history
 * GET /api/environment/history
 * Query params: count (default 100)
 */
export async function getHistory(req: Request, res: Response) {
    try {
        const count = req.query.count ? parseInt(req.query.count as string, 10) : 100;

        if (isNaN(count) || count < 1 || count > 10000) {
            return res.status(400).json({ error: 'Invalid count. Must be between 1 and 10000.' });
        }

        const environment = EnvironmentAPIFactory.getEnvironmentAPI();
        const history = environment.getHistory(count);

        return res.status(200).json({
            count: history.length,
            readings: history
        });
    } catch (error) {
        console.error('[EnvironmentController] Get history error:', error);
        return res.status(500).json({
            error: 'Failed to get reading history',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Start continuous monitoring
 * POST /api/environment/start-monitoring
 * Body: { interval?: number } (milliseconds)
 */
export async function startMonitoring(req: Request, res: Response) {
    try {
        const { interval } = req.body;

        if (interval && (typeof interval !== 'number' || interval < 100 || interval > 60000)) {
            return res.status(400).json({ error: 'Invalid interval. Must be between 100 and 60000 ms.' });
        }

        console.log(`[EnvironmentController] Starting monitoring (interval: ${interval || 1000}ms)`);

        const environment = EnvironmentAPIFactory.getEnvironmentAPI();

        if (!environment.isReady()) {
            return res.status(400).json({ error: 'Environment sensor not ready. Initialize first.' });
        }

        environment.startMonitoring(interval);

        const status = environment.getStatus();

        return res.status(200).json({
            message: 'Monitoring started',
            status
        });
    } catch (error) {
        console.error('[EnvironmentController] Start monitoring error:', error);
        return res.status(500).json({
            error: 'Failed to start monitoring',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Stop continuous monitoring
 * POST /api/environment/stop-monitoring
 */
export async function stopMonitoring(req: Request, res: Response) {
    try {
        console.log('[EnvironmentController] Stopping monitoring');

        const environment = EnvironmentAPIFactory.getEnvironmentAPI();
        environment.stopMonitoring();

        const status = environment.getStatus();

        return res.status(200).json({
            message: 'Monitoring stopped',
            status
        });
    } catch (error) {
        console.error('[EnvironmentController] Stop monitoring error:', error);
        return res.status(500).json({
            error: 'Failed to stop monitoring',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Get sensor status
 * GET /api/environment/status
 */
export async function getStatus(req: Request, res: Response) {
    try {
        const environment = EnvironmentAPIFactory.getEnvironmentAPI();
        const status = environment.getStatus();

        return res.status(200).json(status);
    } catch (error) {
        console.error('[EnvironmentController] Get status error:', error);
        return res.status(500).json({
            error: 'Failed to get sensor status',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Set temperature calibration offset
 * POST /api/environment/calibrate-temperature
 * Body: { offset: number }
 */
export async function calibrateTemperature(req: Request, res: Response) {
    try {
        const { offset } = req.body;

        if (typeof offset !== 'number') {
            return res.status(400).json({ error: 'Offset must be a number' });
        }

        console.log(`[EnvironmentController] Setting temperature offset: ${offset}°C`);

        const environment = EnvironmentAPIFactory.getEnvironmentAPI();
        environment.setTemperatureOffset(offset);

        const status = environment.getStatus();

        return res.status(200).json({
            message: `Temperature offset set to ${offset}°C`,
            status
        });
    } catch (error) {
        console.error('[EnvironmentController] Calibrate temperature error:', error);
        return res.status(500).json({
            error: 'Failed to calibrate temperature',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Set humidity calibration offset
 * POST /api/environment/calibrate-humidity
 * Body: { offset: number }
 */
export async function calibrateHumidity(req: Request, res: Response) {
    try {
        const { offset } = req.body;

        if (typeof offset !== 'number') {
            return res.status(400).json({ error: 'Offset must be a number' });
        }

        console.log(`[EnvironmentController] Setting humidity offset: ${offset}% RH`);

        const environment = EnvironmentAPIFactory.getEnvironmentAPI();
        environment.setHumidityOffset(offset);

        const status = environment.getStatus();

        return res.status(200).json({
            message: `Humidity offset set to ${offset}% RH`,
            status
        });
    } catch (error) {
        console.error('[EnvironmentController] Calibrate humidity error:', error);
        return res.status(500).json({
            error: 'Failed to calibrate humidity',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Validate environmental conditions
 * GET /api/environment/validate
 */
export async function validateConditions(req: Request, res: Response) {
    try {
        const environment = EnvironmentAPIFactory.getEnvironmentAPI();
        const validation = environment.validateConditions();

        return res.status(200).json(validation);
    } catch (error) {
        console.error('[EnvironmentController] Validate conditions error:', error);
        return res.status(500).json({
            error: 'Failed to validate conditions',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Disconnect sensor
 * POST /api/environment/disconnect
 */
export async function disconnect(req: Request, res: Response) {
    try {
        console.log('[EnvironmentController] Disconnect request');

        const environment = EnvironmentAPIFactory.getEnvironmentAPI();
        await environment.disconnect();

        return res.status(200).json({
            message: 'Environment sensor disconnected successfully'
        });
    } catch (error) {
        console.error('[EnvironmentController] Disconnect error:', error);
        return res.status(500).json({
            error: 'Failed to disconnect sensor',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
