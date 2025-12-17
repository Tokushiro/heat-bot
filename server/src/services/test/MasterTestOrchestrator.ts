import { EventEmitter } from "events";
import { RobotAPIFactory } from "../../api/factories/RobotAPIFactory";
import { SensorAPIFactory } from "../../api/factories/SensorAPIFactory";
import { RobotSensorIntegration } from "../../api/implementations/mock/RobotSensorIntegration";
import bleEventBus, { DetectionEvent } from "../core/BleEventBus";
import { TelemetryService } from "../telemetry/TelemetryService";
import * as testService from "./TestService";
import * as testStepService from "./TestStepService";
import pool from "../../db_conn";
import { TimeUtility } from "../../utils/TimeUtility";

// =============================================================================
// IEC 63180 HARDCODED TEST PARAMETERS
// =============================================================================

// Boundary Detection - Stepped Approach
const IEC_BOUNDARY_ANGLES = Array.from({ length: 36 }, (_, i) => i * 10); // 0°, 10°, 20°, ..., 350° (36 angles)
const IEC_BOUNDARY_START_DISTANCE = 8.0;  // Start beyond sensor range (meters)
const IEC_BOUNDARY_STEP_SIZE = 0.5;       // Move closer by 0.5m each step
const IEC_BOUNDARY_MIN_DISTANCE = 1.0;    // Don't go closer than 1m

// Tangential Test - Grid Parameters
const IEC_GRID_CELL_SIZE = 0.5; // meters
const IEC_GRID_MAX_RADIUS = 6.0; // meters

// Radial Test - Offset Parameters
const IEC_RADIAL_TEST_OFFSETS = [-2.0, -1.0, 1.0, 2.0]; // meters from boundary

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Test execution state machine - single source of truth
 */
export enum TestExecutionState {
    IDLE = 'IDLE',
    BOUNDARY_RUNNING = 'BOUNDARY_RUNNING',
    BOUNDARY_PAUSED = 'BOUNDARY_PAUSED',
    BOUNDARY_COMPLETE = 'BOUNDARY_COMPLETE',
    TANGENTIAL_RUNNING = 'TANGENTIAL_RUNNING',
    TANGENTIAL_PAUSED = 'TANGENTIAL_PAUSED',
    TANGENTIAL_COMPLETE = 'TANGENTIAL_COMPLETE',
    RADIAL_RUNNING = 'RADIAL_RUNNING',
    RADIAL_PAUSED = 'RADIAL_PAUSED',
    RADIAL_COMPLETE = 'RADIAL_COMPLETE',
    ALL_COMPLETE = 'ALL_COMPLETE',
    ERROR = 'ERROR'
}

export type TestPhase = 'BOUNDARY_DETECTION' | 'TANGENTIAL_TEST' | 'RADIAL_TEST' | 'COMPLETED';
export type TestType = 'RADIAL' | 'TANGENTIAL' | 'FULL';

export interface BoundaryResult {
    angle: number;
    detection_boundary: number | null;    // Max distance where detected
    detected_distance: number | null;      // Distance of detection
    no_detection_distance: number | null;  // Distance of no detection
}

export interface GridCell {
    x: number;
    y: number;
    row: number;
    col: number;
    angle: number;
    radius: number;
}

export interface MasterTestConfiguration {
    test_id: number;
    sensor_id: number;
    test_type: TestType;
    movement_speed?: number;
    detection_wait_time?: number;
    repeat_measurements?: number;
    initial_position?: {
        distanceFromSensor: number;
        facingAngle: number;
        robotOrientation: 'tangential' | 'radial';
    };
}

export interface TestState {
    test_id: number;
    execution_state: TestExecutionState;
    boundary_results: BoundaryResult[];
    tangential_results_count: number;
    radial_results_count: number;
    completed_step_count: number;
    last_position_x?: number;
    last_position_y?: number;
    last_position_timestamp?: Date;
    initial_position?: {
        distanceFromSensor: number;
        facingAngle: number;
        robotOrientation: 'tangential' | 'radial';
    };
    progress: {
        phase: string;
        total: number;
        completed: number;
    };
}

class StopRequestedError extends Error {
    constructor() {
        super("STOP_REQUESTED");
        this.name = "StopRequestedError";
    }
}

// =============================================================================
// MASTER TEST ORCHESTRATOR
// =============================================================================

export class MasterTestOrchestrator extends EventEmitter {
    private static _instance: MasterTestOrchestrator;
    private currentTest: MasterTestConfiguration | null = null;
    private testState: TestState | null = null;
    private currentStepId: number | null = null;
    private detectionBuffer: DetectionEvent[] = [];
    private executionState: TestExecutionState = TestExecutionState.IDLE;
    private stopRequested: boolean = false;
    private sequenceCounter: number = 0;

    static get instance() {
        if (!this._instance) this._instance = new MasterTestOrchestrator();
        return this._instance;
    }

    private constructor() {
        super();
        this.setupDetectionListener();
    }

