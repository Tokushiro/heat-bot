import { Router } from 'express';
import {
    initialize,
    generateGrid,
    startTest,
    pauseTest,
    resumeTest,
    stopTest,
    getProgress,
    getTestResult,
    getCellResult,
    moveToPosition,
    getCurrentPosition,
    validateConfig,
    getStatus,
    disconnect
} from '../../controllers/gridtest/GridTestController';

const router = Router();

// Lifecycle management
router.post('/initialize', initialize);
router.post('/disconnect', disconnect);

// Grid generation
router.post('/generate-grid', generateGrid);

// Test execution
router.post('/start', startTest);
router.post('/pause', pauseTest);
router.post('/resume', resumeTest);
router.post('/stop', stopTest);

// Progress and results
router.get('/progress', getProgress);
router.get('/result/:testId', getTestResult);
router.get('/cell-result', getCellResult);

// Position control
router.post('/move-to-position', moveToPosition);
router.get('/current-position', getCurrentPosition);

// Configuration and status
router.post('/validate-config', validateConfig);
router.get('/status', getStatus);

export default router;
