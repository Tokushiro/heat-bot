import { Router } from 'express';
import * as testStepController from '../../controllers/test/TestStepController';

const router = Router();

router.post('/', testStepController.createTestStep);
router.get('/test/:testId', testStepController.listTestSteps);
router.patch('/:stepId', testStepController.updateStep);
router.get('/test/:testId/progress', testStepController.getProgress);

export default router;