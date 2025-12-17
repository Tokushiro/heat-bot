import { EventEmitter } from "events";

/**
 * Detection zone configuration for simulating sensor behavior
 */
export interface DetectionZoneConfig {
    minDistance: number;
    maxDistance: number;
    minAngle: number;
    maxAngle: number;
    detectionProbability?: number;
}

/**
 * Sensor configuration
 */
export interface SensorConfig {
    sensorId: string;
    mac: string;
    mountingHeight?: number;
    detectionZones?: DetectionZoneConfig[];
    ambientTemp?: number;
    humidity?: number;
}

/**
 * Detection result
 */
export interface DetectionResult {
    detected: boolean;
    timestamp: string;
    raw: number[];
    confidence?: number;
    distance?: number;
    angle?: number;
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
