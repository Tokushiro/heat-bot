import { EventEmitter } from "events";
import pool from "../db_conn";
import RobotAPI, { Position, MovementResult } from "./robot_api_service";
import bleEventBus from "./bleEventBus";

/**
 * Test Orchestration Service
 * Manages the complete test execution flow
 */

export interface TestConfiguration {
    testId: number;
    mountingHeight: number;
    radialDistances: number[];
    tangentialAngles: number[];
    tangentialDistances: number[];
    detectionTimeout: number;
    retryLimit: number;
}

export interface MeasurementPoint {
    angle?: number;
    distance?: number;
    x?: number;
    y?: number;
}

export interface TestProgress {
    testId: number;
    currentPhase: string;
    totalSteps: number;
    completedSteps: number;
    percentComplete: number;
    currentMeasurement?: MeasurementPoint;
    lastDetection?: boolean;
}

type TestType = 'tangential_grid' | 'tangential_boundary' | 'radial_boundary' | 'minor_presence';

export class TestOrchestrator extends EventEmitter {
    private static _instance: TestOrchestrator;
    private activeTestId: number | null = null;
    private detectionListeners: Map<number, (detected: boolean) => void> = new Map();
    private testAborted: boolean = false;

    static get instance() {
        if (!this._instance) this._instance = new TestOrchestrator();
        return this._instance;
    }

    private constructor() {
        super();
        this.setupSensorListener();
    }

    /**
     * Start a complete test suite
     */
    async startTest(testId: number): Promise<void> {
        if (this.activeTestId) {
            throw new Error("Another test is already running");
        }

        this.activeTestId = testId;
        this.testAborted = false;

        try {
            // Mark test as started
            await pool.query("SELECT start_test($1)", [testId]);
            this.emit("test_started", { testId });

            // Load test configuration
            const config = await this.loadTestConfiguration(testId);

            // Initialize robot
            const robotReady = await RobotAPI.instance.initialize();
            if (!robotReady) {
                throw new Error("Robot initialization failed");
            }

            this.emit("robot_initialized", { testId });

            // Execute test phases based on test choice
            await this.executeTestPhases(testId, config);

            // Mark test as completed
            await pool.query("SELECT complete_test($1)", [testId]);
            this.emit("test_completed", { testId });

        } catch (error) {
            await this.handleTestError(testId, error);
            throw error;
        } finally {
            this.activeTestId = null;
        }
    }

    /**
     * Execute all test phases
     */
    private async executeTestPhases(testId: number, config: TestConfiguration): Promise<void> {
        // Phase 1: Radial Boundary Tests
        await this.updateTestPhase(testId, "radial_boundary");
        this.emit("phase_started", { testId, phase: "radial_boundary" });
        
        for (const distance of config.radialDistances) {
            if (this.testAborted) break;
            await this.executeRadialBoundaryTest(testId, distance, config);
        }

        // Phase 2: Tangential Boundary Tests
        if (!this.testAborted) {
            await this.updateTestPhase(testId, "tangential_boundary");
            this.emit("phase_started", { testId, phase: "tangential_boundary" });
            
            for (const distance of config.tangentialDistances) {
                if (this.testAborted) break;
                await this.executeTangentialBoundaryTest(testId, distance, config);
            }
        }

        // Phase 3: Tangential Grid Test (if configured)
        if (!this.testAborted && config.tangentialAngles.length > 0) {
            await this.updateTestPhase(testId, "tangential_grid");
            this.emit("phase_started", { testId, phase: "tangential_grid" });
            await this.executeTangentialGridTest(testId, config);
        }
    }

    /**
     * Execute radial boundary test at specific distance
     */
    private async executeRadialBoundaryTest(
        testId: number,
        distance: number,
        config: TestConfiguration
    ): Promise<void> {
        const angles = [0, 90, 180, 270]; // Test at 4 cardinal directions

        for (const angle of angles) {
            if (this.testAborted) break;

            let detected = false;
            let attemptNumber = 1;

            // Retry loop
            while (!detected && attemptNumber <= config.retryLimit && !this.testAborted) {
                this.emit("measurement_started", {
                    testId,
                    type: "radial_boundary",
                    distance,
                    angle,
                    attempt: attemptNumber
                });

                // Move robot to position (approach from further out)
                const startDistance = distance + 1.0; // Start 1m further
                await RobotAPI.instance.movePolar(angle, startDistance, 30);
                await this.delay(500);

                // Move toward sensor
                const result = await RobotAPI.instance.moveRadial(
                    startDistance,
                    distance,
                    angle,
                    20 // Slower speed for detection
                );

                if (!result.success) {
                    this.emit("movement_failed", { testId, error: result.error });
                    attemptNumber++;
                    continue;
                }

                // Wait for sensor detection
                detected = await this.waitForDetection(config.detectionTimeout);

                // Record measurement
                await this.recordMeasurement(
                    testId,
                    "radial_boundary",
                    detected,
                    angle,
                    distance,
                    result.position.x,
                    result.position.y,
                    attemptNumber
                );

                this.emit("measurement_completed", {
                    testId,
                    type: "radial_boundary",
                    distance,
                    angle,
                    detected,
                    attempt: attemptNumber,
                    position: result.position
                });

                if (!detected) {
                    attemptNumber++;
                    await this.delay(2000); // Wait before retry
                }
            }

            // Store in radial_boundary table
            await this.storeRadialBoundary(testId, distance, angle, detected, attemptNumber - 1);
        }
    }

