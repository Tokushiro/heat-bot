import { EventEmitter } from "events";

export type RobotEventPayload = {
    type: string;
    timestamp: string;
    [key: string]: any;
};

class RobotEventBus extends EventEmitter {}

export const robotEventBus = new RobotEventBus();


export function emitRobotEvent(type: string, data: Record<string, any> = {}): void {
    const payload: RobotEventPayload = {
        ...data,
        type,
        timestamp: typeof data.timestamp === "string" ? data.timestamp : new Date().toISOString(),
    };

    robotEventBus.emit("event", payload);
    robotEventBus.emit(type, payload);
}
