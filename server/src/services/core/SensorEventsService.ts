import { EventEmitter } from "events";

interface SensorEvent {
    sensorId: string;
    mac: string;
    event: string;    // "MovementDetected"
    raw: string;      // hex payload
    timestamp?: string;
}

class SensorEventBus extends EventEmitter {}
export const sensorEventBus = new SensorEventBus();

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

    return;
}
