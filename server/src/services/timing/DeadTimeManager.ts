/**
 * Dead Time Manager
 *
 * Manages required delays and timing constraints during testing to ensure:
 * - Sensor recovery time (PIR sensors need time to reset)
 * - IEC compliance (minimum intervals between measurements)
 * - Mechanical settling time (robot/stand movements)
 * - Data acquisition timing
 *
 * Dead time = minimum required pause between consecutive measurements
 *
 * Note: All timing is automatically adjusted by SIMULATION_SPEED environment variable
 */

import { TimeUtility } from '../../utils/TimeUtility';

export enum DeadTimeReason {
    SENSOR_RECOVERY = 'SENSOR_RECOVERY',      // PIR sensor reset time
    MOVEMENT_SETTLING = 'MOVEMENT_SETTLING',   // Robot/stand position settling
    DATA_ACQUISITION = 'DATA_ACQUISITION',     // Sensor data collection time
    IEC_COMPLIANCE = 'IEC_COMPLIANCE',         // IEC standard minimum intervals
    GRID_CELL_PAUSE = 'GRID_CELL_PAUSE',      // Pause at grid cell boundaries
    PHASE_TRANSITION = 'PHASE_TRANSITION'      // Pause between test phases
}

export interface DeadTimeConfig {
    // Sensor-related delays
    sensorRecoveryTime: number;        // ms - Time for sensor to reset (default: 2000ms for PIR)
    sensorStabilizationTime: number;   // ms - Time for sensor readings to stabilize (default: 500ms)

    // Movement-related delays
    movementSettlingTime: number;      // ms - Time for robot to settle after movement (default: 300ms)
    angleChangeSettlingTime: number;   // ms - Time for stand to settle after rotation (default: 500ms)

    // Test-specific delays
    betweenMeasurements: number;       // ms - Minimum time between measurements (default: 1000ms)
    betweenAngles: number;             // ms - Time between angle changes (default: 2000ms)
    betweenPhases: number;             // ms - Time between test phases (default: 5000ms)

    // Grid test delays (IEC specific)
    gridCellDwellTime: number;         // ms - Time to dwell at cell center (default: 1000ms)
    gridCellPauseBetween: number;      // ms - Pause between grid cells (default: 2000ms)

    // Heating-related delays
    heatingStabilizationTime: number;  // ms - Time for heating zones to stabilize (default: 30000ms)
}

export interface DeadTimeLog {
    timestamp: Date;
    reason: DeadTimeReason;
    durationMs: number;
    testId?: number;
    testStepId?: number;
    metadata?: any;
}

export class DeadTimeManager {
    private config: DeadTimeConfig;
    private logs: DeadTimeLog[] = [];
    private lastMeasurementTime: Date | null = null;
    private lastAngleChangeTime: Date | null = null;
    private lastMovementTime: Date | null = null;

    constructor(config?: Partial<DeadTimeConfig>) {
        // Default configuration (IEC compliant)
        this.config = {
            sensorRecoveryTime: 2000,           // 2s for PIR sensor reset
            sensorStabilizationTime: 500,       // 0.5s for readings to stabilize
            movementSettlingTime: 300,          // 0.3s for robot position settling
            angleChangeSettlingTime: 500,       // 0.5s for stand rotation settling
            betweenMeasurements: 1000,          // 1s minimum between measurements
            betweenAngles: 2000,                // 2s between angle changes
            betweenPhases: 5000,                // 5s between test phases
            gridCellDwellTime: 1000,            // 1s dwell at cell center (IEC)
            gridCellPauseBetween: 2000,         // 2s pause between cells
            heatingStabilizationTime: 30000,    // 30s for heating stabilization
            ...config
        };
    }

    /**
     * Wait for sensor recovery time
     * Called after each detection event to allow PIR sensor to reset
     */
    async waitForSensorRecovery(testId?: number, testStepId?: number): Promise<void> {
        const duration = this.config.sensorRecoveryTime;
        await this.wait(duration, DeadTimeReason.SENSOR_RECOVERY, { testId, testStepId });
    }

