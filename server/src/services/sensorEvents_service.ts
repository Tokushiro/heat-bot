import websocketService from "./websocket_service";

interface SensorEvent {
    sensorId: string;
    mac: string;
    event: string;    // "MovementDetected"
    raw: string;      // hex payload
    timestamp?: string;
}

export async function processSensorEvent(event: SensorEvent) {
    const timestamp = event.timestamp ?? new Date().toISOString();

    console.log("[SensorEvent]", {
        sensorId: event.sensorId,
        mac: event.mac,
        event: event.event,
        raw: event.raw,
        timestamp,
    });

    // Broadcast to connected WebSocket clients so UI can react immediately
    websocketService.broadcast("sensor-detection", {
        sensorId: event.sensorId,
        mac: event.mac,
        event: event.event,
        raw: event.raw,
        timestamp,
    });

    return;
}
