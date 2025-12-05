import { EventEmitter } from "events";

/**
 * Detection zone configuration for simulating sensor behavior
 */
export interface DetectionZoneConfig {
    minDistance: number;        // Minimum detection distance (meters)
    maxDistance: number;        // Maximum detection distance (meters)
    minAngle: number;          // Minimum detection angle (degrees, 0-360)
    maxAngle: number;          // Maximum detection angle (degrees, 0-360)
    detectionProbability?: number; // 0-1, probability of detection in zone (default 0.95)
}

/**
 * Sensor configuration
 */
export interface SensorConfig {
    sensorId: string;
    mac: string;
    mountingHeight?: number;    // Height in meters (default 1.7m per spec)
    detectionZones?: DetectionZoneConfig[];
    ambientTemp?: number;       // Ambient temperature (°C)
    humidity?: number;          // Humidity percentage (70% required per spec)
}

/**
 * Detection result
 */
export interface DetectionResult {
    detected: boolean;
    timestamp: string;
    raw: number[];
    confidence?: number;        // 0-1, detection confidence
    distance?: number;          // Estimated distance (if available)
    angle?: number;            // Estimated angle (if available)
}

/**
 * Sensor status
 */
export interface SensorStatus {
    connected: boolean;
    detecting: boolean;
    sensorId: string;
    mac: string;
    ambientTemp?: number;
    humidity?: number;
    lastDetection?: string;
}

/**
 * Interface for Sensor API - both real and mock implementations
 */
export interface ISensorAPI extends EventEmitter {
    /**
     * Initialize sensor connection
     */
    initialize(config: SensorConfig): Promise<boolean>;

    /**
     * Start detection monitoring
     */
    startDetection(): Promise<void>;

    /**
     * Stop detection monitoring
     */
    stopDetection(): Promise<void>;

    /**
     * Check if object at position would be detected
     * (Used by mock to simulate detection based on robot position)
     */
    checkDetection(x: number, y: number): DetectionResult;

    /**
     * Update sensor configuration
     */
    updateConfig(config: Partial<SensorConfig>): Promise<void>;

    /**
     * Get current sensor status
     */
    getStatus(): Promise<SensorStatus>;

    /**
     * Get ambient conditions
     */
    getAmbientConditions(): Promise<{ temperature: number; humidity: number }>;

    /**
     * Check if sensor is currently detecting
     */
    isDetecting(): boolean;

    /**
     * Disconnect sensor
     */
    disconnect(): Promise<void>;
}