    /**
     * Wait for sensor stabilization
     * Called after environmental changes or before taking a measurement
     */
    async waitForSensorStabilization(testId?: number): Promise<void> {
        const duration = this.config.sensorStabilizationTime;
        await this.wait(duration, DeadTimeReason.DATA_ACQUISITION, { testId });
    }

    /**
     * Wait for movement settling
     * Called after robot movement to ensure position is stable
     */
    async waitForMovementSettling(testId?: number): Promise<void> {
        const duration = this.config.movementSettlingTime;
        await this.wait(duration, DeadTimeReason.MOVEMENT_SETTLING, { testId });
    }

    /**
     * Wait for angle change settling
     * Called after stand rotation to ensure detector is stable
     */
    async waitForAngleSettling(testId?: number): Promise<void> {
        const duration = this.config.angleChangeSettlingTime;
        await this.wait(duration, DeadTimeReason.MOVEMENT_SETTLING, { testId });
        this.lastAngleChangeTime = new Date();
    }

    /**
     * Wait between measurements (IEC compliance)
     * Ensures minimum time between consecutive measurements
     */
    async waitBetweenMeasurements(testId?: number, testStepId?: number): Promise<void> {
        const now = new Date();

        // Calculate time since last measurement
        if (this.lastMeasurementTime) {
            const timeSinceLastMs = now.getTime() - this.lastMeasurementTime.getTime();
            const requiredWaitMs = this.config.betweenMeasurements - timeSinceLastMs;

            if (requiredWaitMs > 0) {
                await this.wait(requiredWaitMs, DeadTimeReason.IEC_COMPLIANCE, {
                    testId,
                    testStepId,
                    timeSinceLast: timeSinceLastMs
                });
            }
        }

        this.lastMeasurementTime = now;
    }

    /**
     * Wait between angle changes
     * Combines angle settling and minimum interval requirements
     */
    async waitBetweenAngles(testId?: number): Promise<void> {
        const now = new Date();

        // Calculate time since last angle change
        if (this.lastAngleChangeTime) {
            const timeSinceLastMs = now.getTime() - this.lastAngleChangeTime.getTime();
            const requiredWaitMs = this.config.betweenAngles - timeSinceLastMs;

            if (requiredWaitMs > 0) {
                await this.wait(requiredWaitMs, DeadTimeReason.IEC_COMPLIANCE, {
                    testId,
                    timeSinceLast: timeSinceLastMs
                });
            }
        } else {
            // First angle change - just wait for settling
            await this.waitForAngleSettling(testId);
        }

        this.lastAngleChangeTime = now;
    }

    /**
     * Wait between test phases
     * Longer pause to allow system to return to baseline
     */
    async waitBetweenPhases(fromPhase: string, toPhase: string, testId?: number): Promise<void> {
        const duration = this.config.betweenPhases;
        await this.wait(duration, DeadTimeReason.PHASE_TRANSITION, {
            testId,
            fromPhase,
            toPhase
        });

        // Reset timing trackers
        this.lastMeasurementTime = null;
        this.lastAngleChangeTime = null;
        this.lastMovementTime = null;
    }

    /**
     * Wait for grid cell dwell time (IEC grid test requirement)
     * Robot pauses at cell center for specified duration
     */
    async waitGridCellDwell(cellRow: number, cellCol: number, testId?: number): Promise<void> {
        const duration = this.config.gridCellDwellTime;
        await this.wait(duration, DeadTimeReason.GRID_CELL_PAUSE, {
            testId,
            cellRow,
            cellCol
        });
    }

    /**
     * Wait between grid cells
     * Pause between testing different cells
     */
    async waitBetweenGridCells(testId?: number): Promise<void> {
        const duration = this.config.gridCellPauseBetween;
        await this.wait(duration, DeadTimeReason.GRID_CELL_PAUSE, { testId });
    }

    /**
     * Wait for heating stabilization
     * Long pause after heating changes to allow thermal equilibrium
     */
    async waitForHeatingStabilization(testId?: number): Promise<void> {
        const duration = this.config.heatingStabilizationTime;
        await this.wait(duration, DeadTimeReason.IEC_COMPLIANCE, {
            testId,
            reason: 'heating_stabilization'
        });
    }

