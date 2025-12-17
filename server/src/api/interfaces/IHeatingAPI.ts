
export interface IHeatingAPI {
    /**
     * Initialize the heating system
     * - Establishes connection to heating hardware
     * - Verifies all zones are operational
     * - Reads ambient temperature for baseline
     *
     * @throws Error if connection fails or zones are not responsive
     */
    initialize(): Promise<void>;

    /**
     * Set target temperature for a specific zone
     *
     * @param zone - The heating zone to control
     * @param targetTemp - Target temperature in °C (absolute, not offset)
     *
     * @returns Promise that resolves when target is set
     * @throws Error if zone is invalid or temperature is out of safe range
     */
    setTargetTemperature(zone: HeatingZone, targetTemp: number): Promise<void>;

    /**
     * Set target temperature offset from ambient
     * This is the preferred method for compliance testing
     *
     * @param zone - The heating zone to control
     * @param offset - Temperature offset in °C (+14°C for head, +7°C for body/legs)
     *
     * @returns Promise that resolves when target is set
     */
    setTemperatureOffset(zone: HeatingZone, offset: number): Promise<void>;

    /**
     * Get current temperature for a zone
     *
     * @param zone - The heating zone to read
     * @returns Current temperature in °C
     */
    getCurrentTemperature(zone: HeatingZone): number;

    /**
     * Get target temperature for a zone
     *
     * @param zone - The heating zone to check
     * @returns Target temperature in °C
     */
    getTargetTemperature(zone: HeatingZone): number;

    /**
     * Enable heating for a specific zone
     *
     * @param zone - The heating zone to enable
     * @returns Promise that resolves when heating is enabled
     */
    enableHeating(zone: HeatingZone): Promise<void>;

    /**
     * Disable heating for a specific zone
     *
     * @param zone - The heating zone to disable
     * @returns Promise that resolves when heating is disabled
     */
    disableHeating(zone: HeatingZone): Promise<void>;

    /**
     * Enable all heating zones
     *
     * @returns Promise that resolves when all zones are enabled
     */
    enableAllZones(): Promise<void>;

    /**
     * Disable all heating zones
     *
     * @returns Promise that resolves when all zones are disabled
     */
    disableAllZones(): Promise<void>;

    /**
     * Get status of a specific zone
     *
     * @param zone - The heating zone to check
     * @returns Zone status with temperature and state information
     */
    getZoneStatus(zone: HeatingZone): HeatingZoneStatus;

    /**
     * Get status of all zones
     *
     * @returns Array of all zone statuses
     */
    getAllZoneStatus(): HeatingZoneStatus[];

    /**
     * Get overall heating system status
     *
     * @returns System status with connection and zone information
     */
    getSystemStatus(): HeatingSystemStatus;

    /**
     * Set ambient temperature baseline
     * Used by mock implementation or when external ambient sensor is available
     *
     * @param temp - Ambient temperature in °C
     */
    setAmbientTemperature(temp: number): void;

    /**
     * Get current ambient temperature
     *
     * @returns Ambient temperature in °C
     */
    getAmbientTemperature(): number;

    /**
     * Check if heating system is ready
     *
     * @returns true if system is initialized and operational
     */
    isReady(): boolean;

    /**
     * Disconnect from heating system
     */
    disconnect(): Promise<void>;
}

/**
 * Heating zone identifiers
 */
export type HeatingZone = 'HEAD' | 'BODY' | 'LEGS';

/**
 * Heating zone status
 */
export interface HeatingZoneStatus {
    zone: HeatingZone;
    enabled: boolean;
    currentTemp: number;
    targetTemp: number;
    targetOffset: number;
    status: 'HEATING' | 'IDLE' | 'AT_TARGET' | 'ERROR';
    powerLevel?: number; // 0-100%
    lastError?: string;
    lastUpdateTime: Date;

    // Temperature statistics (for monitoring)
    minTemp?: number;
    maxTemp?: number;
    avgTemp?: number;
}

/**
 * Overall heating system status
 */
export interface HeatingSystemStatus {
    connected: boolean;
    initialized: boolean;
    ambientTemp: number;
    zones: HeatingZoneStatus[];
    allZonesEnabled: boolean;
    lastError?: string;
    lastUpdateTime: Date;
}

/**
 * Heating system configuration
 */
export interface HeatingConfig {
    /** Communication port or address */
    port?: string;

    /** Default temperature offsets per zone */
    headOffset?: number;    // Default: +14°C
    bodyOffset?: number;    // Default: +7°C
    legsOffset?: number;    // Default: +7°C

    /** Temperature limits for safety */
    minTemp?: number;       // Default: 15°C
    maxTemp?: number;       // Default: 50°C

    /** PID control parameters (optional) */
    pidKp?: number;
    pidKi?: number;
    pidKd?: number;

    /** Update interval in milliseconds */
    updateInterval?: number; // Default: 1000ms
}

/**
 * Standard temperature offsets per EN 50131
 */
export const STANDARD_TEMP_OFFSETS = {
    HEAD: 14,  // °C above ambient
    BODY: 7,   // °C above ambient
    LEGS: 7    // °C above ambient
} as const;
