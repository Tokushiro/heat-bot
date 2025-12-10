import { Router } from 'express';
import {
    handleMoveCommand,
    getCurrentPosition,
    stopMovement,
    homeRobot,
    isMoving,
    robotEventStream,
    startManualControl,
    stopManualControl
} from '../../controllers/hardware/RobotController';

const router = Router();

/**
 * @route   POST /api/robot/move
 * @desc    Handle manual robot movement (start/stop in a direction)
 * @body    { direction: 'up'|'down'|'left'|'right', action: 'start'|'stop' }
 */
router.post('/move', handleMoveCommand);

/**
 * @route   POST /api/robot/manual/start
 * @desc    Mark manual control as armed (emits SSE log)
 */
router.post('/manual/start', startManualControl);

/**
 * @route   POST /api/robot/manual/stop
 * @desc    Mark manual control as disarmed and stop motion
 */
router.post('/manual/stop', stopManualControl);

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

/**
 * @route   GET /api/robot/stream
 * @desc    SSE stream of robot and manual-control events
 */
router.get('/stream', robotEventStream);

export default router;