    /**
     * Wait for a complete measurement cycle
     * Combines all necessary delays for a single measurement
     */
    async waitForCompleteMeasurement(testId?: number, testStepId?: number): Promise<void> {
        // Wait for sensor recovery
        await this.waitForSensorRecovery(testId, testStepId);

        // Ensure minimum time between measurements
        await this.waitBetweenMeasurements(testId, testStepId);
    }

    /**
     * Wait for a complete angle change cycle
     * Combines all necessary delays for changing detector angle
     */
    async waitForCompleteAngleChange(testId?: number): Promise<void> {
        // Wait for mechanical settling
        await this.waitForAngleSettling(testId);

        // Wait for sensor stabilization
        await this.waitForSensorStabilization(testId);

        // Ensure minimum time between angles
        await this.waitBetweenAngles(testId);
    }

    /**
     * Generic wait with logging and simulation speed adjustment
     */
    private async wait(durationMs: number, reason: DeadTimeReason, metadata?: any): Promise<void> {
        if (durationMs <= 0) return;

        const adjustedDuration = TimeUtility.adjustDelay(durationMs);

        const log: DeadTimeLog = {
            timestamp: new Date(),
            reason,
            durationMs,
            testId: metadata?.testId,
            testStepId: metadata?.testStepId,
            metadata
        };

        this.logs.push(log);

        console.log(
            `[DeadTimeManager] Waiting ${durationMs}ms (adjusted: ${adjustedDuration}ms) for ${reason}` +
            (metadata?.testId ? ` (test ${metadata.testId})` : '')
        );

        await TimeUtility.delay(durationMs);
    }

    /**
     * Get dead time logs for a test
     */
    getLogsForTest(testId: number): DeadTimeLog[] {
        return this.logs.filter(log => log.testId === testId);
    }

    /**
     * Get total dead time for a test
     */
    getTotalDeadTimeForTest(testId: number): number {
        return this.logs
            .filter(log => log.testId === testId)
            .reduce((sum, log) => sum + log.durationMs, 0);
    }

    /**
     * Get dead time breakdown by reason for a test
     */
    getDeadTimeBreakdown(testId: number): Record<DeadTimeReason, number> {
        const breakdown: Record<DeadTimeReason, number> = {} as any;

        this.logs
            .filter(log => log.testId === testId)
            .forEach(log => {
                if (!breakdown[log.reason]) {
                    breakdown[log.reason] = 0;
                }
                breakdown[log.reason] += log.durationMs;
            });

        return breakdown;
    }

    /**
     * Clear logs (call after test completion or at start of new test)
     */
    clearLogs(): void {
        this.logs = [];
        this.lastMeasurementTime = null;
        this.lastAngleChangeTime = null;
        this.lastMovementTime = null;
    }

    /**
     * Get current configuration
     */
    getConfig(): DeadTimeConfig {
        return { ...this.config };
    }

    /**
     * Update configuration (for calibration or test-specific requirements)
     */
    updateConfig(updates: Partial<DeadTimeConfig>): void {
        this.config = { ...this.config, ...updates };
        console.log('[DeadTimeManager] Configuration updated:', updates);
    }

    /**
     * Get recommended dead time for a specific test type
     */
    static getRecommendedConfig(testType: 'BOUNDARY' | 'GRID' | 'RADIAL'): Partial<DeadTimeConfig> {
        switch (testType) {
            case 'BOUNDARY':
                return {
                    sensorRecoveryTime: 2000,
                    betweenMeasurements: 1000,
                    betweenAngles: 2000
                };

            case 'GRID':
                return {
                    sensorRecoveryTime: 2000,
                    gridCellDwellTime: 1000,
                    gridCellPauseBetween: 2000,
                    betweenMeasurements: 500  // Faster for grid tests
                };

            case 'RADIAL':
                return {
                    sensorRecoveryTime: 2000,
                    betweenMeasurements: 1000,
                    betweenAngles: 3000,  // Longer for radial approach
                    movementSettlingTime: 500
                };
        }
    }
}
