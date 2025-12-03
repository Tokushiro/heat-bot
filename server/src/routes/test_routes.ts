import { Router } from 'express';
import { createTest, listTests, getTest, updateStatus, removeTest } from '../controllers/test_controller';

const router = Router();

router.post('/', createTest);
router.get('/', listTests);
router.get('/:testId', getTest);
router.patch('/:testId/status', updateStatus);
router.delete('/:testId', removeTest);

export default router;