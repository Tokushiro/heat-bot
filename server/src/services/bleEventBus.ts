import { EventEmitter } from "events";

export interface DetectionEvent {
    detected: boolean;
    timestamp: string;
    raw: number[];
}

class BleEventBus extends EventEmitter {}

const bleEventBus = new BleEventBus();
export default bleEventBus;