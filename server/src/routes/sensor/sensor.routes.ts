import { Router } from "express";
import { createSensor, listSensors, checkSensorExists, receiveBleEvent} from "../../controllers/sensor/SensorController";
const router = Router();

router.post("/", createSensor);
router.get("/", listSensors);
router.get("/exists", checkSensorExists);
router.post("/sensor-events", receiveBleEvent);

export default router;