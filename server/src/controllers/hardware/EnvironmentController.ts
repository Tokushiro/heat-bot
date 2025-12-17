import { Request, Response } from 'express';
import { EnvironmentAPIFactory } from '../../api/factories/EnvironmentAPIFactory';
import { TelemetryService } from '../../services/telemetry/TelemetryService';


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


export async function getTemperature(req: Request, res: Response) {
    try {
        const environment = EnvironmentAPIFactory.getEnvironmentAPI();
        const temperature = environment.getTemperature();
        const { test_id, test_step_id } = req.query;

        if (test_id) {
            TelemetryService.recordSample({
                test_id: Number(test_id),
                test_step_id: test_step_id ? Number(test_step_id) : undefined,
                ambient_temp: temperature,
                timestamp: new Date()
            }).catch(err => console.warn('[EnvironmentController] Failed to record temperature telemetry:', err));
        }

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


export async function getHumidity(req: Request, res: Response) {
    try {
        const environment = EnvironmentAPIFactory.getEnvironmentAPI();
        const humidity = environment.getHumidity();
        const { test_id, test_step_id } = req.query;

        if (test_id) {
            TelemetryService.recordSample({
                test_id: Number(test_id),
                test_step_id: test_step_id ? Number(test_step_id) : undefined,
                humidity,
                timestamp: new Date()
            }).catch(err => console.warn('[EnvironmentController] Failed to record humidity telemetry:', err));
        }

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
