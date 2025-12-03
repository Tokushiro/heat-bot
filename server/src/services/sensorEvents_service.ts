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


    // -----------------------------------------
    // TODO:
    // Broadcast to frontend (WebSocket / SSE)
    //
    // -----------------------------------------

    return;
}
