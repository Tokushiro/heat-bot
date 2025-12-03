import { EventEmitter } from "events";
import pool from "../db_conn";
import RobotAPI, { Position } from "./robot_api_service";
import bleEventBus from "./bleEventBus";

/**
 * Enhanced Test Orchestrator with Resume Support
 * Handles test interruptions and can resume from last checkpoint
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

export interface Checkpoint {
    checkpointId: number;
    currentPhase: string;
    completedMeasurements: number;
    totalMeasurements: number;
    lastAngle?: number;
    lastDistance?: number;
    nextAngle?: number;
    nextDistance?: number;
    checkpointData?: any;
}

type TestType = 'tangential_grid' | 'tangential_boundary' | 'radial_boundary' | 'minor_presence';

export class TestOrchestrator extends EventEmitter {
    private static _instance: TestOrchestrator;
    private activeTestId: number | null = null;
    private testAborted: boolean = false;
    private lastCheckpoint: Checkpoint | null = null;
    private isResuming: boolean = false;

    static get instance() {
        if (!this._instance) this._instance = new TestOrchestrator();
        return this._instance;
    }

    private constructor() {
        super();
        this.setupSensorListener();
        this.setupErrorHandlers();
    }

    /**
     * Start a test from beginning
     */
    async startTest(testId: number): Promise<void> {
        return this.executeTest(testId, false);
    }

    /**
     * Resume a test from last checkpoint
     */
    async resumeTest(testId: number): Promise<void> {
        return this.executeTest(testId, true);
    }

    /**
     * Main test execution method (supports resume)
     */
    private async executeTest(testId: number, resume: boolean = false): Promise<void> {
        if (this.activeTestId) {
            throw new Error("Another test is already running");
        }

        this.activeTestId = testId;
        this.testAborted = false;
        this.isResuming = resume;

        try {
            // Mark test as started
            if (!resume) {
                await pool.query("SELECT start_test($1)", [testId]);
                this.emit("test_started", { testId });
            } else {
                await pool.query(
                    "UPDATE test SET status = 'in_progress' WHERE test_id = $1",
                    [testId]
                );
                this.emit("test_resumed", { testId });
            }

            // Load test configuration
            const config = await this.loadTestConfiguration(testId);

            // Load checkpoint if resuming
            if (resume) {
                this.lastCheckpoint = await this.loadCheckpoint(testId);
                if (!this.lastCheckpoint) {
                    throw new Error("No checkpoint found for this test");
                }
                this.emit("checkpoint_loaded", { 
                    testId, 
                    checkpoint: this.lastCheckpoint 
                });
            }

            // Initialize robot
            const robotReady = await RobotAPI.instance.initialize();
            if (!robotReady) {
                throw new Error("Robot initialization failed");
            }

            this.emit("robot_initialized", { testId });

            // Execute test phases (with resume support)
            await this.executeTestPhases(testId, config, this.lastCheckpoint);

            // Mark test as completed
            await pool.query("SELECT complete_test($1)", [testId]);
            this.emit("test_completed", { testId });

        } catch (error: any) {
            // Check if it's an interruption (battery, connection lost, etc.)
            if (error.message.includes("battery") || 
                error.message.includes("connection") ||
                error.message.includes("timeout")) {
                await this.handleTestInterruption(testId, error.message);
            } else {
                await this.handleTestError(testId, error);
            }
            throw error;
        } finally {
            this.activeTestId = null;
            this.lastCheckpoint = null;
            this.isResuming = false;
        }
    }

    /**
     * Execute all test phases with checkpoint support
     */
    private async executeTestPhases(
        testId: number, 
        config: TestConfiguration,
        checkpoint: Checkpoint | null
    ): Promise<void> {
        
        // Determine where to start based on checkpoint
        let startPhase = checkpoint?.currentPhase || 'radial_boundary';
        let skipRadial = checkpoint && checkpoint.currentPhase !== 'radial_boundary';
        let skipTangential = checkpoint && 
            (checkpoint.currentPhase === 'tangential_grid' || 
             checkpoint.currentPhase === 'completed');

        // Phase 1: Radial Boundary Tests
        if (!skipRadial) {
            await this.updateTestPhase(testId, "radial_boundary");
            this.emit("phase_started", { testId, phase: "radial_boundary" });
            
            const startDistance = checkpoint?.lastDistance || config.radialDistances[0];
            const startIdx = config.radialDistances.indexOf(startDistance);
            
            for (let i = startIdx; i < config.radialDistances.length; i++) {
                if (this.testAborted) break;
                
                const distance = config.radialDistances[i];
                await this.executeRadialBoundaryTest(testId, distance, config, checkpoint);
                
                // Save checkpoint after each distance
                await this.saveCheckpoint(testId, 'radial_boundary', {
                    lastDistance: distance,
                    nextDistance: config.radialDistances[i + 1] || null
                });
            }
        }

        // Phase 2: Tangential Boundary Tests
        if (!this.testAborted && !skipTangential) {
            await this.updateTestPhase(testId, "tangential_boundary");
            this.emit("phase_started", { testId, phase: "tangential_boundary" });
            
            const startDistance = checkpoint?.lastDistance || config.tangentialDistances[0];
            const startIdx = config.tangentialDistances.indexOf(startDistance);
            
            for (let i = startIdx; i < config.tangentialDistances.length; i++) {
                if (this.testAborted) break;
                
                const distance = config.tangentialDistances[i];
                await this.executeTangentialBoundaryTest(
                    testId, 
                    distance, 
                    config,
                    checkpoint
                );
                
                // Save checkpoint after each distance
                await this.saveCheckpoint(testId, 'tangential_boundary', {
                    lastDistance: distance,
                    nextDistance: config.tangentialDistances[i + 1] || null
                });
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
     * Execute radial boundary test with resume support
     */
    private async executeRadialBoundaryTest(
        testId: number,
        distance: number,
        config: TestConfiguration,
        checkpoint: Checkpoint | null
    ): Promise<void> {
        const angles = [0, 90, 180, 270];
        
        // Determine starting angle if resuming
        let startAngleIdx = 0;
        if (checkpoint && checkpoint.lastDistance === distance && checkpoint.lastAngle) {
            startAngleIdx = angles.indexOf(checkpoint.lastAngle) + 1;
            if (startAngleIdx >= angles.length) return; // Already completed this distance
        }

        for (let i = startAngleIdx; i < angles.length; i++) {
            const angle = angles[i];
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

                try {
                    // Move robot to position
                    const startDistance = distance + 1.0;
                    await RobotAPI.instance.movePolar(angle, startDistance, 30);
                    await this.delay(500);

                    // Move toward sensor
                    const result = await RobotAPI.instance.moveRadial(
                        startDistance,
                        distance,
                        angle,
                        20
                    );

                    if (!result.success) {
                        throw new Error(result.error || "Movement failed");
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
                        await this.delay(2000);
                    }

                } catch (error: any) {
                    // Check if it's a critical error requiring interruption
                    if (this.isCriticalError(error)) {
                        await this.saveCheckpoint(testId, 'radial_boundary', {
                            lastDistance: distance,
                            lastAngle: angle,
                            nextAngle: angles[i + 1] || null
                        });
                        throw error;
                    }
                    
                    this.emit("measurement_error", { testId, error: error.message });
                    attemptNumber++;
                }
            }

            // Store in radial_boundary table
            await this.storeRadialBoundary(testId, distance, angle, detected, attemptNumber - 1);
            
            // Save checkpoint after each angle
            await this.saveCheckpoint(testId, 'radial_boundary', {
                lastDistance: distance,
                lastAngle: angle,
                nextAngle: angles[i + 1] || null
            });
        }
    }

    /**
     * Execute tangential boundary test with resume support
     */
    private async executeTangentialBoundaryTest(
        testId: number,
        radius: number,
        config: TestConfiguration,
        checkpoint: Checkpoint | null
    ): Promise<void> {
        const angleStep = 15;
        
        // Determine starting angle if resuming
        let startAngle = 0;
        if (checkpoint && checkpoint.lastDistance === radius && checkpoint.lastAngle) {
            startAngle = checkpoint.lastAngle + angleStep;
            if (startAngle >= 360) return; // Already completed this radius
        }

        for (let angle = startAngle; angle < 360; angle += angleStep) {
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

                try {
                    // Move to starting angle
                    const startAngle = angle - 15;
                    await RobotAPI.instance.moveTangential(startAngle, radius, 30);
                    await this.delay(500);

                    // Move tangentially through target angle
                    const result = await RobotAPI.instance.moveTangential(angle, radius, 20);

                    if (!result.success) {
                        throw new Error(result.error || "Movement failed");
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

                } catch (error: any) {
                    if (this.isCriticalError(error)) {
                        await this.saveCheckpoint(testId, 'tangential_boundary', {
                            lastDistance: radius,
                            lastAngle: angle,
                            nextAngle: angle + angleStep < 360 ? angle + angleStep : null
                        });
                        throw error;
                    }
                    
                    this.emit("measurement_error", { testId, error: error.message });
                    attemptNumber++;
                }
            }

            // Store in tangential_boundary table
            await this.storeTangentialBoundary(testId, radius, angle, detected, attemptNumber - 1);
            
            // Save checkpoint after each angle
            await this.saveCheckpoint(testId, 'tangential_boundary', {
                lastDistance: radius,
                lastAngle: angle,
                nextAngle: angle + angleStep < 360 ? angle + angleStep : null
            });
        }
    }

    /**
     * Execute tangential grid test (simplified - full implementation similar to above)
     */
    private async executeTangentialGridTest(
        testId: number,
        config: TestConfiguration
    ): Promise<void> {
        const radiusStep = 0.5;
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
     * Save checkpoint
     */
    private async saveCheckpoint(
        testId: number,
        phase: string,
        data: any
    ): Promise<void> {
        const query = `
            SELECT save_checkpoint($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `;

        // Calculate completed measurements
        const completedQuery = `
            SELECT COUNT(*) as count FROM test_measurement WHERE test_id = $1
        `;
        const completedResult = await pool.query(completedQuery, [testId]);
        const completed = parseInt(completedResult.rows[0].count);

        await pool.query(query, [
            testId,
            phase,
            completed,
            100, // total (estimated)
            data.lastAngle,
            data.lastDistance,
            data.nextAngle,
            data.nextDistance,
            JSON.stringify(data)
        ]);

        this.emit("checkpoint_saved", { testId, phase, completed });
    }

    /**
     * Load checkpoint
     */
    private async loadCheckpoint(testId: number): Promise<Checkpoint | null> {
        const query = `SELECT * FROM get_latest_checkpoint($1)`;
        const result = await pool.query(query, [testId]);

        if (result.rows.length === 0) {
            return null;
        }

        const row = result.rows[0];
        return {
            checkpointId: row.checkpoint_id,
            currentPhase: row.current_phase,
            completedMeasurements: row.completed_measurements,
            totalMeasurements: row.total_measurements,
            lastAngle: row.last_angle,
            lastDistance: row.last_distance,
            nextAngle: row.next_angle,
            nextDistance: row.next_distance,
            checkpointData: row.checkpoint_data
        };
    }

    /**
     * Check if error is critical (requires interruption)
     */
    private isCriticalError(error: any): boolean {
        const criticalKeywords = [
            'battery',
            'power',
            'connection lost',
            'serial disconnect',
            'timeout',
            'emergency stop'
        ];

        const errorMessage = error.message?.toLowerCase() || '';
        return criticalKeywords.some(keyword => errorMessage.includes(keyword));
    }

    /**
     * Handle test interruption (can be resumed)
     */
    private async handleTestInterruption(testId: number, reason: string): Promise<void> {
        await pool.query("SELECT mark_test_interrupted($1, $2)", [testId, reason]);
        
        this.emit("test_interrupted", { 
            testId, 
            reason,
            canResume: true 
        });
    }

    /**
     * Setup error handlers for robot and serial
     */
    private setupErrorHandlers(): void {
        RobotAPI.instance.on("error", async (data) => {
            if (this.activeTestId) {
                await this.handleTestInterruption(
                    this.activeTestId,
                    `Robot error: ${data.error}`
                );
            }
        });
    }

    // ... (keep all other existing methods: waitForDetection, recordMeasurement, 
    //      storeRadialBoundary, storeTangentialBoundary, updateTestPhase, 
    //      loadTestConfiguration, logTestEvent, handleTestError, abortTest, 
    //      getTestProgress, setupSensorListener, delay)

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
        const query = `SELECT record_measurement($1, $2, $3, $4, $5, $6, $7, $8)`;
        await pool.query(query, [
            testId, testType, detected, angle, distance, x, y, attemptNumber
        ]);

        await this.logTestEvent(testId, "measurement_recorded", {
            testType, detected, angle, distance, position: { x, y }, attemptNumber
        });
    }

    private async storeRadialBoundary(
        testId: number, distance: number, angle: number, detected: boolean, retryCount: number
    ): Promise<void> {
        const query = `
            INSERT INTO radial_boundary (test_id, measurement1_2, verdict1, retry_count, measured_at)
            VALUES ($1, $2, $3, $4, NOW())
        `;
        await pool.query(query, [testId, distance, detected ? 1 : 0, retryCount]);
    }

    private async storeTangentialBoundary(
        testId: number, radius: number, angle: number, detected: boolean, retryCount: number
    ): Promise<void> {
        const query = `
            INSERT INTO tangential_boundary (test_id, angle, measurement2m, verdict2m, retry_count, measurement_time)
            VALUES ($1, $2, $3, $4, $5, NOW())
        `;
        await pool.query(query, [testId, angle, radius, detected ? 1 : 0, retryCount]);
    }

    private async loadTestConfiguration(testId: number): Promise<TestConfiguration> {
        const configQuery = `SELECT * FROM test_configuration WHERE test_id = $1`;
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

        return {
            testId, mountingHeight: 2.5, radialDistances: [2.0, 3.0],
            tangentialAngles: [0, 45, 90, 135, 180, 225, 270, 315],
            tangentialDistances: [2.5, 3.0], detectionTimeout: 5000, retryLimit: 3
        };
    }

    private async updateTestPhase(testId: number, phase: string): Promise<void> {
        await pool.query("UPDATE test SET current_phase = $1 WHERE test_id = $2", [phase, testId]);
    }

    private async logTestEvent(testId: number, eventType: string, eventData: any): Promise<void> {
        const query = `INSERT INTO test_event_log (test_id, event_type, event_data) VALUES ($1, $2, $3)`;
        await pool.query(query, [testId, eventType, JSON.stringify(eventData)]);
    }

    private async handleTestError(testId: number, error: any): Promise<void> {
        await pool.query(
            "UPDATE test SET status = 'failed', notes = $1 WHERE test_id = $2",
            [String(error), testId]
        );
        await this.logTestEvent(testId, "test_failed", { error: String(error) });
        this.emit("test_failed", { testId, error });
    }

    async abortTest(): Promise<void> {
        if (!this.activeTestId) return;
        this.testAborted = true;
        await RobotAPI.instance.stopMovement();
        await pool.query(
            "UPDATE test SET status = 'failed', notes = 'Test aborted by user' WHERE test_id = $1",
            [this.activeTestId]
        );
        this.emit("test_aborted", { testId: this.activeTestId });
        this.activeTestId = null;
    }

    async getTestProgress(testId: number): Promise<any> {
        const testQuery = `SELECT status, current_phase FROM test WHERE test_id = $1`;
        const testResult = await pool.query(testQuery, [testId]);
        const measurementQuery = `SELECT COUNT(*) as total FROM test_measurement WHERE test_id = $1`;
        const measurementResult = await pool.query(measurementQuery, [testId]);

        const test = testResult.rows[0];
        const completedSteps = parseInt(measurementResult.rows[0].total);
        const totalSteps = 100;

        return {
            testId, currentPhase: test.current_phase || "pending",
            totalSteps, completedSteps,
            percentComplete: (completedSteps / totalSteps) * 100
        };
    }

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

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

export default TestOrchestrator;