    private setupDetectionListener() {
        bleEventBus.on("detection", (event: DetectionEvent) => {
            if (this.currentStepId) {
                this.detectionBuffer.push(event);
                this.emit("detection", {
                    test_step_id: this.currentStepId,
                    detected: event.detected,
                    timestamp: event.timestamp
                });

                if (this.testState) {
                    TelemetryService.recordSample({
                        test_id: this.testState.test_id,
                        test_step_id: this.currentStepId,
                        detection_active: event.detected,
                        robot_position_x: this.testState.last_position_x,
                        robot_position_y: this.testState.last_position_y,
                        timestamp: new Date(event.timestamp)
                    }).catch(err => {
                        console.warn("[MasterTest] Failed to record detection telemetry:", err);
                    });
                }
            }
        });
    }

    // =========================================================================
    // STATE TRANSITION MANAGEMENT
    // =========================================================================

    /**
     * Transition to a new state with validation and persistence
     */
    private async transitionState(newState: TestExecutionState): Promise<void> {
        const oldState = this.executionState;

        // Log transition
        console.log(`[MasterTest] State transition: ${oldState} → ${newState}`);

        this.executionState = newState;

        // Update test state object
        if (this.testState) {
            this.testState.execution_state = newState;
            await this.saveTestState();
        }

        // Emit state change event
        this.emit('state_changed', { from: oldState, to: newState });
    }

    /**
     * Check if state transition is valid (optional validation)
     */
    private isValidTransition(from: TestExecutionState, to: TestExecutionState): boolean {
        // Simple validation - can be expanded
        const validTransitions: Record<TestExecutionState, TestExecutionState[]> = {
            [TestExecutionState.IDLE]: [TestExecutionState.BOUNDARY_RUNNING, TestExecutionState.ERROR],
            [TestExecutionState.BOUNDARY_RUNNING]: [TestExecutionState.BOUNDARY_PAUSED, TestExecutionState.BOUNDARY_COMPLETE, TestExecutionState.ERROR],
            [TestExecutionState.BOUNDARY_PAUSED]: [TestExecutionState.BOUNDARY_RUNNING, TestExecutionState.ERROR],
            [TestExecutionState.BOUNDARY_COMPLETE]: [TestExecutionState.TANGENTIAL_RUNNING, TestExecutionState.RADIAL_RUNNING, TestExecutionState.ERROR],
            [TestExecutionState.TANGENTIAL_RUNNING]: [TestExecutionState.TANGENTIAL_PAUSED, TestExecutionState.TANGENTIAL_COMPLETE, TestExecutionState.ERROR],
            [TestExecutionState.TANGENTIAL_PAUSED]: [TestExecutionState.TANGENTIAL_RUNNING, TestExecutionState.ERROR],
            [TestExecutionState.TANGENTIAL_COMPLETE]: [TestExecutionState.RADIAL_RUNNING, TestExecutionState.ALL_COMPLETE, TestExecutionState.ERROR],
            [TestExecutionState.RADIAL_RUNNING]: [TestExecutionState.RADIAL_PAUSED, TestExecutionState.RADIAL_COMPLETE, TestExecutionState.ERROR],
            [TestExecutionState.RADIAL_PAUSED]: [TestExecutionState.RADIAL_RUNNING, TestExecutionState.ERROR],
            [TestExecutionState.RADIAL_COMPLETE]: [TestExecutionState.TANGENTIAL_RUNNING, TestExecutionState.ALL_COMPLETE, TestExecutionState.ERROR],
            [TestExecutionState.ALL_COMPLETE]: [TestExecutionState.IDLE],
            [TestExecutionState.ERROR]: [TestExecutionState.IDLE]
        };

        return validTransitions[from]?.includes(to) ?? false;
    }

    // =========================================================================
    // TEST LIFECYCLE METHODS
    // =========================================================================

