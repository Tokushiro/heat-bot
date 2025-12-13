/**
 * Environment Sensor API Interface
 *
 * Provides abstraction for monitoring ambient environmental conditions.
 * Tracks temperature and humidity for compliance testing per EN 50131 requirements.
 *
 * IEC/EN Requirements:
 * - Temperature: Typically 15-35°C operating range
 * - Humidity: ~70% RH optimal for PIR sensors (per EN 50131)
 * - Monitoring interval: Continuous during testing
 *
 * Used for:
 * - Recording ambient conditions during tests
 * - Adjusting heating system targets (ambient + offset)
 * - Environmental compliance verification
 * - Correlation with sensor performance
 */

export interface IEnvironmentAPI {
    /**
     * Initialize the environment monitoring system
     * - Establishes connection to sensors
     * - Calibrates sensors if needed
     * - Starts continuous monitoring
     *
     * @throws Error if sensors cannot be initialized
     */
    initialize(): Promise<void>;

    /**
     * Get current ambient temperature
     *
     * @returns Temperature in °C
     */
    getTemperature(): number;

    /**
     * Get current relative humidity
     *
     * @returns Humidity in % (0-100)
     */
    getHumidity(): number;

    /**
     * Get complete environmental reading
     *
     * @returns Reading with temperature, humidity, and timestamp
     */
    getReading(): EnvironmentReading;

    /**
     * Get historical readings
     *
     * @param count Number of recent readings to retrieve
     * @returns Array of recent readings
     */
    getHistory(count: number): EnvironmentReading[];

    /**
     * Start continuous monitoring
     * Records samples at specified interval
     *
     * @param interval Sampling interval in milliseconds (default: 1000ms)
     * @param callback Optional callback for each new reading
     */
    startMonitoring(
        interval?: number,
        callback?: (reading: EnvironmentReading) => void
    ): void;

    /**
     * Stop continuous monitoring
     */
    stopMonitoring(): void;

    /**
     * Check if monitoring is active
     *
     * @returns true if continuous monitoring is running
     */
    isMonitoring(): boolean;

    /**
     * Get sensor status
     *
     * @returns Status object with connection and calibration info
     */
    getStatus(): EnvironmentStatus;

    /**
     * Set temperature calibration offset
     * Used to correct sensor readings
     *
     * @param offset Offset in °C (added to raw reading)
     */
    setTemperatureOffset(offset: number): void;

    /**
     * Set humidity calibration offset
     * Used to correct sensor readings
     *
     * @param offset Offset in % RH (added to raw reading)
     */
    setHumidityOffset(offset: number): void;

    /**
     * Check if environment is ready for testing
     * Verifies conditions are within acceptable ranges
     *
     * @returns Validation result with any issues
     */
    validateConditions(): EnvironmentValidation;

    /**
     * Check if system is ready
     *
     * @returns true if initialized and operational
     */
    isReady(): boolean;

    /**
     * Disconnect from sensors
     */
    disconnect(): Promise<void>;
}

/**
 * Environmental reading
 */
export interface EnvironmentReading {
    temperature: number;    // °C
    humidity: number;       // % RH
    timestamp: Date;

    // Optional detailed data
    temperatureRaw?: number;
    humidityRaw?: number;
    pressure?: number;      // Optional barometric pressure (hPa)
    dewPoint?: number;      // Optional calculated dew point (°C)
}

/**
 * Environment sensor status
 */
export interface EnvironmentStatus {
    connected: boolean;
    initialized: boolean;
    monitoring: boolean;

    currentTemperature: number;
    currentHumidity: number;

    temperatureOffset: number;
    humidityOffset: number;

    sampleCount: number;
    lastSampleTime?: Date;

    lastError?: string;
}

/**
 * Environment validation result
 */
export interface EnvironmentValidation {
    valid: boolean;
    temperature: ValidationResult;
    humidity: ValidationResult;
    warnings: string[];
}

/**
 * Single parameter validation
 */
export interface ValidationResult {
    value: number;
    valid: boolean;
    min?: number;
    max?: number;
    optimal?: number;
    message?: string;
}

/**
 * Environment sensor configuration
 */
export interface EnvironmentConfig {
    /** Communication port or address */
    port?: string;

    /** Sensor type (DHT22, BME280, etc.) */
    sensorType?: string;

    /** Sampling interval in milliseconds */
    samplingInterval?: number;

    /** Temperature calibration offset */
    tempOffset?: number;

    /** Humidity calibration offset */
    humidityOffset?: number;

    /** Acceptable temperature range */
    tempMin?: number;
    tempMax?: number;
    tempOptimal?: number;

    /** Acceptable humidity range */
    humidityMin?: number;
    humidityMax?: number;
    humidityOptimal?: number;
}

/**
 * Standard environmental limits per EN 50131
 */
export const STANDARD_ENVIRONMENT_LIMITS = {
    TEMPERATURE: {
        MIN: 15,        // °C - Minimum operating temperature
        MAX: 35,        // °C - Maximum operating temperature
        OPTIMAL: 20     // °C - Optimal temperature
    },
    HUMIDITY: {
        MIN: 50,        // % RH - Minimum acceptable humidity
        MAX: 90,        // % RH - Maximum acceptable humidity
        OPTIMAL: 70     // % RH - Optimal humidity per EN 50131
    }
} as const;
