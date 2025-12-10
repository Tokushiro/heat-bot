import { Request, Response } from 'express';
import { HeatingAPIFactory } from '../../api/factories/HeatingAPIFactory';
import { HeatingZone } from '../../api/interfaces/IHeatingAPI';

/**
 * Heating Controller
 *
 * REST API controller for thermal manikin heating system.
 * Provides endpoints for temperature control of Head, Body, and Legs zones.
 */

/**
 * Initialize the heating system
 * POST /api/heating/initialize
 */
export async function initialize(req: Request, res: Response) {
    try {
        console.log('[HeatingController] Initialize request received');

        const heating = HeatingAPIFactory.getHeatingAPI();
        await heating.initialize();

        const status = heating.getSystemStatus();

        return res.status(200).json({
            message: 'Heating system initialized successfully',
            status
        });
    } catch (error) {
        console.error('[HeatingController] Initialize error:', error);
        return res.status(500).json({
            error: 'Failed to initialize heating system',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Set target temperature for a zone
 * POST /api/heating/set-temperature
 * Body: { zone: string, temperature: number }
 */
export async function setTemperature(req: Request, res: Response) {
    try {
        const { zone, temperature } = req.body;

        if (!zone || typeof temperature !== 'number') {
            return res.status(400).json({ error: 'Zone and temperature are required' });
        }

        const validZones: HeatingZone[] = ['HEAD', 'BODY', 'LEGS'];
        if (!validZones.includes(zone as HeatingZone)) {
            return res.status(400).json({ error: 'Invalid zone. Must be HEAD, BODY, or LEGS' });
        }

        console.log(`[HeatingController] Set ${zone} temperature to ${temperature}°C`);

        const heating = HeatingAPIFactory.getHeatingAPI();

        if (!heating.isReady()) {
            return res.status(400).json({ error: 'Heating system not ready. Initialize first.' });
        }

        await heating.setTargetTemperature(zone as HeatingZone, temperature);

        const status = heating.getZoneStatus(zone as HeatingZone);

        return res.status(200).json({
            message: `${zone} temperature set to ${temperature}°C`,
            status
        });
    } catch (error) {
        console.error('[HeatingController] Set temperature error:', error);
        return res.status(500).json({
            error: 'Failed to set temperature',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Set temperature offset from ambient
 * POST /api/heating/set-offset
 * Body: { zone: string, offset: number }
 */
export async function setOffset(req: Request, res: Response) {
    try {
        const { zone, offset } = req.body;

        if (!zone || typeof offset !== 'number') {
            return res.status(400).json({ error: 'Zone and offset are required' });
        }

        const validZones: HeatingZone[] = ['HEAD', 'BODY', 'LEGS'];
        if (!validZones.includes(zone as HeatingZone)) {
            return res.status(400).json({ error: 'Invalid zone. Must be HEAD, BODY, or LEGS' });
        }

        console.log(`[HeatingController] Set ${zone} offset to +${offset}°C from ambient`);

        const heating = HeatingAPIFactory.getHeatingAPI();

        if (!heating.isReady()) {
            return res.status(400).json({ error: 'Heating system not ready. Initialize first.' });
        }

        await heating.setTemperatureOffset(zone as HeatingZone, offset);

        const status = heating.getZoneStatus(zone as HeatingZone);

        return res.status(200).json({
            message: `${zone} offset set to +${offset}°C`,
            status
        });
    } catch (error) {
        console.error('[HeatingController] Set offset error:', error);
        return res.status(500).json({
            error: 'Failed to set offset',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Enable heating for a zone
 * POST /api/heating/enable
 * Body: { zone: string }
 */
export async function enableZone(req: Request, res: Response) {
    try {
        const { zone } = req.body;

        if (!zone) {
            return res.status(400).json({ error: 'Zone is required' });
        }

        const validZones: HeatingZone[] = ['HEAD', 'BODY', 'LEGS'];
        if (!validZones.includes(zone as HeatingZone)) {
            return res.status(400).json({ error: 'Invalid zone. Must be HEAD, BODY, or LEGS' });
        }

        console.log(`[HeatingController] Enable ${zone} heating`);

        const heating = HeatingAPIFactory.getHeatingAPI();

        if (!heating.isReady()) {
            return res.status(400).json({ error: 'Heating system not ready. Initialize first.' });
        }

        await heating.enableHeating(zone as HeatingZone);

        const status = heating.getZoneStatus(zone as HeatingZone);

        return res.status(200).json({
            message: `${zone} heating enabled`,
            status
        });
    } catch (error) {
        console.error('[HeatingController] Enable zone error:', error);
        return res.status(500).json({
            error: 'Failed to enable zone',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Disable heating for a zone
 * POST /api/heating/disable
 * Body: { zone: string }
 */
export async function disableZone(req: Request, res: Response) {
    try {
        const { zone } = req.body;

        if (!zone) {
            return res.status(400).json({ error: 'Zone is required' });
        }

        const validZones: HeatingZone[] = ['HEAD', 'BODY', 'LEGS'];
        if (!validZones.includes(zone as HeatingZone)) {
            return res.status(400).json({ error: 'Invalid zone. Must be HEAD, BODY, or LEGS' });
        }

        console.log(`[HeatingController] Disable ${zone} heating`);

        const heating = HeatingAPIFactory.getHeatingAPI();

        if (!heating.isReady()) {
            return res.status(400).json({ error: 'Heating system not ready. Initialize first.' });
        }

        await heating.disableHeating(zone as HeatingZone);

        const status = heating.getZoneStatus(zone as HeatingZone);

        return res.status(200).json({
            message: `${zone} heating disabled`,
            status
        });
    } catch (error) {
        console.error('[HeatingController] Disable zone error:', error);
        return res.status(500).json({
            error: 'Failed to disable zone',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Enable all heating zones
 * POST /api/heating/enable-all
 */
export async function enableAll(req: Request, res: Response) {
    try {
        console.log('[HeatingController] Enable all zones');

        const heating = HeatingAPIFactory.getHeatingAPI();

        if (!heating.isReady()) {
            return res.status(400).json({ error: 'Heating system not ready. Initialize first.' });
        }

        await heating.enableAllZones();

        const status = heating.getSystemStatus();

        return res.status(200).json({
            message: 'All heating zones enabled',
            status
        });
    } catch (error) {
        console.error('[HeatingController] Enable all error:', error);
        return res.status(500).json({
            error: 'Failed to enable all zones',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Disable all heating zones
 * POST /api/heating/disable-all
 */
export async function disableAll(req: Request, res: Response) {
    try {
        console.log('[HeatingController] Disable all zones');

        const heating = HeatingAPIFactory.getHeatingAPI();

        if (!heating.isReady()) {
            return res.status(400).json({ error: 'Heating system not ready. Initialize first.' });
        }

        await heating.disableAllZones();

        const status = heating.getSystemStatus();

        return res.status(200).json({
            message: 'All heating zones disabled',
            status
        });
    } catch (error) {
        console.error('[HeatingController] Disable all error:', error);
        return res.status(500).json({
            error: 'Failed to disable all zones',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Get zone status
 * GET /api/heating/zone/:zone
 */
export async function getZoneStatus(req: Request, res: Response) {
    try {
        const { zone } = req.params;

        const validZones: HeatingZone[] = ['HEAD', 'BODY', 'LEGS'];
        if (!validZones.includes(zone.toUpperCase() as HeatingZone)) {
            return res.status(400).json({ error: 'Invalid zone. Must be HEAD, BODY, or LEGS' });
        }

        const heating = HeatingAPIFactory.getHeatingAPI();
        const status = heating.getZoneStatus(zone.toUpperCase() as HeatingZone);

        return res.status(200).json(status);
    } catch (error) {
        console.error('[HeatingController] Get zone status error:', error);
        return res.status(500).json({
            error: 'Failed to get zone status',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Get all zones status
 * GET /api/heating/zones
 */
export async function getAllZonesStatus(req: Request, res: Response) {
    try {
        const heating = HeatingAPIFactory.getHeatingAPI();
        const zones = heating.getAllZoneStatus();

        return res.status(200).json({ zones });
    } catch (error) {
        console.error('[HeatingController] Get all zones error:', error);
        return res.status(500).json({
            error: 'Failed to get zones status',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Get system status
 * GET /api/heating/status
 */
export async function getStatus(req: Request, res: Response) {
    try {
        const heating = HeatingAPIFactory.getHeatingAPI();
        const status = heating.getSystemStatus();

        return res.status(200).json(status);
    } catch (error) {
        console.error('[HeatingController] Get status error:', error);
        return res.status(500).json({
            error: 'Failed to get system status',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Set ambient temperature
 * POST /api/heating/set-ambient
 * Body: { temperature: number }
 */
export async function setAmbient(req: Request, res: Response) {
    try {
        const { temperature } = req.body;

        if (typeof temperature !== 'number') {
            return res.status(400).json({ error: 'Temperature is required' });
        }

        console.log(`[HeatingController] Set ambient temperature to ${temperature}°C`);

        const heating = HeatingAPIFactory.getHeatingAPI();
        heating.setAmbientTemperature(temperature);

        const status = heating.getSystemStatus();

        return res.status(200).json({
            message: `Ambient temperature set to ${temperature}°C`,
            status
        });
    } catch (error) {
        console.error('[HeatingController] Set ambient error:', error);
        return res.status(500).json({
            error: 'Failed to set ambient temperature',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Disconnect heating system
 * POST /api/heating/disconnect
 */
export async function disconnect(req: Request, res: Response) {
    try {
        console.log('[HeatingController] Disconnect request');

        const heating = HeatingAPIFactory.getHeatingAPI();
        await heating.disconnect();

        return res.status(200).json({
            message: 'Heating system disconnected successfully'
        });
    } catch (error) {
        console.error('[HeatingController] Disconnect error:', error);
        return res.status(500).json({
            error: 'Failed to disconnect heating system',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