    /**
     * Start a new test (IEC 63180 Boundary Detection)
     */
    async startTest(config: MasterTestConfiguration): Promise<boolean> {
        console.log("\n" + "=".repeat(80));
        console.log("🚀 [MasterTest] START TEST");
        console.log("=".repeat(80));
        console.log(`   Test ID: ${config.test_id}`);
        console.log(`   Sensor ID: ${config.sensor_id}`);
        console.log("=".repeat(80) + "\n");

        if (this.executionState !== TestExecutionState.IDLE) {
            throw new Error("Test already running or not in IDLE state");
        }

        try {
            this.stopRequested = false;
            this.currentTest = config;
            this.sequenceCounter = 0;

            // Initialize test state
            this.testState = {
                test_id: config.test_id,
                execution_state: TestExecutionState.IDLE,
                boundary_results: [],
                tangential_results_count: 0,
                radial_results_count: 0,
                completed_step_count: 0,
                initial_position: config.initial_position,
                progress: {
                    phase: 'BOUNDARY_DETECTION',
                    total: IEC_BOUNDARY_ANGLES.length, // 36 angles with stepped approach
                    completed: 0
                }
            };

            await this.saveTestState();
            await testService.updateTestStatus(config.test_id, 'IN_PROGRESS', new Date());

            // Initialize hardware
            console.log("[MasterTest] Initializing robot...");
            const robot = RobotAPIFactory.getInstance();
            await robot.initialize();

            console.log("[MasterTest] Initializing sensor...");
            const sensor = SensorAPIFactory.getInstance();
            await sensor.initialize({
                sensorId: `sensor-${config.sensor_id}`,
                mac: process.env.BLE_SENSOR_MAC || "00:00:00:00:00:00",
                mountingHeight: 1.7,
                detectionZones: [
                    {
                        minDistance: 0,
                        maxDistance: 12,
                        minAngle: 0,
                        maxAngle: 360,
                        detectionProbability: 0.95
                    }
                ]
            });
            await sensor.startDetection();

            RobotSensorIntegration.instance.initialize();

            // Emit test started event
            this.emit("test_started", {
                test_id: config.test_id,
                phase: 'BOUNDARY_DETECTION'
            });

            // Execute IEC 63180 Boundary Detection
            console.log("\n" + "=".repeat(80));
            console.log("🎯 [MasterTest] STARTING IEC 63180 BOUNDARY DETECTION (STEPPED APPROACH)");
            console.log("=".repeat(80));
            console.log(`   Angles: ${IEC_BOUNDARY_ANGLES.length} angles (0° to 350° in 10° steps)`);
            console.log(`   Method: Start at ${IEC_BOUNDARY_START_DISTANCE}m, step ${IEC_BOUNDARY_STEP_SIZE}m closer until detection`);
            console.log(`   Min distance: ${IEC_BOUNDARY_MIN_DISTANCE}m`);
            console.log("=".repeat(80) + "\n");

            await this.executeBoundaryDetectionIEC(config);

            console.log("\n✅ [MasterTest] Boundary detection complete!");
            console.log(`   Found boundaries at ${this.testState.boundary_results.filter(r => r.detection_boundary !== null).length} of ${this.testState.boundary_results.length} angles`);

            // Transition to BOUNDARY_COMPLETE
            await this.transitionState(TestExecutionState.BOUNDARY_COMPLETE);
            await testService.updateTestStatus(config.test_id, 'PAUSED');

            // Emit boundary detection completed event
            this.emit("boundary_detection_completed", {
                test_id: config.test_id,
                boundary_results: this.testState.boundary_results,
                message: "Boundary detection complete. Choose which test to run next:"
            });

            return true;

        } catch (error) {
            if (error instanceof StopRequestedError) {
                console.warn("[MasterTest] Test stopped by user");
                return false;
            }

            console.error("[MasterTest] Test failed:", error);
            await this.transitionState(TestExecutionState.ERROR);
            await testService.updateTestStatus(config.test_id, 'ERROR', undefined, new Date());
            this.emit("test_failed", { test_id: config.test_id, error });
            return false;
        }
    }

    /**
     * Start next phase (Tangential or Radial test)
     */
    async startTestPhase(testType: 'TANGENTIAL' | 'RADIAL', test_id?: number): Promise<boolean> {
        if (!this.testState || !this.currentTest) {
            throw new Error("No test in progress");
        }

        // Validate state
        if (this.executionState !== TestExecutionState.BOUNDARY_COMPLETE &&
            this.executionState !== TestExecutionState.TANGENTIAL_COMPLETE &&
            this.executionState !== TestExecutionState.RADIAL_COMPLETE) {
            throw new Error("Cannot start test phase - boundary detection not complete");
        }

        try {
            this.stopRequested = false;

            const phaseName = testType === 'TANGENTIAL' ? 'Tangential' : 'Radial';
            console.log(`\n🎯 [MasterTest] STARTING ${phaseName.toUpperCase()} TEST`);

            await testService.updateTestStatus(this.currentTest.test_id, 'IN_PROGRESS');

            // Emit phase started event
            this.emit(`${testType.toLowerCase()}_test_started`, {
                test_id: this.currentTest.test_id,
                test_type: testType
            });

            if (testType === 'TANGENTIAL') {
                await this.transitionState(TestExecutionState.TANGENTIAL_RUNNING);
                await this.executeTangentialTestIEC(this.currentTest);
                await this.transitionState(TestExecutionState.TANGENTIAL_COMPLETE);
            } else {
                await this.transitionState(TestExecutionState.RADIAL_RUNNING);
                await this.executeRadialTestIEC(this.currentTest);
                await this.transitionState(TestExecutionState.RADIAL_COMPLETE);
            }

            console.log(`\n✅ [MasterTest] ${phaseName} test complete!`);

            // Check if all tests are complete
            if (this.executionState === TestExecutionState.TANGENTIAL_COMPLETE &&
                this.testState.radial_results_count > 0) {
                // Both complete
                await this.transitionState(TestExecutionState.ALL_COMPLETE);
                await testService.updateTestStatus(this.currentTest.test_id, 'COMPLETED', undefined, new Date());
                this.emit("test_completed", { test_id: this.currentTest.test_id });
                console.log("\n🎉 [MasterTest] ALL TESTS COMPLETED!");
            } else if (this.executionState === TestExecutionState.RADIAL_COMPLETE &&
                       this.testState.tangential_results_count > 0) {
                // Both complete
                await this.transitionState(TestExecutionState.ALL_COMPLETE);
                await testService.updateTestStatus(this.currentTest.test_id, 'COMPLETED', undefined, new Date());
                this.emit("test_completed", { test_id: this.currentTest.test_id });
                console.log("\n🎉 [MasterTest] ALL TESTS COMPLETED!");
            } else {
                // One phase done, await user selection for next
                await testService.updateTestStatus(this.currentTest.test_id, 'PAUSED');

                const nextPhase = this.testState.tangential_results_count > 0 ? 'RADIAL' : 'TANGENTIAL';
                this.emit("phase_completed_awaiting_next", {
                    test_id: this.currentTest.test_id,
                    completed_phase: testType,
                    next_phase: nextPhase,
                    tangential_completed: this.testState.tangential_results_count > 0,
                    radial_completed: this.testState.radial_results_count > 0
                });
            }

            return true;

        } catch (error) {
            if (error instanceof StopRequestedError) {
                console.warn("[MasterTest] Test phase stopped by user");
                return false;
            }

            console.error("[MasterTest] Test phase failed:", error);
            await this.transitionState(TestExecutionState.ERROR);
            await testService.updateTestStatus(this.currentTest.test_id, 'ERROR', undefined, new Date());
            this.emit("test_failed", { test_id: this.currentTest.test_id, error });
            return false;
        }
    }

