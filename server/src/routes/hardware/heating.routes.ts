import { Router } from 'express';
import * as heatingController from '../../controllers/hardware/HeatingController';

const router = Router();

// Initialize heating system
router.post('/initialize', heatingController.initialize);

// Set temperature for a zone
router.post('/set-temperature', heatingController.setTemperature);

// Set temperature offset from ambient
router.post('/set-offset', heatingController.setOffset);

// Enable/disable zones
router.post('/enable', heatingController.enableZone);
router.post('/disable', heatingController.disableZone);
router.post('/enable-all', heatingController.enableAll);
router.post('/disable-all', heatingController.disableAll);

// Get status
router.get('/zone/:zone', heatingController.getZoneStatus);
router.get('/zones', heatingController.getAllZonesStatus);
router.get('/status', heatingController.getStatus);

// Set ambient temperature
router.post('/set-ambient', heatingController.setAmbient);

// Disconnect
router.post('/disconnect', heatingController.disconnect);

export default router;
