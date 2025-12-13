import { Request, Response } from 'express';
import { DeadTimeService } from '../../services/timing/DeadTimeService';

/**
 * Dead Time Controller
 *
 * REST API endpoints for dead time analysis and timing data
 */

/**
 * Get dead time summary for a test
 * GET /api/timing/summary/:testId
 */
export async function getDeadTimeSummary(req: Request, res: Response) {
    try {
        const testId = parseInt(req.params.testId, 10);

        if (isNaN(testId)) {
            return res.status(400).json({ error: 'Invalid test ID' });
        }

        console.log(`[DeadTimeController] Getting dead time summary for test ${testId}`);

        const summary = await DeadTimeService.getSummary(testId);

        if (!summary) {
            return res.status(404).json({ error: 'Test not found or no timing data available' });
        }

        return res.status(200).json(summary);
    } catch (error) {
        console.error('[DeadTimeController] Get summary error:', error);
        return res.status(500).json({
            error: 'Failed to get dead time summary',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Get dead time breakdown by reason for a test
 * GET /api/timing/breakdown/:testId
 */
export async function getDeadTimeBreakdown(req: Request, res: Response) {
    try {
        const testId = parseInt(req.params.testId, 10);

        if (isNaN(testId)) {
            return res.status(400).json({ error: 'Invalid test ID' });
        }

        console.log(`[DeadTimeController] Getting dead time breakdown for test ${testId}`);

        const breakdown = await DeadTimeService.getBreakdown(testId);

        return res.status(200).json({
            testId,
            breakdown,
            totalReasons: breakdown.length
        });
    } catch (error) {
        console.error('[DeadTimeController] Get breakdown error:', error);
        return res.status(500).json({
            error: 'Failed to get dead time breakdown',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Get all dead time logs for a test
 * GET /api/timing/logs/:testId
 */
export async function getDeadTimeLogs(req: Request, res: Response) {
    try {
        const testId = parseInt(req.params.testId, 10);

        if (isNaN(testId)) {
            return res.status(400).json({ error: 'Invalid test ID' });
        }

        console.log(`[DeadTimeController] Getting dead time logs for test ${testId}`);

        const logs = await DeadTimeService.getLogs(testId);

        return res.status(200).json({
            testId,
            logs,
            totalLogs: logs.length
        });
    } catch (error) {
        console.error('[DeadTimeController] Get logs error:', error);
        return res.status(500).json({
            error: 'Failed to get dead time logs',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Compare dead time across multiple tests
 * POST /api/timing/compare
 * Body: { testIds: number[] }
 */
export async function compareDeadTime(req: Request, res: Response) {
    try {
        const { testIds } = req.body;

        if (!Array.isArray(testIds) || testIds.length < 2) {
            return res.status(400).json({ error: 'At least 2 test IDs required for comparison' });
        }

        console.log(`[DeadTimeController] Comparing dead time for ${testIds.length} tests`);

        const comparison = await DeadTimeService.compareTests(testIds);

        return res.status(200).json({
            testIds,
            comparison,
            totalTests: comparison.length
        });
    } catch (error) {
        console.error('[DeadTimeController] Compare dead time error:', error);
        return res.status(500).json({
            error: 'Failed to compare dead time',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Get average dead time by test type
 * GET /api/timing/average-by-type
 */
export async function getAverageDeadTimeByType(req: Request, res: Response) {
    try {
        console.log('[DeadTimeController] Getting average dead time by test type');

        const averages = await DeadTimeService.getAverageByTestType();

        return res.status(200).json({
            averages,
            totalTestTypes: averages.length
        });
    } catch (error) {
        console.error('[DeadTimeController] Get average by type error:', error);
        return res.status(500).json({
            error: 'Failed to get average dead time by type',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