    /**
     * Pause the current test
     */
    async pauseTest(): Promise<void> {
        if (!this.isRunningState(this.executionState)) {
            throw new Error("No test is running");
        }

        console.log("[MasterTest] Pausing test...");

        // Transition to paused state
        if (this.executionState === TestExecutionState.BOUNDARY_RUNNING) {
            await this.transitionState(TestExecutionState.BOUNDARY_PAUSED);
        } else if (this.executionState === TestExecutionState.TANGENTIAL_RUNNING) {
            await this.transitionState(TestExecutionState.TANGENTIAL_PAUSED);
        } else if (this.executionState === TestExecutionState.RADIAL_RUNNING) {
            await this.transitionState(TestExecutionState.RADIAL_PAUSED);
        }

        if (this.currentTest) {
            await this.updateRobotPosition();
            await testService.updateTestStatus(this.currentTest.test_id, 'PAUSED');
        }

        await RobotAPIFactory.getInstance().stopMovement();
        this.emit("test_paused", {});
    }

    /**
     * Resume a paused test
     */
    async resumeTest(): Promise<void> {
        if (!this.isPausedState(this.executionState)) {
            throw new Error("Test is not paused");
        }

        console.log("[MasterTest] Resuming test...");

        // Transition back to running state
        if (this.executionState === TestExecutionState.BOUNDARY_PAUSED) {
            await this.transitionState(TestExecutionState.BOUNDARY_RUNNING);
        } else if (this.executionState === TestExecutionState.TANGENTIAL_PAUSED) {
            await this.transitionState(TestExecutionState.TANGENTIAL_RUNNING);
        } else if (this.executionState === TestExecutionState.RADIAL_PAUSED) {
            await this.transitionState(TestExecutionState.RADIAL_RUNNING);
        }

        if (this.currentTest) {
            await testService.updateTestStatus(this.currentTest.test_id, 'IN_PROGRESS');
        }

        this.emit("test_resumed", {});
    }

    /**
     * Stop the current test
     */
    async stopTest(): Promise<void> {
        console.log("[MasterTest] Stopping test...");

        this.stopRequested = true;
        await RobotAPIFactory.getInstance().stopMovement();

        if (this.currentTest && this.testState) {
            await this.updateRobotPosition();
            await testService.updateTestStatus(this.currentTest.test_id, 'PAUSED');
            await this.saveTestState();
        }

        // Emit stop event with current state
        this.emit("test_stopped", {
            awaiting_test_selection: this.executionState === TestExecutionState.BOUNDARY_COMPLETE ||
                                    this.executionState === TestExecutionState.TANGENTIAL_COMPLETE ||
                                    this.executionState === TestExecutionState.RADIAL_COMPLETE,
            current_phase: this.getCurrentPhase(),
            boundary_detection_completed: (this.testState?.boundary_results.length ?? 0) > 0,
            tangential_test_completed: (this.testState?.tangential_results_count ?? 0) > 0,
            radial_test_completed: (this.testState?.radial_results_count ?? 0) > 0
        });

        console.log("[MasterTest] Test stopped");
    }

    // =========================================================================
    // IEC 63180 TEST PROCEDURES
    // =========================================================================

