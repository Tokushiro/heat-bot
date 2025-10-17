import { Router } from "express";
import { createSensor } from "../controllers/sensor_controller";
const router = Router();

router.post("/", createSensor);
export default router;