import { Router } from "express";
import * as sensorEventsController from "../../controllers/sensor/SensorEventsController";

const router = Router();

router.post("/sensor-events", sensorEventsController.handleSensorEvent);

router.get("/sensor-events/stream", sensorEventsController.sensorEventsStream);

export default router;