    /**
     * Execute IEC 63180 Boundary Detection Test
     * Stepped approach: Start at 8m, move closer until detection
     */
    private async executeBoundaryDetectionIEC(config: MasterTestConfiguration): Promise<void> {
        await this.transitionState(TestExecutionState.BOUNDARY_RUNNING);

        const totalAngles = IEC_BOUNDARY_ANGLES.length;
        let completedCount = 0;

        for (const angle of IEC_BOUNDARY_ANGLES) {
            this.ensureNotStopped();
            await this.waitIfPaused();

            console.log(`\n[Boundary] Testing angle ${angle}° (${completedCount + 1}/${totalAngles})`);

            // Stepped approach: start far, move closer until detection
            let boundaryDistance: number | null = null;
            let detectedAt: number | null = null;
            let notDetectedAt: number | null = null;
            let currentDistance = IEC_BOUNDARY_START_DISTANCE;

            // Emit boundary step started
            this.emit("boundary_step_started", {
                angle,
                start_distance: IEC_BOUNDARY_START_DISTANCE,
                step_size: IEC_BOUNDARY_STEP_SIZE,
                min_distance: IEC_BOUNDARY_MIN_DISTANCE
            });

            while (currentDistance >= IEC_BOUNDARY_MIN_DISTANCE) {
                this.ensureNotStopped();
                await this.waitIfPaused();

                // Test tangentially at this angle and distance
                const detected = await this.testTangentialPosition(
                    config.test_id,
                    'BOUNDARY_DETECTION_STEPPED',
                    angle,
                    currentDistance,
                    config.movement_speed || 50,
                    config.detection_wait_time || 2000,
                    config.repeat_measurements || 2
                );

                console.log(`  └─ ${currentDistance.toFixed(1)}m: ${detected ? '✓ DETECTED' : '✗ No detection'}`);

                if (detected) {
                    // First detection at this distance
                    if (detectedAt === null) {
                        detectedAt = currentDistance;
                    }
                    boundaryDistance = currentDistance; // Keep updating (max distance where detected)
                } else {
                    // No detection
                    if (notDetectedAt === null || currentDistance > notDetectedAt) {
                        notDetectedAt = currentDistance;
                    }
                }

                // Emit boundary step completed
                this.emit("boundary_step_completed", {
                    angle,
                    distance: currentDistance,
                    detected,
                    boundary_found: detected && boundaryDistance !== null
                });

                // Stop if we found detection (boundary is the max distance where detected)
                if (detected) {
                    console.log(`  🎯 Boundary found at ${boundaryDistance}m for angle ${angle}°`);
                    break;
                }

                // Move closer
                currentDistance -= IEC_BOUNDARY_STEP_SIZE;
                await this.delay(100); // Small delay between steps
            }

            // Record boundary result
            const result: BoundaryResult = {
                angle,
                detection_boundary: boundaryDistance,
                detected_distance: detectedAt,
                no_detection_distance: notDetectedAt
            };

            this.testState!.boundary_results.push(result);

            // Emit boundary found event
            this.emit("boundary_found_at_angle", {
                angle,
                boundary: boundaryDistance,
                detected_at: detectedAt,
                not_detected_at: notDetectedAt
            });

            completedCount++;
            this.testState!.completed_step_count++;
            this.testState!.progress.completed = completedCount;

            await this.updateRobotPosition();
            await this.saveTestState();

            // Emit progress
            this.emit("phase_progress", {
                phase: 'BOUNDARY_DETECTION',
                total: totalAngles,
                completed: completedCount
            });

            // IEC compliance: small delay between angles
            await this.delay(250);
        }
    }

    /**
     * Execute IEC 63180 Tangential Test
     * Grid-based cell testing with 0.5m spacing
     */
    private async executeTangentialTestIEC(config: MasterTestConfiguration): Promise<void> {
        const gridCells = this.generateGridCells(IEC_GRID_CELL_SIZE, IEC_GRID_MAX_RADIUS);
        const totalCells = gridCells.length;
        let completedCount = 0;

        this.testState!.progress = {
            phase: 'TANGENTIAL_TEST',
            total: totalCells,
            completed: 0
        };

        for (const cell of gridCells) {
            this.ensureNotStopped();
            await this.waitIfPaused();

            // Test at grid cell position
            const detected = await this.testGridCell(
                config.test_id,
                cell.x,
                cell.y,
                cell.row,
                cell.col,
                config.movement_speed || 50,
                config.detection_wait_time || 2000,
                config.repeat_measurements || 2
            );

            completedCount++;
            this.testState!.tangential_results_count = completedCount;
            this.testState!.completed_step_count++;
            this.testState!.progress.completed = completedCount;

            await this.updateRobotPosition();
            await this.saveTestState();

            // Emit compliance measurement event
            this.emit("compliance_measurement_completed", {
                test_id: config.test_id,
                x: cell.x,
                y: cell.y,
                angle: cell.angle,
                distance: cell.radius,
                cell_row: cell.row,
                cell_col: cell.col,
                detected
            });

            // Emit progress
            this.emit("phase_progress", {
                phase: 'TANGENTIAL_TEST',
                total: totalCells,
                completed: completedCount
            });

            // IEC compliance: delay between cells
            await this.delay(250);
        }

        // Emit tangential test completed
        this.emit("tangential_test_completed", {
            test_id: config.test_id
        });
    }

