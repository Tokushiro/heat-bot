import { Router } from 'express';
import {
    getDeadTimeSummary,
    getDeadTimeBreakdown,
    getDeadTimeLogs,
    compareDeadTime,
    getAverageDeadTimeByType
} from '../../controllers/timing/DeadTimeController';

const router = Router();

/**
 * Timing Routes
 *
 * Dead time and timing analysis endpoints
 */

// Dead time summary for a test
router.get('/summary/:testId', getDeadTimeSummary);

// Dead time breakdown by reason
router.get('/breakdown/:testId', getDeadTimeBreakdown);

// All dead time logs for a test
router.get('/logs/:testId', getDeadTimeLogs);

// Compare dead time across tests
router.post('/compare', compareDeadTime);

// Average dead time by test type
router.get('/average-by-type', getAverageDeadTimeByType);

export default router;
