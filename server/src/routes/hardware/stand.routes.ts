import { Router } from 'express';
import * as standController from '../../controllers/hardware/StandController';

const router = Router();


// Initialize stand
router.post('/initialize', standController.initialize);

// Set detector to specific angle
router.post('/set-angle', standController.setAngle);

// Step detector angle by delta
router.post('/step-angle', standController.stepAngle);

// Get current detector angle
router.get('/current-angle', standController.getCurrentAngle);

// Calibrate zero angle reference
router.post('/calibrate', standController.calibrateZero);

// Get stand status
router.get('/status', standController.getStatus);

// Disconnect stand
router.post('/disconnect', standController.disconnect);

export default router;