    /**
     * Execute IEC 63180 Radial Test
     * Direct approach toward sensor at specific distances
     */
    private async executeRadialTestIEC(config: MasterTestConfiguration): Promise<void> {
        // Get unique angles from boundary results where boundary was found
        const detectedAngles = Array.from(new Set(
            this.testState!.boundary_results
                .filter(r => r.detection_boundary !== null)
                .map(r => r.angle)
        ));

        const totalMeasurements = detectedAngles.length * IEC_RADIAL_TEST_OFFSETS.length;
        let completedCount = 0;

        this.testState!.progress = {
            phase: 'RADIAL_TEST',
            total: totalMeasurements,
            completed: 0
        };

        for (const angle of detectedAngles) {
            // Find boundary distance for this angle
            const boundaryResult = this.testState!.boundary_results.find(r => r.angle === angle);
            if (!boundaryResult || boundaryResult.detection_boundary === null) continue;

            // Use the detected boundary distance
            const boundaryDistance = boundaryResult.detection_boundary;

            for (const offset of IEC_RADIAL_TEST_OFFSETS) {
                this.ensureNotStopped();
                await this.waitIfPaused();

                const testDistance = boundaryDistance + offset;

                // Test with radial approach
                const detected = await this.testRadialPosition(
                    config.test_id,
                    angle,
                    testDistance,
                    offset,
                    config.movement_speed || 50,
                    config.detection_wait_time || 2000,
                    config.repeat_measurements || 2
                );

                completedCount++;
                this.testState!.radial_results_count = completedCount;
                this.testState!.completed_step_count++;
                this.testState!.progress.completed = completedCount;

                await this.updateRobotPosition();
                await this.saveTestState();

                // Emit compliance measurement event
                this.emit("compliance_measurement_completed", {
                    test_id: config.test_id,
                    angle,
                    distance: testDistance,
                    offset_from_boundary: offset,
                    detected
                });

                // Emit progress
                this.emit("phase_progress", {
                    phase: 'RADIAL_TEST',
                    total: totalMeasurements,
                    completed: completedCount
                });

                await this.delay(250);
            }
        }

        // Emit radial test completed
        this.emit("radial_test_completed", {
            test_id: config.test_id
        });
    }

    // =========================================================================
    // MOVEMENT AND MEASUREMENT HELPERS
    // =========================================================================

    /**
     * Test position with tangential movement
     */
    private async testTangentialPosition(
        test_id: number,
        step_type: string,
        angle: number,
        distance: number,
        speed: number,
        waitTime: number,
        repeatCount: number
    ): Promise<boolean> {
        const measurements: boolean[] = [];

        for (let attempt = 1; attempt <= repeatCount; attempt++) {
            this.ensureNotStopped();

            const stepId = await testStepService.insertTestStep({
                test_step_id: null,
                test_id,
                step_type,
                sequence_no: ++this.sequenceCounter,
                angle,
                cell_row: null,
                cell_col: null,
                distance_1: distance,
                distance_2: null,
                distance_avg: null,
                detection_1: null,
                detection_2: null,
                detection_final: null,
                status: 'PENDING',
                started_at: null,
                finished_at: null
            });

            this.currentStepId = stepId;

            try {
                await testStepService.updateTestStep(stepId, {
                    status: 'RUNNING',
                    started_at: new Date()
                });

                this.detectionBuffer = [];

                // Calculate target position
                const angleRad = (angle * Math.PI) / 180;
                const targetX = distance * Math.cos(angleRad);
                const targetY = distance * Math.sin(angleRad);

                this.emit("movement_started", {
                    test_step_id: stepId,
                    angle,
                    distance,
                    attempt,
                    from_position: {
                        x: this.testState?.last_position_x || 0,
                        y: this.testState?.last_position_y || 0
                    },
                    to_position: { x: targetX, y: targetY },
                    movement_type: 'tangential'
                });

                // Move tangentially at this distance
                const result = await RobotAPIFactory.getInstance().moveTangential(angle, distance, speed);

                if (!result.success) {
                    throw new Error(`Movement failed: ${result.error}`);
                }

                // Wait for detection
                await this.delay(waitTime);
                this.ensureNotStopped();

                const detected = this.detectionBuffer.some(e => e.detected);
                measurements.push(detected);

                // Emit movement completed
                this.emit("movement_completed", {
                    test_step_id: stepId,
                    angle,
                    distance,
                    success: result.success,
                    actual_position: result.position || { x: targetX, y: targetY },
                    detected
                });

                const updates: any = {
                    status: 'COMPLETED',
                    finished_at: new Date()
                };

                if (attempt === 1) {
                    updates.detection_1 = detected;
                } else if (attempt === 2) {
                    updates.detection_2 = detected;
                    updates.detection_final = measurements[0] || measurements[1];
                }

                await testStepService.updateTestStep(stepId, updates);

                this.emit("measurement_completed", {
                    test_step_id: stepId,
                    angle,
                    distance,
                    attempt,
                    detected
                });

            } catch (error) {
                console.error("[MasterTest] Measurement failed:", error);
                await testStepService.updateTestStep(stepId, {
                    status: 'ERROR',
                    finished_at: new Date()
                });
                throw error;
            }
        }

        this.currentStepId = null;
        return measurements[0] || measurements[1];
    }

