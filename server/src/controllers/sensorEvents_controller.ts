import { Request, Response, NextFunction } from "express";
import * as sensorEventsService from "../services/sensorEvents_service";
import { sensorEventBus } from "../services/sensorEvents_service";

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

/** Server-Sent Events stream for sensor events */
export function sensorEventsStream(req: Request, res: Response) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const send = (event: string, data: unknown) => {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Send initial connection confirmation
    send("connected", { timestamp: new Date().toISOString() });

    const onSensorEvent = (eventData: any) => {
        send("sensor-event", eventData);
    };

    // Listen to sensor events
    sensorEventBus.on("sensor-event", onSensorEvent);

    // Clean up when client disconnects
    req.on("close", () => {
        sensorEventBus.off("sensor-event", onSensorEvent);
        res.end();
    });
}
