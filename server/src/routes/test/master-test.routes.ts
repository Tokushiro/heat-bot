import { Router } from 'express';
import * as masterTestController from '../../controllers/test/MasterTestController';

const router = Router();

// Start new test (begins with IEC 63180 boundary detection)
router.post('/start', masterTestController.startMasterTest);

// Start a specific test phase (tangential or radial)
router.post('/start-phase', masterTestController.startTestPhase);

// Pause/Resume/Stop
router.post('/pause', masterTestController.pauseMasterTest);
router.post('/resume', masterTestController.resumeMasterTest);
router.post('/resume-execution', masterTestController.resumeMasterTest); // Alias for compatibility
router.post('/stop', masterTestController.stopMasterTest);

// Get current state
router.get('/state', masterTestController.getMasterTestState);

// SSE stream
router.get('/stream', masterTestController.masterTestEventStream);

export default router;
