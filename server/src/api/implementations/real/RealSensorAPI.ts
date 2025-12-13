import { EventEmitter } from "events";
import {
    ISensorAPI,
    SensorConfig,
    DetectionResult,
    SensorStatus
} from "../../interfaces/ISensorAPI";
import bleEventBus, { DetectionEvent } from "../../../services/core/BleEventBus";

/**
 * Real Sensor API implementation
 * Wraps the existing BLE event system for PIR motion sensors
 * Receives detection events from external BLE hardware via HTTP endpoint
 */
export class RealSensorAPI extends EventEmitter implements ISensorAPI {
    private static _instance: RealSensorAPI;
    private config: SensorConfig | null = null;
    private detecting: boolean = false;
    private connected: boolean = false;
    private lastDetection: string | null = null;

    static get instance() {
        if (!this._instance) this._instance = new RealSensorAPI();
        return this._instance;
    }

    private constructor() {
        super();
        this.setupBleEventListener();
    }

    /**
     * Listen to BLE events from bleEventBus and forward them
     */
    private setupBleEventListener() {
        bleEventBus.on("detection", (event: DetectionEvent) => {
            if (this.detecting && this.config) {
                this.lastDetection = event.timestamp;

                const detectionResult: DetectionResult = {
                    detected: event.detected,
                    timestamp: event.timestamp,
                    raw: event.raw
                };

                console.log(`[RealSensor] Detection event: ${event.detected ? 'DETECTED' : 'NO DETECTION'}`);

                // Re-emit for listeners
                this.emit("detection", detectionResult);
            }
        });
    }

    /**
     * Initialize sensor connection
     * For real sensor, this just configures - actual connection happens via BLE hardware
     */
    async initialize(config: SensorConfig): Promise<boolean> {
        try {
            console.log(`[RealSensor] Initializing sensor: ${config.sensorId} (${config.mac})`);

            this.config = {
                ...config,
                mountingHeight: config.mountingHeight || 1.7, // Default per spec
                ambientTemp: config.ambientTemp || 20,
                humidity: config.humidity || 70 // 70% required per spec
            };

            // In real implementation, would check if BLE device is reachable
            // For now, we assume if MAC is configured, it's available
            this.connected = true;

            console.log(`[RealSensor] Sensor initialized at height ${this.config.mountingHeight}m`);
            this.emit("initialized", { sensorId: config.sensorId, mac: config.mac });

            return true;
        } catch (error) {
            console.error("[RealSensor] Initialization failed:", error);
            this.emit("error", { type: "initialization", error });
            return false;
        }
    }

    /**
     * Start detection monitoring
     */
    async startDetection(): Promise<void> {
        if (!this.connected || !this.config) {
            throw new Error("Sensor not initialized");
        }

        console.log("[RealSensor] Starting detection monitoring");
        this.detecting = true;
        this.emit("detection_started", { sensorId: this.config.sensorId });
    }

    /**
     * Stop detection monitoring
     */
    async stopDetection(): Promise<void> {
        console.log("[RealSensor] Stopping detection monitoring");
        this.detecting = false;
        this.emit("detection_stopped", { sensorId: this.config?.sensorId });
    }

    /**
     * Check detection at position (not applicable for real sensor)
     * Real sensor detects via BLE events from hardware
     */
    checkDetection(_x: number, _y: number): DetectionResult {
        throw new Error("checkDetection() not applicable for real sensor - detections come from hardware");
    }

    /**
     * Update sensor configuration
     */
    async updateConfig(config: Partial<SensorConfig>): Promise<void> {
        if (!this.config) {
            throw new Error("Sensor not initialized");
        }

        this.config = {
            ...this.config,
            ...config
        };

        console.log("[RealSensor] Configuration updated");
        this.emit("config_updated", this.config);
    }

    /**
     * Get current sensor status
     */
    async getStatus(): Promise<SensorStatus> {
        return {
            connected: this.connected,
            detecting: this.detecting,
            sensorId: this.config?.sensorId || "unknown",
            mac: this.config?.mac || "unknown",
            ambientTemp: this.config?.ambientTemp,
            humidity: this.config?.humidity,
            lastDetection: this.lastDetection || undefined
        };
    }

    /**
     * Get ambient conditions
     */
    async getAmbientConditions(): Promise<{ temperature: number; humidity: number }> {
        return {
            temperature: this.config?.ambientTemp || 20,
            humidity: this.config?.humidity || 70
        };
    }

    /**
     * Check if currently detecting
     */
    isDetecting(): boolean {
        return this.detecting;
    }

    /**
     * Disconnect sensor
     */
    async disconnect(): Promise<void> {
        console.log("[RealSensor] Disconnecting sensor");

        if (this.detecting) {
            await this.stopDetection();
        }

        this.connected = false;
        this.config = null;
        this.emit("disconnected");
    }
}

export default RealSensorAPI;
