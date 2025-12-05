import { Router } from 'express';
import { createTest, listTests, getTest, updateStatus, removeTest } from '../../controllers/test/TestController';
import * as testStateController from '../../controllers/test/TestStateController';

const router = Router();

router.post('/', createTest);
router.get('/', listTests);
router.get('/:testId', getTest);
router.get('/:testId/export', testStateController.exportTestData);
router.patch('/:testId/status', updateStatus);
router.delete('/:testId', removeTest);
router.get('/:testId/steps/summary', testStateController.getTestStepSummary);
router.get('/:testId/state', testStateController.getTestState);
router.get('/:testId/steps', testStateController.getTestSteps);

export default router;