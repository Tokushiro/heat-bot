import { EventEmitter } from "events";
import { IBleEventBus, DetectionEvent } from "../bleEventBus";

/**
 * Mock BLE Event Bus - Simulates PIR sensor behavior for testing
 * 
 * Features:
 * - Simulates detection events with configurable probability
 * - Auto-detection mode (simulates periodic detections)
 * - Manual trigger mode (for precise testing)
 * - Realistic timing delays
 * - WebSocket broadcasting support
 */
class MockBleEventBus extends EventEmitter implements IBleEventBus {
    private _connected: boolean = false;
    private _autoDetect: boolean = false;
    private _detectionProbability: number = 0.85; // 85% chance of detection
    private _detectionDelayMs: number = 1500; // Delay between auto-detections
    private _autoDetectInterval: NodeJS.Timeout | null = null;

    constructor() {
        super();
        console.log("🎭 [Mock BLE] Initialized");
    }

    /**
     * Emit detection event (with optional WebSocket broadcasting)
     */
    emitDetection(event: DetectionEvent): void {
        this.emit('detection', event);
        
        // Broadcast via WebSocket if available
        try {
            const { websocketService } = require('../websocket_service');
            if (websocketService) {
                websocketService.broadcast('sensor-detection', event);
            }
        } catch (error) {
            // WebSocket service not available, skip broadcasting
        }
    }

    /**
     * Connect to mock sensor
     */
    connect(): void {
        if (this._connected) {
            console.log("🎭 [Mock BLE] Already connected");
            return;
        }

        console.log("🎭 [Mock BLE] Connecting to sensor...");
        this._connected = true;
        this.emit('connected');
        console.log("🎭 [Mock BLE] Connected!");
    }

    /**
     * Disconnect from mock sensor
     */
    disconnect(): void {
        if (!this._connected) {
            return;
        }

        console.log("🎭 [Mock BLE] Disconnecting...");
        this.stopAutoDetect();
        this._connected = false;
        this.emit('disconnected');
        console.log("🎭 [Mock BLE] Disconnected");
    }

    /**
     * Get connection status
     */
    isConnected(): boolean {
        return this._connected;
    }

    /**
     * Manually trigger a detection event
     */
    triggerDetection(detected: boolean = true): void {
        if (!this._connected) {
            console.warn("🎭 [Mock BLE] Not connected, cannot trigger detection");
            return;
        }

        const event: DetectionEvent = {
            detected,
            timestamp: new Date().toISOString(),
            raw: this.generateMockRawData(detected),
        };

        console.log(`🎭 [Mock BLE] Manual trigger: ${detected ? 'DETECTED' : 'NO DETECTION'}`);
        this.emitDetection(event);
    }

    /**
     * Start auto-detection mode (simulates periodic sensor readings)
     */
    startAutoDetect(): void {
        if (!this._connected) {
            console.warn("🎭 [Mock BLE] Not connected, cannot start auto-detect");
            return;
        }

        if (this._autoDetect) {
            console.log("🎭 [Mock BLE] Auto-detect already running");
            return;
        }

        console.log(`🎭 [Mock BLE] Starting auto-detect (probability: ${this._detectionProbability}, interval: ${this._detectionDelayMs}ms)`);
        this._autoDetect = true;

        this._autoDetectInterval = setInterval(() => {
            const detected = Math.random() < this._detectionProbability;
            
            const event: DetectionEvent = {
                detected,
                timestamp: new Date().toISOString(),
                raw: this.generateMockRawData(detected),
            };

            console.log(`🎭 [Mock BLE] Auto-detect: ${detected ? '✓ DETECTED' : '✗ NO DETECTION'}`);
            this.emitDetection(event);
        }, this._detectionDelayMs);
    }

    /**
     * Stop auto-detection mode
     */
    stopAutoDetect(): void {
        if (!this._autoDetect) {
            return;
        }

        console.log("🎭 [Mock BLE] Stopping auto-detect");
        this._autoDetect = false;

        if (this._autoDetectInterval) {
            clearInterval(this._autoDetectInterval);
            this._autoDetectInterval = null;
        }
    }

    /**
     * Check if auto-detect is running
     */
    isAutoDetecting(): boolean {
        return this._autoDetect;
    }

    /**
     * Set detection probability (0.0 to 1.0)
     */
    setDetectionProbability(probability: number): void {
        this._detectionProbability = Math.max(0, Math.min(1, probability));
        console.log(`🎭 [Mock BLE] Detection probability set to ${this._detectionProbability}`);
    }

    /**
     * Set detection delay (milliseconds)
     */
    setDetectionDelay(delayMs: number): void {
        this._detectionDelayMs = Math.max(100, delayMs);
        console.log(`🎭 [Mock BLE] Detection delay set to ${this._detectionDelayMs}ms`);

        // Restart auto-detect with new delay if running
        if (this._autoDetect) {
            this.stopAutoDetect();
            this.startAutoDetect();
        }
    }

    /**
     * Generate mock raw sensor data
     */
    private generateMockRawData(detected: boolean): number[] {
        // Simulate realistic PIR sensor data
        // Format: [state, rssi, battery, ...]
        const state = detected ? 1 : 0;
        const rssi = Math.floor(Math.random() * 20) - 60; // -60 to -40 dBm
        const battery = 90 + Math.floor(Math.random() * 10); // 90-100%
        
        return [state, rssi, battery];
    }

    /**
     * Simulate sensor malfunction (for testing error handling)
     */
    simulateMalfunction(): void {
        if (!this._connected) {
            console.warn("🎭 [Mock BLE] Not connected, cannot simulate malfunction");
            return;
        }

        console.log("🎭 [Mock BLE] Simulating sensor malfunction!");
        this.emit('error', new Error("Sensor malfunction"));
        this.disconnect();
    }

    /**
     * Get mock status (for monitoring)
     */
    getStatus() {
        return {
            connected: this._connected,
            autoDetect: this._autoDetect,
            detectionProbability: this._detectionProbability,
            detectionDelayMs: this._detectionDelayMs,
        };
    }
}

// Export singleton instance
export const mockBleEventBus = new MockBleEventBus();
export default mockBleEventBus;
