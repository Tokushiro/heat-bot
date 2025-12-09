import { EventEmitter } from "events";
import {
    ISensorAPI,
    SensorConfig,
    DetectionResult,
    SensorStatus,
    DetectionZoneConfig
} from "../../interfaces/ISensorAPI";
import bleEventBus, { DetectionEvent } from "../../../services/core/BleEventBus";

/**
 * Mock Sensor API implementation for testing without real hardware
 * Simulates PIR motion sensor behavior with configurable detection zones
 *
 * Based on test specifications:
 * - Mounting height: 1.7m ± 0.05m (ambient sensor spec)
 * - Detection range: Configurable (typical 0-12m for PIR)
 * - Coverage: 360° or configurable zones
 * - Ambient conditions: 70% humidity required
 */
export class MockSensorAPI extends EventEmitter implements ISensorAPI {
    private static _instance: MockSensorAPI;
    private config: SensorConfig | null = null;
    private detecting: boolean = false;
    private connected: boolean = false;
    private lastDetection: string | null = null;

    // Simulation parameters
    private ambientTemp: number = 20;      // °C
    private humidity: number = 70;         // % (70% required per spec)
    private detectionZones: DetectionZoneConfig[] = [];

    // Auto-detection mode (automatically emit events based on position checks)
    private autoDetectionInterval: NodeJS.Timeout | null = null;
    private currentPosition: { x: number; y: number } | null = null;

    static get instance() {
        if (!this._instance) this._instance = new MockSensorAPI();
        return this._instance;
    }

    private constructor() {
        super();
        console.log("[MockSensor] Mock Sensor API initialized - Simulated detection zones will be used");
    }

