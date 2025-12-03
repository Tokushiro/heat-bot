import "../config/env";
import { EventEmitter } from "events";

/**
 * SerialManager Interface
 * Both real and mock implementations must conform to this interface
 */
export interface ISerialManager extends EventEmitter {
    connect(path: string, baudRate?: number): Promise<void>;
    disconnect(): Promise<void>;
    send(line: string): Promise<void>;
    readonly connected: boolean;
}

/**
 * Factory that returns real or mock SerialManager based on environment
 * 
 * Usage:
 *   import SerialManager from './services/SerialManager';
 *   const robot = SerialManager.instance;
 *   await robot.connect('/dev/ttyUSB0');
 * 
 * Environment:
 *   USE_MOCK_HARDWARE=true  → Returns MockSerialManager
 *   USE_MOCK_HARDWARE=false → Returns RealSerialManager
 */
class SerialManagerFactory {
    private static _instance: ISerialManager;

    static get instance(): ISerialManager {
        if (!this._instance) {
            const useMock = process.env.USE_MOCK_HARDWARE === 'true';
            
            if (useMock) {
                console.log('🎭 Using MOCK SerialManager (simulated robot)');
                const { MockSerialManager } = require('./mock/serial_mannager');
                this._instance = MockSerialManager.instance;
            } else {
                console.log('🤖 Using REAL SerialManager (physical robot)');
                const { RealSerialManager } = require('./real/serial_mannager');
                this._instance = RealSerialManager.instance;
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

export const SerialManager = SerialManagerFactory;
export default SerialManager;