    /**
     * Execute tangential boundary test at specific radius
     */
    private async executeTangentialBoundaryTest(
        testId: number,
        radius: number,
        config: TestConfiguration
    ): Promise<void> {
        const angleStep = 15; // Test every 15 degrees

        for (let angle = 0; angle < 360; angle += angleStep) {
            if (this.testAborted) break;

            let detected = false;
            let attemptNumber = 1;

            while (!detected && attemptNumber <= config.retryLimit && !this.testAborted) {
                this.emit("measurement_started", {
                    testId,
                    type: "tangential_boundary",
                    radius,
                    angle,
                    attempt: attemptNumber
                });

                // Move to starting angle (15 degrees before target)
                const startAngle = angle - 15;
                await RobotAPI.instance.moveTangential(startAngle, radius, 30);
                await this.delay(500);

                // Move tangentially through target angle
                const result = await RobotAPI.instance.moveTangential(angle, radius, 20);

                if (!result.success) {
                    this.emit("movement_failed", { testId, error: result.error });
                    attemptNumber++;
                    continue;
                }

                // Wait for sensor detection
                detected = await this.waitForDetection(config.detectionTimeout);

                // Record measurement
                await this.recordMeasurement(
                    testId,
                    "tangential_boundary",
                    detected,
                    angle,
                    radius,
                    result.position.x,
                    result.position.y,
                    attemptNumber
                );

                this.emit("measurement_completed", {
                    testId,
                    type: "tangential_boundary",
                    radius,
                    angle,
                    detected,
                    attempt: attemptNumber,
                    position: result.position
                });

                if (!detected) {
                    attemptNumber++;
                    await this.delay(2000);
                }
            }

            // Store in tangential_boundary table
            await this.storeTangentialBoundary(testId, radius, angle, detected, attemptNumber - 1);
        }
    }

    /**
     * Execute tangential grid test (comprehensive coverage)
     */
    private async executeTangentialGridTest(
        testId: number,
        config: TestConfiguration
    ): Promise<void> {
        // Create a grid of test points
        const radiusStep = 0.5; // Test every 0.5m
        const maxRadius = Math.max(...config.tangentialDistances);

        for (let radius = 1.0; radius <= maxRadius; radius += radiusStep) {
            if (this.testAborted) break;

            for (const angle of config.tangentialAngles) {
                if (this.testAborted) break;

                this.emit("measurement_started", {
                    testId,
                    type: "tangential_grid",
                    radius,
                    angle
                });

                const result = await RobotAPI.instance.moveTangential(angle, radius, 30);
                await this.delay(500);

                const detected = await this.waitForDetection(config.detectionTimeout);

                await this.recordMeasurement(
                    testId,
                    "tangential_grid",
                    detected,
                    angle,
                    radius,
                    result.position.x,
                    result.position.y,
                    1
                );

                this.emit("measurement_completed", {
                    testId,
                    type: "tangential_grid",
                    radius,
                    angle,
                    detected,
                    position: result.position
                });
            }
        }
    }

    /**
     * Wait for sensor detection within timeout
     */
    private waitForDetection(timeout: number): Promise<boolean> {
        return new Promise((resolve) => {
            let detected = false;
            const timer = setTimeout(() => {
                cleanup();
                resolve(detected);
            }, timeout);

            const handler = (event: any) => {
                if (event.detected) {
                    detected = true;
                    clearTimeout(timer);
                    cleanup();
                    resolve(true);
                }
            };

            const cleanup = () => {
                bleEventBus.off("detection", handler);
            };

            bleEventBus.on("detection", handler);
        });
    }

    /**
     * Record measurement in database
     */
    private async recordMeasurement(
        testId: number,
        testType: TestType,
        detected: boolean,
        angle: number | undefined,
        distance: number | undefined,
        x: number,
        y: number,
        attemptNumber: number
    ): Promise<void> {
        const query = `
            SELECT record_measurement($1, $2, $3, $4, $5, $6, $7, $8)
        `;

        await pool.query(query, [
            testId,
            testType,
            detected,
            angle,
            distance,
            x,
            y,
            attemptNumber
        ]);

        // Also log event
        await this.logTestEvent(testId, "measurement_recorded", {
            testType,
            detected,
            angle,
            distance,
            position: { x, y },
            attemptNumber
        });
    }

