import { Request, Response } from "express";
import { SerialManager } from "../../services/core/SerialManager";

export async function connectSerial(req: Request, res: Response) {
    const { path, baudRate } = req.body || {};
    if (!path) return res.status(400).json({ error: "path is required" });

    try {
        await SerialManager.instance.connect(path, baudRate ?? 115200);
        res.json({ ok: true });
    } catch (err: any) {
        res.status(500).json({ ok: false, error: String(err?.message ?? err) });
    }
}

export async function disconnectSerial(_req: Request, res: Response) {
    try {
        await SerialManager.instance.disconnect();
        res.json({ ok: true });
    } catch (err: any) {
        res.status(500).json({ ok: false, error: String(err?.message ?? err) });
    }
}

export async function sendSerial(req: Request, res: Response) {
    const { cmd } = req.body || {};
    if (!cmd) return res.status(400).json({ error: "cmd is required" });

    try {
        await SerialManager.instance.send(cmd);
        res.json({ ok: true });
    } catch (err: any) {
        res.status(500).json({ ok: false, error: String(err?.message ?? err) });
    }
}

export function getSerialStatus(_req: Request, res: Response) {
    res.json({ connected: SerialManager.instance.connected });
}

/** Server-Sent Events stream for logs & status */
export function serialStream(req: Request, res: Response) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const send = (event: string, data: unknown) => {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // immediately send current status
    send("status", { connected: SerialManager.instance.connected });

    const onData = (line: string) => send("data", { line });
    const onStatus = (payload: any) => send("status", payload);

    SerialManager.instance.on("data", onData);
    SerialManager.instance.on("status", onStatus);

    req.on("close", () => {
        SerialManager.instance.off("data", onData);
        SerialManager.instance.off("status", onStatus);
        res.end();
    });
}