    /**
     * Test grid cell position
     */
    private async testGridCell(
        test_id: number,
        x: number,
        y: number,
        row: number,
        col: number,
        speed: number,
        waitTime: number,
        repeatCount: number
    ): Promise<boolean> {
        const angle = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
        const distance = Math.sqrt(x * x + y * y);
        const measurements: boolean[] = [];

        for (let attempt = 1; attempt <= repeatCount; attempt++) {
            this.ensureNotStopped();

            const stepId = await testStepService.insertTestStep({
                test_step_id: null,
                test_id,
                step_type: 'GRID_TANGENTIAL',
                sequence_no: ++this.sequenceCounter,
                angle,
                cell_row: row,
                cell_col: col,
                distance_1: distance,
                distance_2: null,
                distance_avg: null,
                detection_1: null,
                detection_2: null,
                detection_final: null,
                status: 'PENDING',
                started_at: null,
                finished_at: null
            });

            this.currentStepId = stepId;

            try {
                await testStepService.updateTestStep(stepId, {
                    status: 'RUNNING',
                    started_at: new Date()
                });

                this.detectionBuffer = [];

                this.emit("movement_started", {
                    test_step_id: stepId,
                    x,
                    y,
                    row,
                    col,
                    attempt
                });

                // Move to grid cell position (Cartesian)
                const result = await RobotAPIFactory.getInstance().moveCartesian(x, y, speed);

                if (!result.success) {
                    throw new Error(`Movement failed: ${result.error}`);
                }

                await this.delay(waitTime);
                this.ensureNotStopped();

                const detected = this.detectionBuffer.some(e => e.detected);
                measurements.push(detected);

                const updates: any = {
                    status: 'COMPLETED',
                    finished_at: new Date()
                };

                if (attempt === 1) {
                    updates.detection_1 = detected;
                } else if (attempt === 2) {
                    updates.detection_2 = detected;
                    updates.detection_final = measurements[0] || measurements[1];
                }

                await testStepService.updateTestStep(stepId, updates);

                this.emit("measurement_completed", {
                    test_step_id: stepId,
                    x,
                    y,
                    row,
                    col,
                    attempt,
                    detected
                });

            } catch (error) {
                console.error("[MasterTest] Grid cell measurement failed:", error);
                await testStepService.updateTestStep(stepId, {
                    status: 'ERROR',
                    finished_at: new Date()
                });
                throw error;
            }
        }

        this.currentStepId = null;
        return measurements[0] || measurements[1];
    }

    /**
     * Test radial position (approaching sensor directly)
     */
    private async testRadialPosition(
        test_id: number,
        angle: number,
        distance: number,
        offset_from_boundary: number,
        speed: number,
        waitTime: number,
        repeatCount: number
    ): Promise<boolean> {
        const measurements: boolean[] = [];

        for (let attempt = 1; attempt <= repeatCount; attempt++) {
            this.ensureNotStopped();

            const stepId = await testStepService.insertTestStep({
                test_step_id: null,
                test_id,
                step_type: 'COMPLIANCE_RADIAL',
                sequence_no: ++this.sequenceCounter,
                angle,
                cell_row: null,
                cell_col: null,
                distance_1: distance,
                distance_2: offset_from_boundary,
                distance_avg: null,
                detection_1: null,
                detection_2: null,
                detection_final: null,
                status: 'PENDING',
                started_at: null,
                finished_at: null
            });

            this.currentStepId = stepId;

            try {
                await testStepService.updateTestStep(stepId, {
                    status: 'RUNNING',
                    started_at: new Date()
                });

                this.detectionBuffer = [];

                this.emit("movement_started", {
                    test_step_id: stepId,
                    angle,
                    distance,
                    offset_from_boundary,
                    attempt
                });

                // Move radially (polar coordinates)
                const result = await RobotAPIFactory.getInstance().movePolar(angle, distance, speed);

                if (!result.success) {
                    throw new Error(`Movement failed: ${result.error}`);
                }

                await this.delay(waitTime);
                this.ensureNotStopped();

                const detected = this.detectionBuffer.some(e => e.detected);
                measurements.push(detected);

                const updates: any = {
                    status: 'COMPLETED',
                    finished_at: new Date()
                };

                if (attempt === 1) {
                    updates.detection_1 = detected;
                } else if (attempt === 2) {
                    updates.detection_2 = detected;
                    updates.detection_final = measurements[0] || measurements[1];
                }

                await testStepService.updateTestStep(stepId, updates);

                this.emit("measurement_completed", {
                    test_step_id: stepId,
                    angle,
                    distance,
                    offset_from_boundary,
                    attempt,
                    detected
                });

            } catch (error) {
                console.error("[MasterTest] Radial measurement failed:", error);
                await testStepService.updateTestStep(stepId, {
                    status: 'ERROR',
                    finished_at: new Date()
                });
                throw error;
            }
        }

        this.currentStepId = null;
        return measurements[0] || measurements[1];
    }

