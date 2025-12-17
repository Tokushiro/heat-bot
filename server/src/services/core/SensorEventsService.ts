import { EventEmitter } from "events";
import bleEventBus, { DetectionEvent } from "./BleEventBus";

interface SensorEvent {
    sensorId: string;
    mac: string;
    event: string;    // "MovementDetected"
    raw: string;      // hex payload
    timestamp?: string;
}

class SensorEventBus extends EventEmitter {}
export const sensorEventBus = new SensorEventBus();

function parseDetectedFlag(eventName: string): boolean | null {
    const normalized = eventName.trim().toLowerCase();

    if (normalized === "movementdetected" || normalized === "detected") return true;
    if (normalized === "nomovement" || normalized === "no_movement" || normalized === "movementstopped" || normalized === "notdetected") return false;

    return null;
}

function parseHexBytes(rawHex: string): number[] | null {
    const normalized = rawHex.trim().replace(/^0x/i, "").replace(/\s+/g, "");
    if (normalized.length === 0 || normalized.length % 2 !== 0) return null;

    const bytes: number[] = [];
    for (let i = 0; i < normalized.length; i += 2) {
        const byte = Number.parseInt(normalized.slice(i, i + 2), 16);
        if (Number.isNaN(byte)) return null;
        bytes.push(byte);
    }

    return bytes;
}

export async function processSensorEvent(event: SensorEvent) {
    const timestamp = event.timestamp ?? new Date().toISOString();

    const eventData = {
        sensorId: event.sensorId,
        mac: event.mac,
        event: event.event,
        raw: event.raw,
        timestamp,
    };

    console.log("[SensorEvent]", eventData);

    // Broadcast to all connected frontend clients via SSE
    sensorEventBus.emit("sensor-event", eventData);

    // Also publish normalized detection events for the orchestrator (when the event type is known).
    const detected = parseDetectedFlag(event.event);
    if (detected !== null) {
        const raw = parseHexBytes(event.raw);

        if (!raw) {
            console.warn("[SensorEvent] Ignoring invalid raw hex payload (cannot parse to bytes)");
            return;
        }

        const detectionEvent: DetectionEvent = { detected, timestamp, raw };
        bleEventBus.emit("detection", detectionEvent);
    }

    return;
}
