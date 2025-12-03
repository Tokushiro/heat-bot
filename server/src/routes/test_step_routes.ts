import { Router } from 'express';
import * as testStepController from '../controllers/test_step_controller';

const router = Router();

router.post('/', testStepController.createTestStep);
router.get('/test/:testId', testStepController.listTestSteps);
router.patch('/:stepId', testStepController.updateStep);
router.get('/test/:testId/progress', testStepController.getProgress);

export default router;