import { EventEmitter } from "events";

/**
 * Detection Event Structure
 */
export interface DetectionEvent {
    detected: boolean;
    timestamp: string;
    raw: number[];
}

/**
 * BLE Event Bus Interface
 * Both real and mock implementations must conform to this interface
 */
export interface IBleEventBus extends EventEmitter {
    emitDetection(event: DetectionEvent): void;
}

/**
 * Factory that returns real or mock BLE Event Bus based on environment
 * 
 * Usage:
 *   import bleEventBus from './services/bleEventBus';
 *   bleEventBus.on('detection', (event) => {
 *       console.log('Detection:', event.detected);
 *   });
 * 
 * Environment:
 *   USE_MOCK_HARDWARE=true  → Returns mockBleEventBus
 *   USE_MOCK_HARDWARE=false → Returns realBleEventBus
 */
class BleEventBusFactory {
    private static _instance: IBleEventBus;

    static get instance(): IBleEventBus {
        if (!this._instance) {
            const useMock = process.env.USE_MOCK_HARDWARE === 'true';
            
            if (useMock) {
                console.log('🎭 Using MOCK BLE Event Bus (simulated sensor)');
                const { mockBleEventBus } = require('./mock/ble_event_bus');
                this._instance = mockBleEventBus;
            } else {
                console.log('📡 Using REAL BLE Event Bus (physical sensor)');
                const { realBleEventBus } = require('./real/ble_event_bus');
                this._instance = realBleEventBus;
            }
        }
        return this._instance;
    }

    /**
     * Reset instance (useful for testing)
     */
    static reset(): void {
        if (this._instance) {
            this._instance.removeAllListeners();
        }
        this._instance = null as any;
    }
}

// Export singleton instance
const bleEventBus = BleEventBusFactory.instance;
export default bleEventBus;