    /**
     * Generate Cartesian grid cells for tangential test
     */
    private generateGridCells(cellSize: number, maxRadius: number): GridCell[] {
        const cells: GridCell[] = [];
        const steps = Math.ceil(maxRadius / cellSize);

        for (let row = -steps; row <= steps; row++) {
            for (let col = -steps; col <= steps; col++) {
                const x = col * cellSize;
                const y = row * cellSize;
                const radius = Math.sqrt(x * x + y * y);

                // Skip origin and cells beyond max radius
                if (radius <= 0.1 || radius > maxRadius) continue;

                const angle = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
                cells.push({ x, y, row, col, angle, radius });
            }
        }

        // Sort by radius first, then angle
        cells.sort((a, b) => {
            if (Math.abs(a.radius - b.radius) > 0.01) return a.radius - b.radius;
            return a.angle - b.angle;
        });

        return cells;
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    private async updateRobotPosition(): Promise<void> {
        try {
            const position = await RobotAPIFactory.getInstance().getCurrentPosition();

            if (position && this.testState) {
                this.testState.last_position_x = position.x;
                this.testState.last_position_y = position.y;
                this.testState.last_position_timestamp = new Date();

                this.emit("position_updated", {
                    test_id: this.testState.test_id,
                    x: position.x,
                    y: position.y
                });

                try {
                    await TelemetryService.recordSample({
                        test_id: this.testState.test_id,
                        robot_position_x: position.x,
                        robot_position_y: position.y,
                        timestamp: new Date()
                    });
                } catch (telemetryErr) {
                    console.warn("[MasterTest] Failed to record telemetry position:", telemetryErr);
                }
            }
        } catch (error) {
            console.warn(`[MasterTest] Failed to get robot position:`, error);
        }
    }

    private async saveTestState(): Promise<void> {
        if (!this.testState) return;

        await pool.query(
            `INSERT INTO test_state (
                test_id, current_phase, boundary_results, awaiting_confirmation,
                completed_step_count, last_position_x, last_position_y, last_position_timestamp,
                state_data, updated_at
            )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
             ON CONFLICT (test_id)
             DO UPDATE SET
                current_phase = $2,
                boundary_results = $3,
                awaiting_confirmation = $4,
                completed_step_count = $5,
                last_position_x = $6,
                last_position_y = $7,
                last_position_timestamp = $8,
                state_data = $9,
                updated_at = NOW()`,
            [
                this.testState.test_id,
                this.getCurrentPhase(),
                JSON.stringify(this.testState.boundary_results),
                false, // awaiting_confirmation deprecated
                this.testState.completed_step_count,
                this.testState.last_position_x,
                this.testState.last_position_y,
                this.testState.last_position_timestamp,
                JSON.stringify(this.testState)
            ]
        );
    }

    private getCurrentPhase(): TestPhase {
        switch (this.executionState) {
            case TestExecutionState.BOUNDARY_RUNNING:
            case TestExecutionState.BOUNDARY_PAUSED:
            case TestExecutionState.BOUNDARY_COMPLETE:
                return 'BOUNDARY_DETECTION';
            case TestExecutionState.TANGENTIAL_RUNNING:
            case TestExecutionState.TANGENTIAL_PAUSED:
            case TestExecutionState.TANGENTIAL_COMPLETE:
                return 'TANGENTIAL_TEST';
            case TestExecutionState.RADIAL_RUNNING:
            case TestExecutionState.RADIAL_PAUSED:
            case TestExecutionState.RADIAL_COMPLETE:
                return 'RADIAL_TEST';
            case TestExecutionState.ALL_COMPLETE:
                return 'COMPLETED';
            default:
                return 'BOUNDARY_DETECTION';
        }
    }

    private isRunningState(state: TestExecutionState): boolean {
        return state === TestExecutionState.BOUNDARY_RUNNING ||
               state === TestExecutionState.TANGENTIAL_RUNNING ||
               state === TestExecutionState.RADIAL_RUNNING;
    }

    private isPausedState(state: TestExecutionState): boolean {
        return state === TestExecutionState.BOUNDARY_PAUSED ||
               state === TestExecutionState.TANGENTIAL_PAUSED ||
               state === TestExecutionState.RADIAL_PAUSED;
    }

    private ensureNotStopped(): void {
        if (this.stopRequested) {
            throw new StopRequestedError();
        }
    }

    private async waitIfPaused(): Promise<void> {
        while (this.isPausedState(this.executionState) && !this.stopRequested) {
            await this.delay(100);
        }
    }

    private delay(ms: number): Promise<void> {
        return TimeUtility.delay(ms);
    }

    // =========================================================================
    // PUBLIC ACCESSORS
    // =========================================================================

    getTestState(): TestState | null {
        return this.testState;
    }

    getExecutionState(): TestExecutionState {
        return this.executionState;
    }

    isTestRunning(): boolean {
        return this.isRunningState(this.executionState);
    }

    isTestPaused(): boolean {
        return this.isPausedState(this.executionState);
    }

    getCurrentTest(): MasterTestConfiguration | null {
        return this.currentTest;
    }
}

export default MasterTestOrchestrator;
