import { EventEmitter } from 'events';
import { TelemetrySample } from './TelemetryService';


class TelemetryEventBus extends EventEmitter {}

export const telemetryEventBus = new TelemetryEventBus();

export type TelemetryEventPayload = TelemetrySample & {
    telemetry_id?: number;
};


export function emitTelemetry(payload: TelemetryEventPayload): void {
    telemetryEventBus.emit('telemetry', payload);
}

