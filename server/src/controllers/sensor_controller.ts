import { Request, Response, NextFunction } from "express";
import { insertSensor, getAllSensors, checkSensorsExist } from "../services/sensor_service";
import { processBleDetectionEvent } from "../services/sensor_service";

export async function createSensor(req: Request, res: Response) {
    await insertSensor(req.body);
    console.log(`Got request ${req.body}`);
    return res.status(204).send();
}

export async function listSensors(_req: Request, res: Response) {
    const sensors = await getAllSensors();
    return res.status(200).json(sensors);
}

export async function checkSensorExists(req: Request, res: Response) {
    const exists = await checkSensorsExist();
    return res.status(200).json({ exists });
}

export async function receiveBleEvent(req: Request, res: Response, next: NextFunction) {
    try {
        await processBleDetectionEvent(req.body);
        res.status(200).json({ ok: true });
    } catch (err) {
        next(err);
    }
}

