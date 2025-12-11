import { EventEmitter } from 'events';
import { TelemetrySample } from './TelemetryService';

/**
 * Simple event bus used to broadcast new telemetry samples
 * to SSE/WebSocket consumers without coupling TelemetryService
 * to any transport details.
 */
class TelemetryEventBus extends EventEmitter {}

export const telemetryEventBus = new TelemetryEventBus();

export type TelemetryEventPayload = TelemetrySample & {
    telemetry_id?: number;
};

/**
 * Emit a telemetry event to all subscribers. Consumers may
 * filter by test_id on receipt.
 */
export function emitTelemetry(payload: TelemetryEventPayload): void {
    telemetryEventBus.emit('telemetry', payload);
}

