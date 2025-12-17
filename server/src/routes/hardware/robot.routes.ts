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

router.post('/move', handleMoveCommand);

router.post('/manual/start', startManualControl);

router.post('/manual/stop', stopManualControl);

router.get('/position', getCurrentPosition);

router.post('/stop', stopMovement);

router.post('/home', homeRobot);

router.get('/is-moving', isMoving);

router.get('/stream', robotEventStream);

export default router;
