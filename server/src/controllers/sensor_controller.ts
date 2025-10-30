import { Request, Response } from "express";
import { insertSensor, getAllSensors } from "../services/sensor_service";

export async function createSensor(req: Request, res: Response) {
    await insertSensor(req.body);
    console.log(`Got request ${req.body}`);
    return res.status(204).send();
}

export async function listSensors(_req: Request, res: Response) {
    const sensors = await getAllSensors();
    return res.status(200).json(sensors);
}