import { Router } from 'express';
import {
    initialize,
    getTemperature,
    getHumidity,
    getReading,
    getHistory,
    startMonitoring,
    stopMonitoring,
    getStatus,
    calibrateTemperature,
    calibrateHumidity,
    validateConditions,
    disconnect
} from '../../controllers/hardware/EnvironmentController';

const router = Router();

// Lifecycle management
router.post('/initialize', initialize);
router.post('/disconnect', disconnect);

// Reading endpoints
router.get('/temperature', getTemperature);
router.get('/humidity', getHumidity);
router.get('/reading', getReading);
router.get('/history', getHistory);

// Monitoring control
router.post('/start-monitoring', startMonitoring);
router.post('/stop-monitoring', stopMonitoring);

// Status and validation
router.get('/status', getStatus);
router.get('/validate', validateConditions);

// Calibration
router.post('/calibrate-temperature', calibrateTemperature);
router.post('/calibrate-humidity', calibrateHumidity);

export default router;
