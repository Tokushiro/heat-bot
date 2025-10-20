import { Router } from "express";
import { createSensor, listSensors } from "../controllers/sensor_controller";
const router = Router();

router.post("/", createSensor);
router.get("/", listSensors);
export default router;