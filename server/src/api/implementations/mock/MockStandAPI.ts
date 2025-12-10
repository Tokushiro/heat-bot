import { IStandAPI, StandStatus, StandConfig } from '../../interfaces/IStandAPI';

/**
 * Mock Stand Controller
 *
 * Simulates a rotating stand for the PIR detector without requiring real hardware.
 * Used for development, testing, and demonstration purposes.
 *
 * Features:
 * - Instant angle changes (simulated movement time)
 * - Angle wrapping (0-360° range)
 * - Calibration simulation
 * - Status tracking
 */
export class MockStandAPI implements IStandAPI {
    private static instance: MockStandAPI;

    private connected: boolean = false;
    private initialized: boolean = false;
    private currentAngle: number = 0;
    private isMoving: boolean = false;
    private zeroOffset: number = 0;
    private lastError: string | undefined;
    private lastUpdateTime: Date = new Date();

    // Configuration
    private config: Required<StandConfig> = {
        port: 'MOCK',
        rotationSpeed: 30, // degrees per second
        defaultStepSize: 5, // degrees
        zeroAngleOffset: 0
    };

    private constructor() {
        console.log('[MockStand] Mock stand controller created');
    }

    /**
     * Get singleton instance
     */
    public static getInstance(): MockStandAPI {
        if (!MockStandAPI.instance) {
            MockStandAPI.instance = new MockStandAPI();
        }
        return MockStandAPI.instance;
    }

    /**
     * Initialize the mock stand
     */
    async initialize(): Promise<void> {
        console.log('[MockStand] Initializing mock stand controller...');

        // Simulate connection delay
        await this.delay(500);

        this.connected = true;

        // Home to 0° reference
        console.log('[MockStand] Homing stand to 0° reference...');
        await this.delay(1000);

        this.currentAngle = 0;
        this.initialized = true;
        this.lastUpdateTime = new Date();

        console.log('[MockStand] ✅ Stand initialized and homed to 0°');
    }

    /**
     * Set detector to specific angle
     */
    async setDetectorAngle(angle: number): Promise<void> {
        if (!this.initialized) {
            throw new Error('Stand not initialized. Call initialize() first.');
        }

        if (angle < 0 || angle >= 360) {
            throw new Error(`Invalid angle: ${angle}. Must be between 0 and 360.`);
        }

        const previousAngle = this.currentAngle;
        const angleDelta = this.calculateShortestRotation(previousAngle, angle);
        const rotationTime = Math.abs(angleDelta) / this.config.rotationSpeed;

        console.log(`[MockStand] Rotating from ${previousAngle.toFixed(1)}° to ${angle.toFixed(1)}° (${angleDelta.toFixed(1)}° rotation)`);

        this.isMoving = true;
        this.lastUpdateTime = new Date();

        // Simulate rotation time
        await this.delay(rotationTime * 1000);

        this.currentAngle = this.normalizeAngle(angle);
        this.isMoving = false;
        this.lastUpdateTime = new Date();

        console.log(`[MockStand] ✅ Reached target angle: ${this.currentAngle.toFixed(1)}°`);
    }

    /**
     * Step detector angle by delta
     */
    async stepDetectorAngle(delta: number): Promise<void> {
        if (!this.initialized) {
            throw new Error('Stand not initialized. Call initialize() first.');
        }

        const newAngle = this.normalizeAngle(this.currentAngle + delta);

        console.log(`[MockStand] Stepping ${delta > 0 ? '+' : ''}${delta.toFixed(1)}° (${this.currentAngle.toFixed(1)}° → ${newAngle.toFixed(1)}°)`);

        await this.setDetectorAngle(newAngle);
    }

    /**
     * Get current detector angle
     */
    getCurrentAngle(): number {
        return this.currentAngle;
    }

    /**
     * Calibrate zero angle reference
     */
    async calibrateZeroAngle(): Promise<void> {
        if (!this.initialized) {
            throw new Error('Stand not initialized. Call initialize() first.');
        }

        console.log(`[MockStand] Calibrating zero reference at current position (${this.currentAngle.toFixed(1)}°)`);

        this.zeroOffset = this.currentAngle;
        this.currentAngle = 0;
        this.lastUpdateTime = new Date();

        console.log('[MockStand] ✅ Zero angle calibrated');
    }

    /**
     * Check if stand is ready
     */
    isReady(): boolean {
        return this.connected && this.initialized && !this.isMoving;
    }

    /**
     * Get stand status
     */
    getStatus(): StandStatus {
        return {
            connected: this.connected,
            initialized: this.initialized,
            currentAngle: this.currentAngle,
            isMoving: this.isMoving,
            lastError: this.lastError,
            lastUpdateTime: this.lastUpdateTime
        };
    }

    /**
     * Disconnect from stand
     */
    async disconnect(): Promise<void> {
        console.log('[MockStand] Disconnecting from stand...');

        this.isMoving = false;
        this.initialized = false;
        this.connected = false;
        this.lastUpdateTime = new Date();

        console.log('[MockStand] ✅ Disconnected');
    }

    /**
     * Update configuration
     */
    updateConfig(config: Partial<StandConfig>): void {
        this.config = { ...this.config, ...config };
        if (config.zeroAngleOffset !== undefined) {
            this.zeroOffset = config.zeroAngleOffset;
        }
        console.log('[MockStand] Configuration updated:', this.config);
    }

    // Helper methods

    /**
     * Normalize angle to 0-360 range
     */
    private normalizeAngle(angle: number): number {
        let normalized = angle % 360;
        if (normalized < 0) {
            normalized += 360;
        }
        return normalized;
    }

    /**
     * Calculate shortest rotation direction
     * Returns signed angle delta (-180 to +180)
     */
    private calculateShortestRotation(from: number, to: number): number {
        let delta = to - from;

        // Normalize to -180 to +180 range
        while (delta > 180) delta -= 360;
        while (delta < -180) delta += 360;

        return delta;
    }

    /**
     * Simulate delay (for rotation time)
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Reset for testing
     */
    reset(): void {
        this.connected = false;
        this.initialized = false;
        this.currentAngle = 0;
        this.isMoving = false;
        this.zeroOffset = 0;
        this.lastError = undefined;
        this.lastUpdateTime = new Date();
        console.log('[MockStand] Stand reset to initial state');
    }
}

// Export singleton instance getter
export const getMockStandAPI = () => MockStandAPI.getInstance();
