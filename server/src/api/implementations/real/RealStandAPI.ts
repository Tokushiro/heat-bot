import { IStandAPI, StandStatus, StandConfig } from '../../interfaces/IStandAPI';
import { SerialManager } from '../../../services/core/SerialManager';

/**
 * Real Stand Controller
 *
 * Controls the rotating detector stand via SerialManager.
 * All commands are sent through the single serial connection.
 *
 * Commands follow the format: stand_<command>[:<params>]
 * See SERIAL_PROTOCOL_SPECIFICATION.md for details.
 */
export class RealStandAPI implements IStandAPI {
    private static instance: RealStandAPI;
    private serialManager: SerialManager;

    private connected: boolean = false;
    private initialized: boolean = false;
    private currentAngle: number = 0;
    private targetAngle: number = 0;
    private moving: boolean = false;
    private calibrated: boolean = false;
    private lastError: string | undefined;

    private config: Required<StandConfig> = {
        port: process.env.STAND_SERIAL_PORT || '/dev/ttyUSB0',
        rotationSpeed: 30,
        defaultStepSize: 5,
        zeroAngleOffset: 0
    };

    private constructor() {
        this.serialManager = SerialManager.instance;
        console.log('[RealStand] Real stand controller created');
        console.log('[RealStand] Using SerialManager for communication');
    }

    /**
     * Get singleton instance
     */
    public static getInstance(): RealStandAPI {
        if (!RealStandAPI.instance) {
            RealStandAPI.instance = new RealStandAPI();
        }
        return RealStandAPI.instance;
    }

    /**
     * Send command via SerialManager and parse JSON response
     */
    private async sendCommand(command: string): Promise<any> {
        try {
            const response = await this.serialManager.sendCommand(command);

            // Parse JSON response
            const data = JSON.parse(response);

            if (data.status === 'error') {
                throw new Error(data.error || 'Unknown error from hardware');
            }

            return data.data;
        } catch (error) {
            console.error(`[RealStand] Command failed: ${command}`, error);
            this.lastError = error instanceof Error ? error.message : 'Unknown error';
            throw error;
        }
    }

    /**
     * Initialize the stand
     */
    async initialize(): Promise<void> {
        console.log('[RealStand] Initializing real stand...');

        try {
            // Ensure SerialManager is connected
            if (!this.serialManager.connected) {
                await this.serialManager.connect(process.env.ROBOT_SERIAL_PORT || '/dev/ttyUSB0', 115200);
            }

            // Get current status
            const response = await this.sendCommand('stand_status');
            console.log('[RealStand] Initialization response:', response);

            this.connected = response.connected;
            this.initialized = response.initialized;
            this.currentAngle = response.currentAngle || 0;
            this.targetAngle = response.targetAngle || 0;
            this.moving = response.moving || false;
            this.calibrated = response.calibrated || false;

            console.log('[RealStand] ✓ Stand initialized');
        } catch (error) {
            this.lastError = error instanceof Error ? error.message : 'Unknown error';
            console.error('[RealStand] Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Set detector angle
     */
    async setDetectorAngle(theta: number): Promise<void> {
        // Normalize angle to 0-360
        theta = ((theta % 360) + 360) % 360;

        console.log(`[RealStand] Setting detector angle to ${theta}°`);

        try {
            const response = await this.sendCommand(`stand_set_angle:${theta}`);
            console.log(`[RealStand] Set angle response:`, response);

            this.targetAngle = theta;
            this.currentAngle = response.currentAngle || theta;
            this.moving = response.moving || false;
        } catch (error) {
            console.error(`[RealStand] Failed to set angle:`, error);
            throw error;
        }
    }

    /**
     * Step detector angle by delta degrees
     */
    async stepDetectorAngle(delta: number): Promise<void> {
        const newAngle = this.currentAngle + delta;
        await this.setDetectorAngle(newAngle);
    }

    /**
     * Get current detector angle (returns cached value)
     */
    getCurrentAngle(): number {
        return this.currentAngle;
    }

    /**
     * Update current angle from hardware (internal helper)
     */
    private async refreshAngle(): Promise<void> {
        try {
            const response = await this.sendCommand('stand_get_angle');
            this.currentAngle = response.angle;
            this.moving = response.moving || false;
            this.targetAngle = response.targetAngle || this.currentAngle;
        } catch (error) {
            console.error('[RealStand] Failed to get angle:', error);
            throw error;
        }
    }

    /**
     * Calibrate zero angle (home position)
     */
    async calibrateZeroAngle(): Promise<void> {
        console.log('[RealStand] Calibrating zero angle...');

        try {
            const response = await this.sendCommand('stand_home');
            console.log('[RealStand] Calibration response:', response);

            this.currentAngle = 0;
            this.targetAngle = 0;
            this.calibrated = response.calibrated || true;
            this.moving = false;

            console.log('[RealStand] ✓ Zero angle calibrated');
        } catch (error) {
            console.error('[RealStand] Calibration failed:', error);
            throw error;
        }
    }

    /**
     * Get stand status (returns cached values)
     */
    getStatus(): StandStatus {
        return {
            connected: this.connected,
            initialized: this.initialized,
            currentAngle: this.currentAngle,
            isMoving: this.moving,
            lastError: this.lastError,
            lastUpdateTime: new Date()
        };
    }

    /**
     * Refresh status from hardware (internal helper)
     */
    private async refreshStatus(): Promise<void> {
        try {
            const response = await this.sendCommand('stand_status');

            this.connected = response.connected;
            this.initialized = response.initialized;
            this.currentAngle = response.currentAngle;
            this.targetAngle = response.targetAngle;
            this.moving = response.moving;
            this.calibrated = response.calibrated;
            this.lastError = response.lastError;
        } catch (error) {
            console.error('[RealStand] Failed to refresh status:', error);
            this.connected = false;
            this.initialized = false;
            this.lastError = error instanceof Error ? error.message : 'Unknown error';
        }
    }

    /**
     * Check if stand is ready
     */
    isReady(): boolean {
        return this.connected && this.initialized && !this.moving;
    }

    /**
     * Check if stand is moving
     */
    isMoving(): boolean {
        return this.moving;
    }

    /**
     * Disconnect from hardware
     */
    async disconnect(): Promise<void> {
        console.log('[RealStand] Disconnecting...');
        this.connected = false;
        this.initialized = false;
    }

    /**
     * Update configuration
     */
    updateConfig(config: Partial<StandConfig>): void {
        this.config = { ...this.config, ...config };
        console.log('[RealStand] Configuration updated:', this.config);
    }
}

// Export singleton instance getter
export const getRealStandAPI = () => RealStandAPI.getInstance();
