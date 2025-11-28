import { Router } from "express";
import * as sensorEventsController from "../controllers/sensorEvents_controller";

const router = Router();

// POST /api/sensor-events
router.post("/sensor-events", sensorEventsController.handleSensorEvent);

export default router;
