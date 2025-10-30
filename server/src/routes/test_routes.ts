import {Router} from 'express';
import {createTest, listTests} from '../controllers/test_controller';

const router = Router();

router.post('/', createTest);
router.get('/', listTests);

export default router;