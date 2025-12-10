import { Router } from 'express';
import {
    handleMoveCommand,
    getCurrentPosition,
    stopMovement,
    homeRobot,
    isMoving
} from '../../controllers/hardware/RobotController';

const router = Router();

/**
 * @route   POST /api/robot/move
 * @desc    Handle manual robot movement (start/stop in a direction)
 * @body    { direction: 'up'|'down'|'left'|'right', action: 'start'|'stop' }
 */
router.post('/move', handleMoveCommand);

/**
 * @route   GET /api/robot/position
 * @desc    Get current robot position
 */
router.get('/position', getCurrentPosition);

/**
 * @route   POST /api/robot/stop
 * @desc    Stop robot movement immediately
 */
router.post('/stop', stopMovement);

/**
 * @route   POST /api/robot/home
 * @desc    Home robot to origin (0, 0, 0)
 */
router.post('/home', homeRobot);

/**
 * @route   GET /api/robot/is-moving
 * @desc    Check if robot is currently moving
 */
router.get('/is-moving', isMoving);

export default router;
