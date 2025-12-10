import { Request, Response } from 'express';
import { TelemetryService } from '../../services/telemetry/TelemetryService';

/**
 * Telemetry Controller
 *
 * REST API controller for telemetry data operations.
 * Provides endpoints for recording and retrieving real-time test data.
 */

/**
 * Record a telemetry sample
 * POST /api/telemetry/record
 * Body: TelemetrySample
 */
export async function recordSample(req: Request, res: Response) {
    try {
        const sample = req.body;

        if (!sample.test_id) {
            return res.status(400).json({ error: 'test_id is required' });
        }

        console.log(`[TelemetryController] Recording telemetry for test ${sample.test_id}`);

        const telemetryId = await TelemetryService.recordSample(sample);

        return res.status(201).json({
            message: 'Telemetry sample recorded',
            telemetry_id: telemetryId
        });
    } catch (error) {
        console.error('[TelemetryController] Record sample error:', error);
        return res.status(500).json({
            error: 'Failed to record telemetry sample',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Get telemetry samples for a test
 * GET /api/telemetry/test/:testId
 * Query params: limit, offset
 */
export async function getSamplesForTest(req: Request, res: Response) {
    try {
        const testId = parseInt(req.params.testId, 10);
        const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 1000;
        const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

        if (isNaN(testId)) {
            return res.status(400).json({ error: 'Invalid test_id' });
        }

        const samples = await TelemetryService.getSamplesForTest(testId, limit, offset);

        return res.status(200).json({
            test_id: testId,
            count: samples.length,
            limit,
            offset,
            samples
        });
    } catch (error) {
        console.error('[TelemetryController] Get samples error:', error);
        return res.status(500).json({
            error: 'Failed to get telemetry samples',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Get latest telemetry sample for a test
 * GET /api/telemetry/test/:testId/latest
 */
export async function getLatestSample(req: Request, res: Response) {
    try {
        const testId = parseInt(req.params.testId, 10);

        if (isNaN(testId)) {
            return res.status(400).json({ error: 'Invalid test_id' });
        }

        const sample = await TelemetryService.getLatestSample(testId);

        if (!sample) {
            return res.status(404).json({ error: 'No telemetry samples found for this test' });
        }

        return res.status(200).json(sample);
    } catch (error) {
        console.error('[TelemetryController] Get latest sample error:', error);
        return res.status(500).json({
            error: 'Failed to get latest telemetry sample',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Get telemetry summary for a test
 * GET /api/telemetry/test/:testId/summary
 */
export async function getSummary(req: Request, res: Response) {
    try {
        const testId = parseInt(req.params.testId, 10);

        if (isNaN(testId)) {
            return res.status(400).json({ error: 'Invalid test_id' });
        }

        const summary = await TelemetryService.getSummary(testId);

        if (!summary) {
            return res.status(404).json({ error: 'No telemetry data found for this test' });
        }

        return res.status(200).json(summary);
    } catch (error) {
        console.error('[TelemetryController] Get summary error:', error);
        return res.status(500).json({
            error: 'Failed to get telemetry summary',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Get telemetry samples by time range
 * GET /api/telemetry/test/:testId/range
 * Query params: start (ISO datetime), end (ISO datetime)
 */
export async function getSamplesByTimeRange(req: Request, res: Response) {
    try {
        const testId = parseInt(req.params.testId, 10);
        const start = req.query.start as string;
        const end = req.query.end as string;

        if (isNaN(testId)) {
            return res.status(400).json({ error: 'Invalid test_id' });
        }

        if (!start || !end) {
            return res.status(400).json({ error: 'start and end parameters are required' });
        }

        const startDate = new Date(start);
        const endDate = new Date(end);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.status(400).json({ error: 'Invalid date format. Use ISO 8601 format.' });
        }

        const samples = await TelemetryService.getSamplesByTimeRange(testId, startDate, endDate);

        return res.status(200).json({
            test_id: testId,
            start: startDate,
            end: endDate,
            count: samples.length,
            samples
        });
    } catch (error) {
        console.error('[TelemetryController] Get samples by range error:', error);
        return res.status(500).json({
            error: 'Failed to get telemetry samples',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Get telemetry samples for a test step
 * GET /api/telemetry/step/:testStepId
 */
export async function getSamplesForStep(req: Request, res: Response) {
    try {
        const testStepId = parseInt(req.params.testStepId, 10);

        if (isNaN(testStepId)) {
            return res.status(400).json({ error: 'Invalid test_step_id' });
        }

        const samples = await TelemetryService.getSamplesForStep(testStepId);

        return res.status(200).json({
            test_step_id: testStepId,
            count: samples.length,
            samples
        });
    } catch (error) {
        console.error('[TelemetryController] Get samples for step error:', error);
        return res.status(500).json({
            error: 'Failed to get telemetry samples for step',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Export telemetry to CSV
 * GET /api/telemetry/test/:testId/export
 */
export async function exportCSV(req: Request, res: Response) {
    try {
        const testId = parseInt(req.params.testId, 10);

        if (isNaN(testId)) {
            return res.status(400).json({ error: 'Invalid test_id' });
        }

        const csv = await TelemetryService.exportToCSV(testId);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=telemetry_test_${testId}.csv`);

        return res.status(200).send(csv);
    } catch (error) {
        console.error('[TelemetryController] Export CSV error:', error);
        return res.status(500).json({
            error: 'Failed to export telemetry data',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Get sample count for a test
 * GET /api/telemetry/test/:testId/count
 */
export async function getSampleCount(req: Request, res: Response) {
    try {
        const testId = parseInt(req.params.testId, 10);

        if (isNaN(testId)) {
            return res.status(400).json({ error: 'Invalid test_id' });
        }

        const count = await TelemetryService.getSampleCount(testId);

        return res.status(200).json({
            test_id: testId,
            count
        });
    } catch (error) {
        console.error('[TelemetryController] Get count error:', error);
        return res.status(500).json({
            error: 'Failed to get sample count',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Delete telemetry samples for a test
 * DELETE /api/telemetry/test/:testId
 */
export async function deleteSamples(req: Request, res: Response) {
    try {
        const testId = parseInt(req.params.testId, 10);

        if (isNaN(testId)) {
            return res.status(400).json({ error: 'Invalid test_id' });
        }

        const deletedCount = await TelemetryService.deleteSamplesForTest(testId);

        return res.status(200).json({
            message: `Deleted ${deletedCount} telemetry samples`,
            test_id: testId,
            deleted_count: deletedCount
        });
    } catch (error) {
        console.error('[TelemetryController] Delete samples error:', error);
        return res.status(500).json({
            error: 'Failed to delete telemetry samples',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
