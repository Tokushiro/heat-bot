import { Router } from "express";
import { createSensor, listSensors, checkSensorExists } from "../controllers/sensor_controller";
const router = Router();

router.post("/", createSensor);
router.get("/", listSensors);
router.get("/exists", checkSensorExists);
export default router;