    /**
     * Initialize mock sensor
     */
    async initialize(config: SensorConfig): Promise<boolean> {
        try {
            console.log(`[MockSensor] Initializing mock sensor: ${config.sensorId} (${config.mac})`);

            // Set default detection zones if not provided
            // More realistic detection range: 1m-10m with distance-based probability
            const defaultZones: DetectionZoneConfig[] = config.detectionZones || [
                {
                    minDistance: 1,
                    maxDistance: 10,      // Realistic PIR detection range (1-10m)
                    minAngle: 0,
                    maxAngle: 360,        // Full 360° coverage
                    detectionProbability: 0.70  // Base 70% detection probability (reduced for more realistic failures)
                }
            ];

            this.config = {
                ...config,
                mountingHeight: config.mountingHeight || 1.7, // 1.7m per spec
                detectionZones: defaultZones,
                ambientTemp: config.ambientTemp || this.ambientTemp,
                humidity: config.humidity || this.humidity
            };

            this.detectionZones = defaultZones;
            this.ambientTemp = this.config.ambientTemp!;
            this.humidity = this.config.humidity!;
            this.connected = true;

            console.log(`[MockSensor] Sensor initialized:`);
            console.log(`  - Mounting height: ${this.config.mountingHeight}m`);
            console.log(`  - Detection zones: ${this.detectionZones.length}`);
            console.log(`  - Ambient: ${this.ambientTemp}°C, ${this.humidity}% RH`);

            this.detectionZones.forEach((zone, idx) => {
                console.log(`  - Zone ${idx + 1}: ${zone.minDistance}-${zone.maxDistance}m, ${zone.minAngle}-${zone.maxAngle}°`);
            });

            this.emit("initialized", { sensorId: config.sensorId, mac: config.mac });
            return true;

        } catch (error) {
            console.error("[MockSensor] Initialization failed:", error);
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

        console.log("[MockSensor] Starting detection monitoring");
        this.detecting = true;
        this.emit("detection_started", { sensorId: this.config.sensorId });
    }

    /**
     * Stop detection monitoring
     */
    async stopDetection(): Promise<void> {
        console.log("[MockSensor] Stopping detection monitoring");
        this.detecting = false;

        if (this.autoDetectionInterval) {
            clearInterval(this.autoDetectionInterval);
            this.autoDetectionInterval = null;
        }

        this.emit("detection_stopped", { sensorId: this.config?.sensorId });
    }

    /**
     * Check if object at position would be detected
     * This is the core simulation logic
     */
    checkDetection(x: number, y: number): DetectionResult {
        if (!this.detecting || !this.config) {
            return {
                detected: false,
                timestamp: new Date().toISOString(),
                raw: [],
                confidence: 0
            };
        }

        // Calculate distance and angle from sensor (at origin)
        const distance = Math.sqrt(x * x + y * y);
        let angle = (Math.atan2(y, x) * 180) / Math.PI;
        if (angle < 0) angle += 360;

        // Check if position is within any detection zone
        let inZone = false;
        let zoneConfidence = 0;
        let matchedZone: DetectionZoneConfig | null = null;

        for (const zone of this.detectionZones) {
            const inDistanceRange = distance >= zone.minDistance && distance <= zone.maxDistance;
            const inAngleRange = this.isAngleInRange(angle, zone.minAngle, zone.maxAngle);

            if (inDistanceRange && inAngleRange) {
                inZone = true;
                matchedZone = zone;
                zoneConfidence = zone.detectionProbability || 0.80;
                break;
            }
        }

        // Apply distance-based probability falloff for more realistic detection
        // Detection probability decreases with distance
        let finalProbability = zoneConfidence;
        if (inZone && matchedZone) {
            const distanceRange = matchedZone.maxDistance - matchedZone.minDistance;
            const relativeDistance = (distance - matchedZone.minDistance) / distanceRange;

            // Steeper probability decrease: from 100% at minDistance to 50% at maxDistance
            // This creates more boundary detection challenges
            const distanceFactor = 1.0 - (relativeDistance * 0.5);
            finalProbability = zoneConfidence * distanceFactor;

            // Add environmental noise factors for more realism
            // Simulate temperature effects (PIR sensors are sensitive to ambient temperature)
            const tempNoise = 1.0 - Math.abs(this.ambientTemp - 20) * 0.01; // Optimal at 20°C

            // Simulate humidity effects (70% is optimal)
            const humidityNoise = 1.0 - Math.abs(this.humidity - 70) * 0.005; // Optimal at 70%

            finalProbability *= tempNoise * humidityNoise;

            // Add more random variation (±20%) to simulate real-world unpredictability
            // This includes: air currents, electrical noise, sensor warmup, etc.
            const randomVariation = 0.8 + (Math.random() * 0.4); // 0.8 to 1.2
            finalProbability *= randomVariation;

            // Add edge case unpredictability at boundary distances
            // When near the boundary (within 10% of range limits), add extra randomness
            if (relativeDistance < 0.1 || relativeDistance > 0.9) {
                const boundaryNoise = 0.7 + (Math.random() * 0.3); // 0.7 to 1.0 (always reduces)
                finalProbability *= boundaryNoise;
            }

            // Clamp between 0 and 1
            finalProbability = Math.max(0, Math.min(1, finalProbability));
        }

        // Simulate probabilistic detection with improved realism
        const detected = inZone && Math.random() < finalProbability;
        const timestamp = new Date().toISOString();

        // Generate mock raw data (simulating BLE payload)
        const raw = this.generateMockRawData(detected, distance, angle);

        const result: DetectionResult = {
            detected,
            timestamp,
            raw,
            confidence: inZone ? finalProbability : 0
            // NOTE: distance and angle are NOT included - these are calculated by test system
        };

        // Always emit to bleEventBus (same as real sensor) - both detected and not detected
        const bleEvent: DetectionEvent = {
            detected,
            timestamp,
            raw
        };

        if (detected) {
            this.lastDetection = timestamp;
            console.log(`[MockSensor] 🎯 DETECTION at (${x.toFixed(2)}, ${y.toFixed(2)}) - Distance: ${distance.toFixed(2)}m, Angle: ${angle.toFixed(1)}°, Probability: ${(finalProbability * 100).toFixed(1)}%`);
        } else if (inZone) {
            console.log(`[MockSensor] ❌ NO DETECTION at (${x.toFixed(2)}, ${y.toFixed(2)}) - Distance: ${distance.toFixed(2)}m, Angle: ${angle.toFixed(1)}°, Probability: ${(finalProbability * 100).toFixed(1)}% (failed)`);
        }

        bleEventBus.emit("detection", bleEvent);
        this.emit("detection", result);

        return result;
    }

    /**
     * Enable automatic detection based on position updates
     * Useful for continuous testing
     */
    enableAutoDetection(positionProvider: () => { x: number; y: number }, intervalMs: number = 100) {
        if (this.autoDetectionInterval) {
            clearInterval(this.autoDetectionInterval);
        }

        this.autoDetectionInterval = setInterval(() => {
            if (this.detecting) {
                const pos = positionProvider();
                this.checkDetection(pos.x, pos.y);
            }
        }, intervalMs);

        console.log(`[MockSensor] Auto-detection enabled (interval: ${intervalMs}ms)`);
    }

    /**
     * Disable automatic detection
     */
    disableAutoDetection() {
        if (this.autoDetectionInterval) {
            clearInterval(this.autoDetectionInterval);
            this.autoDetectionInterval = null;
            console.log("[MockSensor] Auto-detection disabled");
        }
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

        if (config.detectionZones) {
            this.detectionZones = config.detectionZones;
        }
        if (config.ambientTemp !== undefined) {
            this.ambientTemp = config.ambientTemp;
        }
        if (config.humidity !== undefined) {
            this.humidity = config.humidity;
        }

        console.log("[MockSensor] Configuration updated");
        this.emit("config_updated", this.config);
    }

    /**
     * Get current sensor status
     */
    async getStatus(): Promise<SensorStatus> {
        return {
            connected: this.connected,
            detecting: this.detecting,
            sensorId: this.config?.sensorId || "mock-sensor",
            mac: this.config?.mac || "00:00:00:00:00:00",
            ambientTemp: this.ambientTemp,
            humidity: this.humidity,
            lastDetection: this.lastDetection || undefined
        };
    }

    /**
     * Get ambient conditions
     */
    async getAmbientConditions(): Promise<{ temperature: number; humidity: number }> {
        return {
            temperature: this.ambientTemp,
            humidity: this.humidity
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
        console.log("[MockSensor] Disconnecting mock sensor");

        if (this.detecting) {
            await this.stopDetection();
        }

        this.connected = false;
        this.config = null;
        this.emit("disconnected");
    }

    /**
     * Helper: Check if angle is within range (handles wraparound)
     */
    private isAngleInRange(angle: number, minAngle: number, maxAngle: number): boolean {
        if (minAngle <= maxAngle) {
            // Normal range (e.g., 0° to 180°)
            return angle >= minAngle && angle <= maxAngle;
        } else {
            // Wraparound range (e.g., 350° to 10°)
            return angle >= minAngle || angle <= maxAngle;
        }
    }

    /**
     * Generate mock raw BLE data
     * Simulates the hex payload that would come from real sensor
     */
    private generateMockRawData(detected: boolean, distance: number, angle: number): number[] {
        // Simulate realistic BLE payload structure
        // [header, detection_flag, distance_hi, distance_lo, angle_hi, angle_lo, checksum]

        const distanceInt = Math.floor(distance * 100); // cm
        const angleInt = Math.floor(angle * 10);        // tenths of degree

        return [
            0xAA,                           // Header
            detected ? 0x01 : 0x00,        // Detection flag
            (distanceInt >> 8) & 0xFF,     // Distance high byte
            distanceInt & 0xFF,            // Distance low byte
            (angleInt >> 8) & 0xFF,        // Angle high byte
            angleInt & 0xFF,               // Angle low byte
            0xFF                           // Checksum (simplified)
        ];
    }

    /**
     * Add a detection zone dynamically
     */
    addDetectionZone(zone: DetectionZoneConfig): void {
        this.detectionZones.push(zone);
        console.log(`[MockSensor] Added detection zone: ${zone.minDistance}-${zone.maxDistance}m, ${zone.minAngle}-${zone.maxAngle}°`);
    }

    /**
     * Clear all detection zones
     */
    clearDetectionZones(): void {
        this.detectionZones = [];
        console.log("[MockSensor] All detection zones cleared");
    }

    /**
     * Simulate environmental conditions change
     */
    setAmbientConditions(temperature: number, humidity: number): void {
        this.ambientTemp = temperature;
        this.humidity = humidity;
        console.log(`[MockSensor] Ambient conditions updated: ${temperature}°C, ${humidity}% RH`);
        this.emit("ambient_updated", { temperature, humidity });
    }
}

export default MockSensorAPI;
