import { Request, Response, NextFunction } from "express";
import * as sensorEventsService from "../services/sensorEvents_service";

export async function handleSensorEvent(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const body = req.body;

        if (
            !body ||
            typeof body.sensorId !== "string" ||
            typeof body.mac !== "string" ||
            typeof body.event !== "string" ||
            typeof body.raw !== "string"
        ) {
            return res.status(400).json({ error: "Invalid payload" });
        }

        await sensorEventsService.processSensorEvent(body);

        return res.status(201).json({ ok: true });
    } catch (err) {
        next(err);
    }
}
