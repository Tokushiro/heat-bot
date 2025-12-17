import { TimeUtility } from '../../utils/TimeUtility';

export enum DeadTimeReason {
    SENSOR_RECOVERY = 'SENSOR_RECOVERY',
    MOVEMENT_SETTLING = 'MOVEMENT_SETTLING',
    DATA_ACQUISITION = 'DATA_ACQUISITION',
    IEC_COMPLIANCE = 'IEC_COMPLIANCE',
    GRID_CELL_PAUSE = 'GRID_CELL_PAUSE',
    PHASE_TRANSITION = 'PHASE_TRANSITION'
}

export interface DeadTimeConfig {
    sensorRecoveryTime: number;
    sensorStabilizationTime: number;
    movementSettlingTime: number;
    angleChangeSettlingTime: number;
    betweenMeasurements: number;
    betweenAngles: number;
    betweenPhases: number;
    gridCellDwellTime: number;
    gridCellPauseBetween: number;
    heatingStabilizationTime: number;
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
        this.config = {
            sensorRecoveryTime: 2000,
            sensorStabilizationTime: 500,
            movementSettlingTime: 300,
            angleChangeSettlingTime: 500,
            betweenMeasurements: 1000,
            betweenAngles: 2000,
            betweenPhases: 5000,
            gridCellDwellTime: 1000,
            gridCellPauseBetween: 2000,
            heatingStabilizationTime: 30000,
            ...config
        };
    }

    async waitForSensorRecovery(testId?: number, testStepId?: number): Promise<void> {
        const duration = this.config.sensorRecoveryTime;
        await this.wait(duration, DeadTimeReason.SENSOR_RECOVERY, { testId, testStepId });
    }

    async waitForSensorStabilization(testId?: number): Promise<void> {
        const duration = this.config.sensorStabilizationTime;
        await this.wait(duration, DeadTimeReason.DATA_ACQUISITION, { testId });
    }

    async waitForMovementSettling(testId?: number): Promise<void> {
        const duration = this.config.movementSettlingTime;
        await this.wait(duration, DeadTimeReason.MOVEMENT_SETTLING, { testId });
    }

    async waitForAngleSettling(testId?: number): Promise<void> {
        const duration = this.config.angleChangeSettlingTime;
        await this.wait(duration, DeadTimeReason.MOVEMENT_SETTLING, { testId });
        this.lastAngleChangeTime = new Date();
    }

    async waitBetweenMeasurements(testId?: number, testStepId?: number): Promise<void> {
        const now = new Date();

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

    async waitBetweenAngles(testId?: number): Promise<void> {
        const now = new Date();

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
            await this.waitForAngleSettling(testId);
        }

        this.lastAngleChangeTime = now;
    }

    async waitBetweenPhases(fromPhase: string, toPhase: string, testId?: number): Promise<void> {
        const duration = this.config.betweenPhases;
        await this.wait(duration, DeadTimeReason.PHASE_TRANSITION, {
            testId,
            fromPhase,
            toPhase
        });

        this.lastMeasurementTime = null;
        this.lastAngleChangeTime = null;
        this.lastMovementTime = null;
    }

    async waitGridCellDwell(cellRow: number, cellCol: number, testId?: number): Promise<void> {
        const duration = this.config.gridCellDwellTime;
        await this.wait(duration, DeadTimeReason.GRID_CELL_PAUSE, {
            testId,
            cellRow,
            cellCol
        });
    }

    async waitBetweenGridCells(testId?: number): Promise<void> {
        const duration = this.config.gridCellPauseBetween;
        await this.wait(duration, DeadTimeReason.GRID_CELL_PAUSE, { testId });
    }

    async waitForHeatingStabilization(testId?: number): Promise<void> {
        const duration = this.config.heatingStabilizationTime;
        await this.wait(duration, DeadTimeReason.IEC_COMPLIANCE, {
            testId,
            reason: 'heating_stabilization'
        });
    }

    async waitForCompleteMeasurement(testId?: number, testStepId?: number): Promise<void> {
        await this.waitForSensorRecovery(testId, testStepId);
        await this.waitBetweenMeasurements(testId, testStepId);
    }

    async waitForCompleteAngleChange(testId?: number): Promise<void> {
        await this.waitForAngleSettling(testId);
        await this.waitForSensorStabilization(testId);
        await this.waitBetweenAngles(testId);
    }

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

    getLogsForTest(testId: number): DeadTimeLog[] {
        return this.logs.filter(log => log.testId === testId);
    }

    getTotalDeadTimeForTest(testId: number): number {
        return this.logs
            .filter(log => log.testId === testId)
            .reduce((sum, log) => sum + log.durationMs, 0);
    }

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

    clearLogs(): void {
        this.logs = [];
        this.lastMeasurementTime = null;
        this.lastAngleChangeTime = null;
        this.lastMovementTime = null;
    }

    getConfig(): DeadTimeConfig {
        return { ...this.config };
    }

    updateConfig(updates: Partial<DeadTimeConfig>): void {
        this.config = { ...this.config, ...updates };
        console.log('[DeadTimeManager] Configuration updated:', updates);
    }

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
                    betweenMeasurements: 500
                };

            case 'RADIAL':
                return {
                    sensorRecoveryTime: 2000,
                    betweenMeasurements: 1000,
                    betweenAngles: 3000,
                    movementSettlingTime: 500
                };
        }
    }
}
