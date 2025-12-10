import { Router } from 'express';
import * as telemetryController from '../../controllers/telemetry/TelemetryController';

const router = Router();

/**
 * Telemetry Routes
 * Base path: /api/telemetry
 */

// Record telemetry sample
router.post('/record', telemetryController.recordSample);

// Get telemetry samples for a test
router.get('/test/:testId', telemetryController.getSamplesForTest);

// Get latest telemetry sample
router.get('/test/:testId/latest', telemetryController.getLatestSample);

// Get telemetry summary
router.get('/test/:testId/summary', telemetryController.getSummary);

// Get samples by time range
router.get('/test/:testId/range', telemetryController.getSamplesByTimeRange);

// Get sample count
router.get('/test/:testId/count', telemetryController.getSampleCount);

// Export to CSV
router.get('/test/:testId/export', telemetryController.exportCSV);

// Get samples for a test step
router.get('/step/:testStepId', telemetryController.getSamplesForStep);

// Delete telemetry samples
router.delete('/test/:testId', telemetryController.deleteSamples);

export default router;