    /**
     * Store radial boundary result
     */
    private async storeRadialBoundary(
        testId: number,
        distance: number,
        angle: number,
        detected: boolean,
        retryCount: number
    ): Promise<void> {
        const query = `
            INSERT INTO radial_boundary (
                test_id, measurement1_2, verdict1, retry_count, measured_at
            ) VALUES ($1, $2, $3, $4, NOW())
        `;

        await pool.query(query, [
            testId,
            distance,
            detected ? 1 : 0,
            retryCount
        ]);
    }

    /**
     * Store tangential boundary result
     */
    private async storeTangentialBoundary(
        testId: number,
        radius: number,
        angle: number,
        detected: boolean,
        retryCount: number
    ): Promise<void> {
        const query = `
            INSERT INTO tangential_boundary (
                test_id, angle, measurement2m, verdict2m, retry_count, measurement_time
            ) VALUES ($1, $2, $3, $4, $5, NOW())
        `;

        await pool.query(query, [
            testId,
            angle,
            radius,
            detected ? 1 : 0,
            retryCount
        ]);
    }

    /**
     * Load test configuration
     */
    private async loadTestConfiguration(testId: number): Promise<TestConfiguration> {
        // Try to load from test_configuration table
        const configQuery = `
            SELECT * FROM test_configuration WHERE test_id = $1
        `;
        const configResult = await pool.query(configQuery, [testId]);

        if (configResult.rows.length > 0) {
            const row = configResult.rows[0];
            return {
                testId,
                mountingHeight: row.mounting_height_m,
                radialDistances: row.radial_distances_m || [2.0, 3.0],
                tangentialAngles: row.tangential_angles || [0, 45, 90, 135, 180, 225, 270, 315],
                tangentialDistances: row.tangential_distances_m || [2.5, 3.0],
                detectionTimeout: row.detection_timeout_ms || 5000,
                retryLimit: row.radial_retry_limit || 3
            };
        }

        // Default configuration
        return {
            testId,
            mountingHeight: 2.5,
            radialDistances: [2.0, 3.0],
            tangentialAngles: [0, 45, 90, 135, 180, 225, 270, 315],
            tangentialDistances: [2.5, 3.0],
            detectionTimeout: 5000,
            retryLimit: 3
        };
    }

    /**
     * Update test phase
     */
    private async updateTestPhase(testId: number, phase: string): Promise<void> {
        await pool.query(
            "UPDATE test SET current_phase = $1 WHERE test_id = $2",
            [phase, testId]
        );
    }

    /**
     * Log test event
     */
    private async logTestEvent(testId: number, eventType: string, eventData: any): Promise<void> {
        const query = `
            INSERT INTO test_event_log (test_id, event_type, event_data)
            VALUES ($1, $2, $3)
        `;

        await pool.query(query, [
            testId,
            eventType,
            JSON.stringify(eventData)
        ]);
    }

    /**
     * Handle test error
     */
    private async handleTestError(testId: number, error: any): Promise<void> {
        await pool.query(
            "UPDATE test SET status = 'failed', notes = $1 WHERE test_id = $2",
            [String(error), testId]
        );

        await this.logTestEvent(testId, "test_failed", { error: String(error) });
        this.emit("test_failed", { testId, error });
    }

    /**
     * Abort current test
     */
    async abortTest(): Promise<void> {
        if (!this.activeTestId) {
            return;
        }

        this.testAborted = true;
        await RobotAPI.instance.stopMovement();

        await pool.query(
            "UPDATE test SET status = 'failed', notes = 'Test aborted by user' WHERE test_id = $1",
            [this.activeTestId]
        );

        this.emit("test_aborted", { testId: this.activeTestId });
        this.activeTestId = null;
    }

    /**
     * Get test progress
     */
    async getTestProgress(testId: number): Promise<TestProgress> {
        const testQuery = `
            SELECT status, current_phase FROM test WHERE test_id = $1
        `;
        const testResult = await pool.query(testQuery, [testId]);

        const measurementQuery = `
            SELECT COUNT(*) as total FROM test_measurement WHERE test_id = $1
        `;
        const measurementResult = await pool.query(measurementQuery, [testId]);

        const test = testResult.rows[0];
        const completedSteps = parseInt(measurementResult.rows[0].total);
        
        // Estimate total steps based on configuration
        const totalSteps = 100; // This would be calculated based on actual test config

        return {
            testId,
            currentPhase: test.current_phase || "pending",
            totalSteps,
            completedSteps,
            percentComplete: (completedSteps / totalSteps) * 100
        };
    }

    /**
     * Setup sensor detection listener
     */
    private setupSensorListener(): void {
        bleEventBus.on("detection", (event: any) => {
            if (this.activeTestId) {
                this.emit("sensor_detection", {
                    testId: this.activeTestId,
                    detected: event.detected,
                    timestamp: event.timestamp,
                    raw: event.raw
                });
            }
        });
    }

    /**
     * Utility delay
     */
    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

export default TestOrchestrator;
