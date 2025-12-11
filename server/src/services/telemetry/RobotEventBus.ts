import { EventEmitter } from "events";

export type RobotEventPayload = {
    type: string;
    timestamp: string;
    [key: string]: any;
};

class RobotEventBus extends EventEmitter {}

export const robotEventBus = new RobotEventBus();

/**
 * Emit a robot event to all subscribers.
 * The generic "event" channel carries all events while the specific
 * type channel allows targeted listeners.
 */
export function emitRobotEvent(type: string, data: Record<string, any> = {}): void {
    const payload: RobotEventPayload = {
        ...data,
        type,
        timestamp: typeof data.timestamp === "string" ? data.timestamp : new Date().toISOString(),
    };

    robotEventBus.emit("event", payload);
    robotEventBus.emit(type, payload);
}
