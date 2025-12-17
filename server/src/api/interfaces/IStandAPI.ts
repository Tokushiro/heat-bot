export interface IStandAPI {
    /**
     * Initialize the stand controller
     * - Establishes connection to stand hardware
     * - Homes the stand to 0° reference position
     * - Verifies stand is ready for operation
     *
     * @throws Error if connection fails or stand cannot be homed
     */
    initialize(): Promise<void>;

    /**
     * Set the detector to a specific angle
     *
     * @param angle - Target angle in degrees (0-360°)
     *                0° = reference direction (e.g., pointing north/front)
     *                Angles increase clockwise when viewed from above
     *
     * @returns Promise that resolves when movement is complete
     * @throws Error if angle is out of range or movement fails
     */
    setDetectorAngle(angle: number): Promise<void>;

    /**
     * Step the detector angle by a delta amount
     * Useful for manual control with +/- buttons
     *
     * @param delta - Angle change in degrees (can be positive or negative)
     *                Common values: ±2.5°, ±5°, ±10°
     *                Result will be wrapped to 0-360° range
     *
     * @returns Promise that resolves when movement is complete
     * @throws Error if movement fails
     */
    stepDetectorAngle(delta: number): Promise<void>;

    /**
     * Get the current detector angle
     *
     * @returns Current angle in degrees (0-360°)
     */
    getCurrentAngle(): number;

    /**
     * Calibrate the zero angle reference
     * Sets the current position as 0° reference
     * Used during initial setup or when stand position is reset
     *
     * @returns Promise that resolves when calibration is complete
     */
    calibrateZeroAngle(): Promise<void>;

    /**
     * Check if the stand is ready for operation
     *
     * @returns true if stand is initialized and ready to accept commands
     */
    isReady(): boolean;

    /**
     * Get the stand status
     *
     * @returns Status object with connection, position, and error info
     */
    getStatus(): StandStatus;

    /**
     * Disconnect from the stand hardware
     * Called during shutdown or error recovery
     */
    disconnect(): Promise<void>;
}

/**
 * Stand status information
 */
export interface StandStatus {
    connected: boolean;
    initialized: boolean;
    currentAngle: number;
    isMoving: boolean;
    lastError?: string;
    lastUpdateTime: Date;
}

/**
 * Stand configuration
 */
export interface StandConfig {
    /** Communication port or address */
    port?: string;

    /** Rotation speed in degrees per second */
    rotationSpeed?: number;

    /** Step size for manual control (degrees) */
    defaultStepSize?: number;

    /** Zero angle offset calibration (degrees) */
    zeroAngleOffset?: number;
}
