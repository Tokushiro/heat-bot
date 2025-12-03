import { Router } from 'express';
import { createTest, listTests, updateStatus } from '../controllers/test_controller';

const router = Router();

router.post('/', createTest);
router.get('/', listTests);
router.patch('/:testId/status', updateStatus); // NEW

export default router;