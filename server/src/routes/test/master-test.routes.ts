import { Router } from 'express';
import * as masterTestController from '../../controllers/test/MasterTestController';

const router = Router();

// Start new test (begins with boundary detection)
router.post('/start', masterTestController.startMasterTest);

// Start a specific test phase (tangential or radial)
router.post('/start-phase', masterTestController.startTestPhase);

// Continue to compliance test (after boundary detection) - deprecated
router.post('/continue', masterTestController.continueToCompliance);

// Resume from saved state (from history)
router.post('/resume', masterTestController.resumeFromState);

// Pause/Resume/Stop
router.post('/pause', masterTestController.pauseMasterTest);
router.post('/resume-execution', masterTestController.resumeMasterTest);
router.post('/stop', masterTestController.stopMasterTest);

// Get current state
router.get('/state', masterTestController.getMasterTestState);

// SSE stream
router.get('/stream', masterTestController.masterTestStream);

export default router;
