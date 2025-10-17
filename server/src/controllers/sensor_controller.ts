import { Request, Response } from "express";
import { insertSensor } from "../services/sensor_service";

export async function createSensor(req: Request, res: Response) {
    await insertSensor(req.body);
    return res.status(204).send();
}
