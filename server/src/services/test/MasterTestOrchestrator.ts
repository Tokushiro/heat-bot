import { EventEmitter } from "events";
import { Position } from "../../api/implementations/real/RealRobotAPI";
import { RobotAPIFactory } from "../../api/factories/RobotAPIFactory";
import { SensorAPIFactory } from "../../api/factories/SensorAPIFactory";
import { RobotSensorIntegration } from "../../api/implementations/mock/RobotSensorIntegration";
import bleEventBus, { DetectionEvent } from "../core/BleEventBus";
import * as testService from "./TestService";
import * as testStepService from "./TestStepService";
import pool from "../../db_conn";

class StopRequestedError extends Error {
    constructor() {
        super("STOP_REQUESTED");
        this.name = "StopRequestedError";
    }
}

export type TestPhase = 'BOUNDARY_DETECTION' | 'TANGENTIAL_TEST' | 'RADIAL_TEST' | 'COMPLETED';
export type TestType = 'RADIAL' | 'TANGENTIAL' | 'FULL';

export interface BoundaryResult {
    angle: number;
    detected_distance: number | null;
    no_detection_distance: number | null;
    detection_boundary: number | null;
}

export interface MasterTestConfiguration {
    test_id: number;
    sensor_id: number;
    test_type: TestType;
    
    boundary_angles: number[];
    boundary_start_distance: number;
    boundary_end_distance: number;
    boundary_step: number;
    
    compliance_test_distances: number[];
    compliance_tangential_sweep?: boolean;
    compliance_tangential_step?: number;
    
    movement_speed?: number;
    detection_wait_time?: number;
    repeat_measurements?: number;
}

export interface TestState {
    test_id: number;
    current_phase: TestPhase;
    boundary_results: BoundaryResult[];
    awaiting_user_confirmation: boolean;
    awaiting_test_selection?: boolean; // Waiting for user to choose tangential/radial

    // Track completed phases
    boundary_detection_completed: boolean;
    tangential_test_completed: boolean;
    radial_test_completed: boolean;

    // Resume information
    last_completed_angle?: number;
    last_completed_distance?: number;
    completed_step_count: number;

    // Physical position tracking
    last_position_x?: number;
    last_position_y?: number;
    last_position_timestamp?: Date;

    progress: {
        phase: TestPhase;
        total_steps: number;
        completed_steps: number;
        current_step: number;
    };
}

export class MasterTestOrchestrator extends EventEmitter {
    private static _instance: MasterTestOrchestrator;
    private currentTest: MasterTestConfiguration | null = null;
    private testState: TestState | null = null;
    private currentStepId: number | null = null;
    private detectionBuffer: DetectionEvent[] = [];
    private isRunning: boolean = false;
    private isPaused: boolean = false;
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
            }
        });
    }

    /**
     * Start a new test OR resume from saved state
     */
    async startTest(config: MasterTestConfiguration, resuming: boolean = false): Promise<boolean> {
        console.log("\n" + "=".repeat(80));
        console.log("🚀 [MasterTest] START TEST CALLED");
        console.log("=".repeat(80));
        console.log(`   Test ID: ${config.test_id}`);
        console.log(`   Sensor ID: ${config.sensor_id}`);
        console.log(`   Test Type: ${config.test_type}`);
        console.log(`   Resuming: ${resuming}`);
        console.log(`   Already Running: ${this.isRunning}`);
        console.log("=".repeat(80) + "\n");

        if (this.isRunning) {
            console.error("[MasterTest] ❌ Test already running");
            throw new Error("Test already running");
        }

        try {
            console.log("[MasterTest] ✅ Setting test state to RUNNING");
            this.isRunning = true;
            this.isPaused = false;
            this.stopRequested = false;
            this.currentTest = config;

            if (resuming) {
                console.log("[MasterTest] 📂 Resuming existing test...");
                await this.resumeExistingTest(config.test_id);
            } else {
                console.log("[MasterTest] 🆕 Starting new test...");
                await this.startNewTest(config);
            }

            console.log("[MasterTest] ✅ Test execution completed successfully");
            return true;

        } catch (error) {
            if (error instanceof StopRequestedError) {
                console.warn("[MasterTest] Test stopped by user");
                return false;
            }

            console.error("\n" + "=".repeat(80));
            console.error("❌ [MasterTest] TEST FAILED");
            console.error("=".repeat(80));
            console.error("[MasterTest] Error:", error);
            console.error("=".repeat(80) + "\n");

            await testService.updateTestStatus(
                config.test_id,
                'ERROR',
                undefined,
                new Date()
            );

            this.emit("test_failed", { test_id: config.test_id, error });
            return false;

        } finally {
            // Keep state if awaiting user confirmation OR test selection
            if (!this.testState?.awaiting_user_confirmation && !this.testState?.awaiting_test_selection) {
                console.log("[MasterTest] 🏁 Test finished - Clearing running state");
                this.isRunning = false;
                this.currentTest = null;
            } else {
                console.log("[MasterTest] ⏸️ Test paused - Awaiting user input");
            }
        }
    }

    /**
     * Start a brand new test
     */
    private async startNewTest(config: MasterTestConfiguration): Promise<void> {
        console.log("\n┌" + "─".repeat(78) + "┐");
        console.log("│ 🆕 STARTING NEW TEST");
        console.log("└" + "─".repeat(78) + "┘\n");

        console.log("[MasterTest] Step 1/7: Initializing test state...");
        this.emit("test_log", { message: "Step 1/7: Initializing test state..." });
        this.sequenceCounter = 0;

        this.testState = {
            test_id: config.test_id,
            current_phase: 'BOUNDARY_DETECTION',
            boundary_results: [],
            awaiting_user_confirmation: false,
            awaiting_test_selection: false,
            boundary_detection_completed: false,
            tangential_test_completed: false,
            radial_test_completed: false,
            completed_step_count: 0,
            progress: {
                phase: 'BOUNDARY_DETECTION',
                total_steps: this.calculateTotalSteps(config, 'BOUNDARY_DETECTION'),
                completed_steps: 0,
                current_step: 0
            }
        };
        console.log("[MasterTest] ✅ Test state initialized");
        console.log(`   - Total steps for boundary detection: ${this.testState.progress.total_steps}`);
        this.emit("test_log", { message: `✅ Test state initialized (${this.testState.progress.total_steps} steps)` });

        console.log("\n[MasterTest] Step 2/7: Saving test state to database...");
        this.emit("test_log", { message: "Step 2/7: Saving test state..." });
        await this.saveTestState();
        console.log("[MasterTest] ✅ Test state saved");
        this.emit("test_log", { message: "✅ Test state saved to database" });

        console.log("\n[MasterTest] Step 3/7: Updating test status to IN_PROGRESS...");
        this.emit("test_log", { message: "Step 3/7: Updating test status..." });
        await testService.updateTestStatus(config.test_id, 'IN_PROGRESS', new Date());
        console.log("[MasterTest] ✅ Test status updated");
        this.emit("test_log", { message: "✅ Test status: IN_PROGRESS" });

        console.log("\n[MasterTest] Step 4/7: Emitting test_started event...");
        this.emit("test_started", {
            test_id: config.test_id,
            phase: 'BOUNDARY_DETECTION'
        });
        console.log("[MasterTest] ✅ Event emitted");

        console.log("\n[MasterTest] Step 5/7: Initializing robot...");
        this.emit("test_log", { message: `Step 5/7: Initializing robot (${RobotAPIFactory.getMode()} mode)...` });
        const robot = RobotAPIFactory.getInstance();
        console.log(`   - Robot mode: ${RobotAPIFactory.getMode()}`);
        const initialized = await robot.initialize();
        if (!initialized) {
            throw new Error("Robot initialization failed");
        }
        console.log("[MasterTest] ✅ Robot initialized successfully");
        this.emit("test_log", { message: `✅ Robot initialized (${RobotAPIFactory.getMode()} mode)` });

        console.log("\n[MasterTest] Step 6/7: Initializing sensor...");
        this.emit("test_log", { message: `Step 6/7: Initializing sensor (${SensorAPIFactory.getMode()} mode)...` });
        const sensor = SensorAPIFactory.getInstance();
        console.log(`   - Sensor mode: ${SensorAPIFactory.getMode()}`);
        console.log(`   - Sensor ID: sensor-${config.sensor_id}`);
        console.log(`   - MAC Address: ${process.env.BLE_SENSOR_MAC || "00:00:00:00:00:00"}`);
        const sensorInitialized = await sensor.initialize({
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

        if (!sensorInitialized) {
            throw new Error("Sensor initialization failed");
        }
        console.log("[MasterTest] ✅ Sensor initialized successfully");
        this.emit("test_log", { message: `✅ Sensor initialized (${SensorAPIFactory.getMode()} mode)` });

        console.log("\n[MasterTest]    Starting sensor detection...");
        this.emit("test_log", { message: "Starting sensor detection monitoring..." });
        await sensor.startDetection();
        console.log("[MasterTest] ✅ Sensor detection started");
        this.emit("test_log", { message: "✅ Sensor detection monitoring active" });

        console.log("\n[MasterTest] Step 7/7: Initializing robot-sensor integration...");
        this.emit("test_log", { message: "Step 7/7: Initializing integration..." });
        RobotSensorIntegration.instance.initialize();
        console.log("[MasterTest] ✅ Integration initialized");
        this.emit("test_log", { message: "✅ Robot-Sensor integration ready" });

        // Check if boundary detection is already complete
        const existingState = await this.loadTestState(config.test_id);
        if (existingState && existingState.boundary_results && existingState.boundary_results.length > 0) {
            console.log("\n" + "=".repeat(80));
            console.log("⏩ [MasterTest] BOUNDARY DETECTION ALREADY COMPLETE");
            console.log("=".repeat(80));
            console.log(`   Found ${existingState.boundary_results.length} existing boundary results`);
            console.log("   Skipping boundary detection phase");
            console.log("=".repeat(80) + "\n");

            this.testState!.boundary_results = existingState.boundary_results;
            this.emit("test_log", { message: `Boundary detection already complete (${existingState.boundary_results.length} angles detected)` });
        } else {
            console.log("\n" + "=".repeat(80));
            console.log("🎯 [MasterTest] STARTING BOUNDARY DETECTION PHASE");
            console.log("=".repeat(80));
            console.log(`   Test angles: ${config.boundary_angles.join(', ')}°`);
            console.log(`   Distance range: ${config.boundary_end_distance}m - ${config.boundary_start_distance}m`);
            console.log(`   Step size: ${config.boundary_step}m`);
            console.log(`   Speed: ${config.movement_speed || 50}`);
            console.log("=".repeat(80) + "\n");

            await this.executeBoundaryDetection(config);
        }

        console.log("\n" + "=".repeat(80));
        console.log("✅ [MasterTest] BOUNDARY DETECTION PHASE COMPLETE");
        console.log("=".repeat(80));
        console.log(`   Detected boundaries at ${this.testState!.boundary_results.length} angles`);
        console.log("=".repeat(80) + "\n");

        console.log("[MasterTest] Saving boundary results to database...");
        await this.saveBoundaryResults();
        console.log("[MasterTest] ✅ Boundary results saved");

        console.log("\n[MasterTest] Setting test phase to awaiting test selection...");
        this.testState.current_phase = 'BOUNDARY_DETECTION';
        this.testState.boundary_detection_completed = true;
        this.testState.awaiting_test_selection = true;
        this.testState.awaiting_user_confirmation = false;
        await this.saveTestState();
        console.log("[MasterTest] ✅ Test state saved");

        console.log("\n[MasterTest] Pausing test and updating status...");
        this.isRunning = false;
        await testService.updateTestStatus(config.test_id, 'PAUSED');
        console.log("[MasterTest] ✅ Test paused - Awaiting user test selection");

        console.log("\n[MasterTest] Emitting boundary_detection_completed event...");
        this.emit("boundary_detection_completed", {
            test_id: config.test_id,
            boundary_results: this.testState.boundary_results,
            message: "Boundary detection complete. Choose which test to run first:",
            tangential_completed: this.testState.tangential_test_completed,
            radial_completed: this.testState.radial_test_completed
        });
        console.log("[MasterTest] ✅ Event emitted");

        console.log("\n" + "=".repeat(80));
        console.log("⏸️  [MasterTest] TEST PAUSED - AWAITING TEST SELECTION");
        console.log("=".repeat(80) + "\n");
    }

    /**
     * Resume existing test from saved state with position restore
     */
    private async resumeExistingTest(test_id: number): Promise<void> {
        console.log(`[MasterTest] Resuming test ${test_id} from saved state`);

        const savedState = await this.loadTestState(test_id);
        if (!savedState) {
            throw new Error("No saved state found for test");
        }

        this.testState = savedState;

        if (!this.currentTest) {
            throw new Error("Test configuration not provided");
        }

        const maxSeq = await this.getMaxSequenceNumber(test_id);
        this.sequenceCounter = maxSeq;

        console.log(`[MasterTest] Resuming at sequence ${this.sequenceCounter}, phase: ${this.testState.current_phase}`);

        // Initialize sensor for resumed test
        const sensor = SensorAPIFactory.getInstance();
        await sensor.initialize({
            sensorId: `sensor-${this.currentTest.sensor_id}`,
            mac: process.env.BLE_SENSOR_MAC || "00:00:00:00:00:00",
            mountingHeight: 1.7
        });
        await sensor.startDetection();

        // Initialize robot-sensor integration (for mock mode)
        RobotSensorIntegration.instance.initialize();

        // NEW: Move robot to last saved position if available
        if (this.testState.last_position_x !== undefined && this.testState.last_position_y !== undefined) {
            console.log(`[MasterTest] Moving robot to last saved position: (${this.testState.last_position_x}, ${this.testState.last_position_y})`);
            
            this.emit("resuming_to_position", {
                test_id,
                x: this.testState.last_position_x,
                y: this.testState.last_position_y,
                timestamp: this.testState.last_position_timestamp
            });

            const moveResult = await RobotAPIFactory.getInstance().moveCartesian(
                this.testState.last_position_x,
                this.testState.last_position_y,
                50 // speed
            );

            if (!moveResult.success) {
                console.warn(`[MasterTest] Failed to move to last position: ${moveResult.error}`);
                // Continue anyway - we'll still skip completed measurements
            } else {
                console.log(`[MasterTest] Robot restored to last position successfully`);
                this.emit("position_restored", {
                    test_id,
                    x: this.testState.last_position_x,
                    y: this.testState.last_position_y
                });
            }
        }

        await testService.updateTestStatus(test_id, 'IN_PROGRESS');

        this.emit("test_resumed_from_state", { 
            test_id, 
            phase: this.testState.current_phase,
            completed_steps: this.testState.completed_step_count,
            last_position: {
                x: this.testState.last_position_x,
                y: this.testState.last_position_y
            }
        });

        if (this.testState.awaiting_test_selection) {
            this.isRunning = false;
            await testService.updateTestStatus(test_id, 'PAUSED');

            this.emit("boundary_detection_completed", {
                test_id: test_id,
                boundary_results: this.testState.boundary_results,
                message: "Boundary detection was completed earlier. Choose which test to run:",
                tangential_completed: this.testState.tangential_test_completed,
                radial_completed: this.testState.radial_test_completed
            });

        } else if (this.testState.awaiting_user_confirmation) {
            // Legacy: awaiting to continue to next phase
            this.isRunning = false;
            await testService.updateTestStatus(test_id, 'PAUSED');

            this.emit("boundary_detection_completed", {
                test_id: test_id,
                boundary_results: this.testState.boundary_results,
                message: "Boundary detection was completed earlier. Choose which test to run:",
                tangential_completed: this.testState.tangential_test_completed || false,
                radial_completed: this.testState.radial_test_completed || false
            });

        } else if (this.testState.current_phase === 'BOUNDARY_DETECTION') {
            await this.resumeBoundaryDetection(this.currentTest);

            await this.saveBoundaryResults();
            this.testState.boundary_detection_completed = true;
            this.testState.awaiting_test_selection = true;
            this.testState.awaiting_user_confirmation = false;
            await this.saveTestState();

            this.isRunning = false;
            await testService.updateTestStatus(test_id, 'PAUSED');

            this.emit("boundary_detection_completed", {
                test_id: test_id,
                boundary_results: this.testState.boundary_results,
                message: "Boundary detection complete. Choose which test to run first:",
                tangential_completed: this.testState.tangential_test_completed,
                radial_completed: this.testState.radial_test_completed
            });

        } else if (this.testState.current_phase === 'TANGENTIAL_TEST' || this.testState.current_phase === 'RADIAL_TEST') {
            // Resume tangential or radial test
            const testType = this.testState.current_phase === 'TANGENTIAL_TEST' ? 'TANGENTIAL' : 'RADIAL';
            await this.startNextPhase(testType);
        }
    }

    private async resumeBoundaryDetection(config: MasterTestConfiguration): Promise<void> {
        console.log("[MasterTest] Resuming boundary detection");

        const angles = config.boundary_angles;
        const completedMeasurements = await this.getCompletedBoundaryMeasurements(config.test_id);
        
        this.emit("phase_progress", {
            phase: 'BOUNDARY_DETECTION',
            total_angles: angles.length,
            completed_angles: this.testState!.boundary_results.length
        });

        for (let i = 0; i < angles.length; i++) {
            const angle = angles[i];
            this.ensureNotStopped();
            
            const existingResult = this.testState!.boundary_results.find(r => r.angle === angle);
            if (existingResult) {
                console.log(`[MasterTest] Angle ${angle}° already completed, skipping`);
                continue;
            }
            
            if (this.isPaused) await this.waitForResume();
            this.ensureNotStopped();

            const boundaryResult = await this.findBoundaryAtAngle(
                config.test_id,
                angle,
                config.boundary_start_distance,
                config.boundary_end_distance,
                config.boundary_step,
                config.movement_speed || 50,
                config.detection_wait_time || 2000,
                config.repeat_measurements || 2,
                completedMeasurements.filter(m => m.angle === angle)
            );

            this.testState!.boundary_results.push(boundaryResult);
            this.testState!.completed_step_count++;
            
            // Save position after completing angle
            await this.updateRobotPosition();
            await this.saveTestState();

            this.emit("boundary_found_at_angle", {
                test_id: config.test_id,
                angle,
                boundary: boundaryResult.detection_boundary
            });

            this.emit("phase_progress", {
                phase: 'BOUNDARY_DETECTION',
                total_angles: angles.length,
                completed_angles: this.testState!.boundary_results.length
            });
        }
    }

    private async resumeComplianceTest(config: MasterTestConfiguration): Promise<void> {
        console.log("[MasterTest] Resuming compliance test");

        const testDistances = config.compliance_test_distances;
        const boundaries = this.testState!.boundary_results;

        const completedMeasurements = await this.getCompletedComplianceMeasurements(config.test_id);
        
        const totalPositions = boundaries.length * testDistances.length;
        let completedCount = completedMeasurements.length;

        this.emit("phase_progress", {
            phase: 'COMPLIANCE_TEST',
            total_positions: totalPositions,
            completed_positions: completedCount
        });

        for (const boundary of boundaries) {
            this.ensureNotStopped();
            if (boundary.detection_boundary === null) {
                console.warn(`No boundary found at angle ${boundary.angle}, skipping compliance test`);
                continue;
            }

            for (const offsetDistance of testDistances) {
                if (this.isPaused) await this.waitForResume();
                this.ensureNotStopped();

                // Subtract offset to test INSIDE the boundary (closer to sensor)
                // E.g., if boundary is 8m and offset is 2m, test at 6m (not 10m!)
                const testDistance = boundary.detection_boundary - offsetDistance;

                const alreadyCompleted = completedMeasurements.some(
                    m => m.angle === boundary.angle && 
                         Math.abs(m.distance - testDistance) < 0.01 &&
                         m.step_type === 'COMPLIANCE_RADIAL'
                );

                if (alreadyCompleted) {
                    console.log(`[MasterTest] Compliance at angle ${boundary.angle}°, distance ${testDistance}m already completed, skipping`);
                    continue;
                }

                await this.performComplianceMeasurement(
                    config.test_id,
                    boundary.angle,
                    testDistance,
                    offsetDistance,
                    config.movement_speed || 50,
                    config.detection_wait_time || 2000,
                    config.repeat_measurements || 2
                );

                completedCount++;
                this.testState!.completed_step_count++;
                
                // Save position after each measurement
                await this.updateRobotPosition();
                await this.saveTestState();

                this.emit("phase_progress", {
                    phase: 'COMPLIANCE_TEST',
                    total_positions: totalPositions,
                    completed_positions: completedCount
                });

                if (config.compliance_tangential_sweep) {
                    await this.performTangentialSweep(
                        config.test_id,
                        testDistance,
                        config.compliance_tangential_step || 15,
                        config.movement_speed || 50,
                        config.detection_wait_time || 2000,
                        config.repeat_measurements || 2
                    );
                }
            }
        }
    }

    private async executeBoundaryDetection(config: MasterTestConfiguration): Promise<void> {
        const angles = config.boundary_angles;

        this.emit("phase_progress", {
            phase: 'BOUNDARY_DETECTION',
            total_angles: angles.length,
            completed_angles: 0
        });

        for (let i = 0; i < angles.length; i++) {
            const angle = angles[i];
            this.ensureNotStopped();
            
            if (this.isPaused) await this.waitForResume();
            this.ensureNotStopped();

            const boundaryResult = await this.findBoundaryAtAngle(
                config.test_id,
                angle,
                config.boundary_start_distance,
                config.boundary_end_distance,
                config.boundary_step,
                config.movement_speed || 50,
                config.detection_wait_time || 2000,
                config.repeat_measurements || 2
            );

            this.testState!.boundary_results.push(boundaryResult);
            this.testState!.completed_step_count++;
            
            // NEW: Save robot position after each angle
            await this.updateRobotPosition();
            await this.saveTestState();

            this.emit("boundary_found_at_angle", {
                test_id: config.test_id,
                angle,
                boundary: boundaryResult.detection_boundary
            });

            this.emit("phase_progress", {
                phase: 'BOUNDARY_DETECTION',
                total_angles: angles.length,
                completed_angles: i + 1
            });
        }
    }

    private async findBoundaryAtAngle(
        test_id: number,
        angle: number,
        startDistance: number,
        endDistance: number,
        step: number,
        speed: number,
        waitTime: number,
        repeatCount: number,
        skipMeasurements: any[] = []
    ): Promise<BoundaryResult> {
        let detectedDistance: number | null = null;
        let noDetectionDistance: number | null = null;

        for (let distance = startDistance; distance >= endDistance; distance -= step) {
            this.ensureNotStopped();
            if (this.isPaused) await this.waitForResume();
            this.ensureNotStopped();

            const alreadyDone = skipMeasurements.some(
                m => Math.abs(m.distance - distance) < 0.01 && m.status === 'COMPLETED'
            );

            if (alreadyDone) {
                console.log(`[MasterTest] Skipping completed measurement at ${angle}°, ${distance}m`);
                const existingMeasurement = skipMeasurements.find(
                    m => Math.abs(m.distance - distance) < 0.01
                );
                if (existingMeasurement?.detection_final && detectedDistance === null) {
                    detectedDistance = distance;
                    break;
                } else if (!existingMeasurement?.detection_final) {
                    noDetectionDistance = distance;
                }
                continue;
            }

            const detected = await this.testPositionWithRepeats(
                test_id,
                'BOUNDARY_DETECTION_RADIAL',
                angle,
                distance,
                speed,
                waitTime,
                repeatCount
            );

            if (detected && detectedDistance === null) {
                detectedDistance = distance;
                break;
            } else if (!detected) {
                noDetectionDistance = distance;
            }
        }

        let detectionBoundary: number | null = null;
        if (detectedDistance !== null && noDetectionDistance !== null) {
            detectionBoundary = (detectedDistance + noDetectionDistance) / 2;
        } else if (detectedDistance !== null) {
            detectionBoundary = detectedDistance;
        }

        return {
            angle,
            detected_distance: detectedDistance,
            no_detection_distance: noDetectionDistance,
            detection_boundary: detectionBoundary
        };
    }

    /**
     * Execute radial test phase (testing at boundary + offset distances)
     */
    private async executeRadialTest(config: MasterTestConfiguration): Promise<void> {
        const testDistances = config.compliance_test_distances;
        const boundaries = this.testState!.boundary_results;

        const totalPositions = boundaries.filter(b => b.detection_boundary !== null).length * testDistances.length;

        this.emit("phase_progress", {
            phase: 'RADIAL_TEST',
            total_positions: totalPositions,
            completed_positions: 0
        });

        let completedCount = 0;

        for (const boundary of boundaries) {
            this.ensureNotStopped();
            if (boundary.detection_boundary === null) {
                console.warn(`No boundary found at angle ${boundary.angle}, skipping radial test`);
                continue;
            }

            for (const offsetDistance of testDistances) {
                if (this.isPaused) await this.waitForResume();
                this.ensureNotStopped();

                // Subtract offset to test INSIDE the boundary (closer to sensor)
                // E.g., if boundary is 8m and offset is 2m, test at 6m (not 10m!)
                const testDistance = boundary.detection_boundary - offsetDistance;

                await this.performComplianceMeasurement(
                    config.test_id,
                    boundary.angle,
                    testDistance,
                    offsetDistance,
                    config.movement_speed || 50,
                    config.detection_wait_time || 2000,
                    config.repeat_measurements || 2
                );

                completedCount++;
                this.testState!.completed_step_count++;

                await this.updateRobotPosition();
                await this.saveTestState();

                this.emit("phase_progress", {
                    phase: 'RADIAL_TEST',
                    total_positions: totalPositions,
                    completed_positions: completedCount
                });
            }
        }
    }

    /**
     * Execute tangential test phase (sweeping around at fixed radii)
     */
    private async executeTangentialTest(config: MasterTestConfiguration): Promise<void> {
        const testDistances = config.compliance_test_distances;
        const angleStep = config.compliance_tangential_step || 15;
        const totalAngles = Math.floor(360 / angleStep);
        const totalPositions = testDistances.length * totalAngles;

        this.emit("phase_progress", {
            phase: 'TANGENTIAL_TEST',
            total_positions: totalPositions,
            completed_positions: 0
        });

        let completedCount = 0;

        // For each test distance (e.g., 2m, 3m from sensor)
        for (const testDistance of testDistances) {
            this.ensureNotStopped();

            // Sweep around 360° at this fixed radius
            for (let angle = 0; angle < 360; angle += angleStep) {
                if (this.isPaused) await this.waitForResume();
                this.ensureNotStopped();

                await this.testPositionWithRepeats(
                    config.test_id,
                    'COMPLIANCE_TANGENTIAL',
                    angle,
                    testDistance,
                    config.movement_speed || 50,
                    config.detection_wait_time || 2000,
                    config.repeat_measurements || 2
                );

                completedCount++;
                this.testState!.completed_step_count++;

                await this.updateRobotPosition();
                await this.saveTestState();

                this.emit("phase_progress", {
                    phase: 'TANGENTIAL_TEST',
                    total_positions: totalPositions,
                    completed_positions: completedCount
                });
            }
        }
    }

    /**
     * Legacy compliance test method (combines both radial and tangential)
     * Kept for backward compatibility
     */
    private async executeComplianceTest(config: MasterTestConfiguration): Promise<void> {
        const testDistances = config.compliance_test_distances;
        const boundaries = this.testState!.boundary_results;

        this.emit("phase_progress", {
            phase: 'COMPLIANCE_TEST',
            total_positions: boundaries.length * testDistances.length,
            completed_positions: 0
        });

        let completedCount = 0;

        for (const boundary of boundaries) {
            this.ensureNotStopped();
            if (boundary.detection_boundary === null) {
                console.warn(`No boundary found at angle ${boundary.angle}, skipping compliance test`);
                continue;
            }

            for (const offsetDistance of testDistances) {
                if (this.isPaused) await this.waitForResume();
                this.ensureNotStopped();

                // Subtract offset to test INSIDE the boundary (closer to sensor)
                // E.g., if boundary is 8m and offset is 2m, test at 6m (not 10m!)
                const testDistance = boundary.detection_boundary - offsetDistance;

                await this.performComplianceMeasurement(
                    config.test_id,
                    boundary.angle,
                    testDistance,
                    offsetDistance,
                    config.movement_speed || 50,
                    config.detection_wait_time || 2000,
                    config.repeat_measurements || 2
                );

                completedCount++;
                this.testState!.completed_step_count++;

                // NEW: Save robot position after each measurement
                await this.updateRobotPosition();
                await this.saveTestState();

                this.emit("phase_progress", {
                    phase: 'COMPLIANCE_TEST',
                    total_positions: boundaries.length * testDistances.length,
                    completed_positions: completedCount
                });

                if (config.compliance_tangential_sweep) {
                    await this.performTangentialSweep(
                        config.test_id,
                        testDistance,
                        config.compliance_tangential_step || 15,
                        config.movement_speed || 50,
                        config.detection_wait_time || 2000,
                        config.repeat_measurements || 2
                    );
                }
            }
        }
    }

    private async performComplianceMeasurement(
        test_id: number,
        angle: number,
        distance: number,
        offset_from_boundary: number,
        speed: number,
        waitTime: number,
        repeatCount: number
    ): Promise<void> {
        const detected = await this.testPositionWithRepeats(
            test_id,
            'COMPLIANCE_RADIAL',
            angle,
            distance,
            speed,
            waitTime,
            repeatCount,
            { offset_from_boundary }
        );

        this.emit("compliance_measurement_completed", {
            test_id,
            angle,
            distance,
            offset_from_boundary,
            detected
        });
    }

    private async performTangentialSweep(
        test_id: number,
        radius: number,
        angleStep: number,
        speed: number,
        waitTime: number,
        repeatCount: number
    ): Promise<void> {
        for (let angle = 0; angle < 360; angle += angleStep) {
            if (this.isPaused) await this.waitForResume();
            this.ensureNotStopped();

            await this.testPositionWithRepeats(
                test_id,
                'COMPLIANCE_TANGENTIAL',
                angle,
                radius,
                speed,
                waitTime,
                repeatCount
            );
        }
    }

    private async testPositionWithRepeats(
        test_id: number,
        step_type: string,
        angle: number,
        distance: number,
        speed: number,
        waitTime: number,
        repeatCount: number,
        metadata?: any
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
                distance_2: metadata?.offset_from_boundary || null,
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
                    attempt 
                });

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
     * NEW: Update robot position in test state
     */
    private async updateRobotPosition(): Promise<void> {
        try {
            const position = await RobotAPIFactory.getInstance().getCurrentPosition();

            if (position && this.testState) {
                this.testState.last_position_x = position.x;
                this.testState.last_position_y = position.y;
                this.testState.last_position_timestamp = new Date();
                
                console.log(`[MasterTest] Updated robot position: (${position.x}, ${position.y})`);
                
                this.emit("position_updated", {
                    test_id: this.testState.test_id,
                    x: position.x,
                    y: position.y
                });
            }
        } catch (error) {
            console.warn(`[MasterTest] Failed to get robot position:`, error);
            // Continue anyway - position tracking is helpful but not critical
        }
    }

    /**
     * Start the next phase (tangential or radial test)
     * @param testType - 'TANGENTIAL' or 'RADIAL'
     */
    async startNextPhase(testType: 'TANGENTIAL' | 'RADIAL'): Promise<boolean> {
        if (!this.testState || !this.currentTest) {
            throw new Error("No test in progress");
        }

        if (!this.testState.awaiting_test_selection) {
            throw new Error("Not awaiting test selection");
        }

        const phase: TestPhase = testType === 'TANGENTIAL' ? 'TANGENTIAL_TEST' : 'RADIAL_TEST';
        const testName = testType === 'TANGENTIAL' ? 'Tangential' : 'Radial';

        try {
            this.isRunning = true;
            this.isPaused = false;
            this.stopRequested = false;
            this.testState.awaiting_test_selection = false;
            this.testState.awaiting_user_confirmation = false;
            this.testState.current_phase = phase;
            this.testState.progress.phase = phase;
            this.testState.progress.total_steps = this.calculateTotalSteps(this.currentTest, phase);
            this.testState.progress.completed_steps = 0;
            this.testState.progress.current_step = 0;
            await this.saveTestState();

            await testService.updateTestStatus(this.currentTest.test_id, 'IN_PROGRESS');

            this.emit(`${testType.toLowerCase()}_test_started`, {
                test_id: this.currentTest.test_id,
                test_type: testType
            });

            console.log("\n" + "=".repeat(80));
            console.log(`🎯 [MasterTest] STARTING ${testName.toUpperCase()} TEST PHASE`);
            console.log("=".repeat(80));
            console.log(`   Using boundary results from earlier detection`);
            console.log("=".repeat(80) + "\n");

            // Execute the appropriate test
            if (testType === 'TANGENTIAL') {
                await this.executeTangentialTest(this.currentTest);
                this.testState.tangential_test_completed = true;
            } else {
                await this.executeRadialTest(this.currentTest);
                this.testState.radial_test_completed = true;
            }

            console.log(`\n✅ [MasterTest] ${testName} test complete`);

            // Check if both tests are done
            if (this.testState.tangential_test_completed && this.testState.radial_test_completed) {
                this.testState.current_phase = 'COMPLETED';
                await this.saveTestState();

                await testService.updateTestStatus(
                    this.currentTest.test_id,
                    'COMPLETED',
                    undefined,
                    new Date()
                );

                this.emit("test_completed", { test_id: this.currentTest.test_id });
                console.log("\n🎉 [MasterTest] ALL TESTS COMPLETED!");
            } else {
                // Ask user if they want to continue to the other test
                const nextTest = this.testState.tangential_test_completed ? 'RADIAL' : 'TANGENTIAL';
                this.testState.awaiting_test_selection = true;
                this.testState.current_phase = this.testState.tangential_test_completed ? 'TANGENTIAL_TEST' : 'RADIAL_TEST';
                await this.saveTestState();

                await testService.updateTestStatus(this.currentTest.test_id, 'PAUSED');

                this.emit("phase_completed_awaiting_next", {
                    test_id: this.currentTest.test_id,
                    completed_phase: testType,
                    next_phase: nextTest,
                    tangential_completed: this.testState.tangential_test_completed,
                    radial_completed: this.testState.radial_test_completed
                });

                console.log(`\n⏸️  [MasterTest] Awaiting user decision for ${nextTest} test`);
            }

            return true;

        } catch (error) {
            if (error instanceof StopRequestedError) {
                console.warn(`[MasterTest] ${testName} test stopped by user`);
                return false;
            }
            console.error(`[MasterTest] ${testName} test failed:`, error);

            await testService.updateTestStatus(
                this.currentTest.test_id,
                'ERROR',
                undefined,
                new Date()
            );

            this.emit("test_failed", { test_id: this.currentTest.test_id, error });
            return false;

        } finally {
            // Keep state and config if awaiting test selection
            if (!this.testState?.awaiting_test_selection && !this.testState?.awaiting_user_confirmation) {
                this.isRunning = false;
                this.currentTest = null;
                this.testState = null;
            } else {
                this.isRunning = false;
                // Keep currentTest and testState for next phase
                console.log("[MasterTest] ⏸️ Keeping test state for next phase");
            }
        }
    }

    /**
     * Legacy method for backward compatibility
     */
    async continueToComplianceTest(): Promise<boolean> {
        // Default to tangential test first
        return this.startNextPhase('TANGENTIAL');
    }

    // Helper methods

    private async getCompletedBoundaryMeasurements(test_id: number): Promise<any[]> {
        const result = await pool.query(
            `SELECT * FROM test_step 
             WHERE test_id = $1 
             AND step_type = 'BOUNDARY_DETECTION_RADIAL'
             AND status = 'COMPLETED'
             ORDER BY sequence_no`,
            [test_id]
        );
        return result.rows;
    }

    private async getCompletedComplianceMeasurements(test_id: number): Promise<any[]> {
        const result = await pool.query(
            `SELECT * FROM test_step 
             WHERE test_id = $1 
             AND step_type IN ('COMPLIANCE_RADIAL', 'COMPLIANCE_TANGENTIAL')
             AND status = 'COMPLETED'
             ORDER BY sequence_no`,
            [test_id]
        );
        return result.rows.map(row => ({
            angle: row.angle,
            distance: row.distance_1,
            step_type: row.step_type
        }));
    }

    private async getMaxSequenceNumber(test_id: number): Promise<number> {
        const result = await pool.query(
            `SELECT COALESCE(MAX(sequence_no), 0) as max_seq FROM test_step WHERE test_id = $1`,
            [test_id]
        );
        return result.rows[0].max_seq;
    }

    private calculateTotalSteps(config: MasterTestConfiguration, phase: TestPhase): number {
        if (phase === 'BOUNDARY_DETECTION') {
            const anglesCount = config.boundary_angles.length;
            const distanceSteps = Math.ceil(
                (config.boundary_start_distance - config.boundary_end_distance) / config.boundary_step
            );
            return anglesCount * distanceSteps;
        } else if (phase === 'RADIAL_TEST') {
            // Radial test: test at boundary + offset distances for all detected boundaries
            const boundaries = this.testState?.boundary_results.filter(b => b.detection_boundary !== null).length || config.boundary_angles.length;
            return boundaries * config.compliance_test_distances.length;
        } else if (phase === 'TANGENTIAL_TEST') {
            // Tangential test: sweep 360° at fixed radii
            const angleStep = config.compliance_tangential_step || 15;
            const totalAngles = Math.floor(360 / angleStep);
            return config.compliance_test_distances.length * totalAngles;
        } else {
            // COMPLETED or unknown
            return 0;
        }
    }

    async pauseTest(): Promise<void> {
        if (!this.isRunning) {
            throw new Error("No test is running");
        }

        this.isPaused = true;
        
        if (this.currentTest) {
            // Save position before pausing
            await this.updateRobotPosition();
            await testService.updateTestStatus(this.currentTest.test_id, 'PAUSED');
            await this.saveTestState();
        }

        await RobotAPIFactory.getInstance().stopMovement();
        this.emit("test_paused");
    }

    async resumeTest(): Promise<void> {
        if (!this.isPaused) {
            throw new Error("Test is not paused");
        }

        this.isPaused = false;
        
        if (this.currentTest) {
            await testService.updateTestStatus(this.currentTest.test_id, 'IN_PROGRESS');
        }

        this.emit("test_resumed");
    }

    async stopTest(): Promise<void> {
        if (!this.isRunning) {
            throw new Error("No test is running");
        }

        this.stopRequested = true;
        await RobotAPIFactory.getInstance().stopMovement();

        let awaitingTestSelection = false;
        if (this.currentTest && this.testState) {
            // Save position before stopping
            await this.updateRobotPosition();

            // Determine what buttons to show based on current phase and completion status
            if (this.testState.current_phase === 'BOUNDARY_DETECTION' && this.testState.boundary_detection_completed) {
                // Boundary complete but stopped before choosing next test
                this.testState.awaiting_test_selection = true;
                awaitingTestSelection = true;
                console.log(`[MasterTest] Test stopped after boundary detection, showing tangential/radial options`);
            } else if (this.testState.current_phase === 'TANGENTIAL_TEST' || this.testState.current_phase === 'RADIAL_TEST') {
                // Stopped during tangential or radial test - allow restart of that phase
                this.testState.awaiting_test_selection = true;
                awaitingTestSelection = true;
                console.log(`[MasterTest] Test stopped during ${this.testState.current_phase}, allowing restart`);
            }
            // If stopped during boundary detection (not complete), awaiting_test_selection stays false
            // This will show "Start Test" button to restart boundary

            await testService.updateTestStatus(this.currentTest.test_id, 'PAUSED');
            await this.saveTestState();
        }

        const testStateForEvent = this.testState ? {
            awaiting_test_selection: awaitingTestSelection,
            current_phase: this.testState.current_phase,
            boundary_detection_completed: this.testState.boundary_detection_completed,
            tangential_test_completed: this.testState.tangential_test_completed,
            radial_test_completed: this.testState.radial_test_completed
        } : {
            awaiting_test_selection: awaitingTestSelection
        };

        this.isRunning = false;
        this.isPaused = false;
        this.currentTest = null;

        this.emit("test_stopped", testStateForEvent);
    }

    private async saveTestState(): Promise<void> {
        if (!this.testState) return;

        await pool.query(
            `INSERT INTO test_state (
                test_id, current_phase, boundary_results, awaiting_confirmation, 
                last_completed_angle, last_completed_distance, completed_step_count,
                last_position_x, last_position_y, last_position_timestamp,
                state_data, updated_at
            )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
             ON CONFLICT (test_id) 
             DO UPDATE SET 
                current_phase = $2,
                boundary_results = $3,
                awaiting_confirmation = $4,
                last_completed_angle = $5,
                last_completed_distance = $6,
                completed_step_count = $7,
                last_position_x = $8,
                last_position_y = $9,
                last_position_timestamp = $10,
                state_data = $11,
                updated_at = NOW()`,
            [
                this.testState.test_id,
                this.testState.current_phase,
                JSON.stringify(this.testState.boundary_results),
                this.testState.awaiting_user_confirmation,
                this.testState.last_completed_angle,
                this.testState.last_completed_distance,
                this.testState.completed_step_count,
                this.testState.last_position_x,
                this.testState.last_position_y,
                this.testState.last_position_timestamp,
                JSON.stringify(this.testState)
            ]
        );
    }

    private async loadTestState(test_id: number): Promise<TestState | null> {
        const result = await pool.query(
            `SELECT * FROM test_state WHERE test_id = $1`,
            [test_id]
        );

        if (result.rows.length === 0) {
            return null;
        }

        const row = result.rows[0];

        // Parse state_data once and handle both string and object cases
        let stateData: any = {};
        if (row.state_data) {
            if (typeof row.state_data === 'string') {
                stateData = JSON.parse(row.state_data);
            } else {
                stateData = row.state_data;
            }
        }

        // Parse boundary_results once and handle both string and object cases
        let parsedBoundaryResults: any[] = [];
        if (row.boundary_results) {
            if (typeof row.boundary_results === 'string') {
                parsedBoundaryResults = JSON.parse(row.boundary_results);
            } else {
                parsedBoundaryResults = row.boundary_results;
            }
        }

        return {
            test_id: row.test_id,
            current_phase: row.current_phase,
            boundary_results: parsedBoundaryResults,
            awaiting_user_confirmation: row.awaiting_confirmation || false,
            awaiting_test_selection: stateData.awaiting_test_selection || false,
            boundary_detection_completed: stateData.boundary_detection_completed || parsedBoundaryResults.length > 0,
            tangential_test_completed: stateData.tangential_test_completed || false,
            radial_test_completed: stateData.radial_test_completed || false,
            last_completed_angle: row.last_completed_angle,
            last_completed_distance: row.last_completed_distance,
            completed_step_count: row.completed_step_count || 0,
            last_position_x: row.last_position_x,
            last_position_y: row.last_position_y,
            last_position_timestamp: row.last_position_timestamp,
            progress: stateData.progress || {
                phase: row.current_phase,
                total_steps: 0,
                completed_steps: 0,
                current_step: 0
            }
        };
    }

    private async saveBoundaryResults(): Promise<void> {
        if (!this.testState || !this.currentTest) return;

        for (const result of this.testState.boundary_results) {
            await pool.query(
                `INSERT INTO radial_boundary 
                 (test_id, angle, radial_detection1_avg, specification)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (test_id, angle) DO UPDATE 
                 SET radial_detection1_avg = $3`,
                [
                    this.currentTest.test_id,
                    result.angle,
                    result.detection_boundary,
                    result.detection_boundary
                ]
            );
        }
    }

    getTestState(): TestState | null {
        return this.testState;
    }

    /**
     * Restore orchestrator state from database
     * Used when server restarts or loses in-memory state
     */
    async restoreFromDatabase(testId: number, dbState: any, testConfig?: MasterTestConfiguration): Promise<void> {
        console.log(`[MasterTest] 🔄 Restoring state from database for test ${testId}`);

        const stateData = dbState.state_data || {};

        // Parse boundary results
        let boundaryResults = [];
        if (dbState.boundary_results) {
            try {
                boundaryResults = typeof dbState.boundary_results === 'string'
                    ? JSON.parse(dbState.boundary_results)
                    : dbState.boundary_results;
            } catch (err) {
                console.error("[MasterTest] Failed to parse boundary_results:", err);
                boundaryResults = [];
            }
        }

        // If test config provided, set it (needed for startNextPhase to work)
        if (testConfig) {
            this.currentTest = testConfig;
            console.log("[MasterTest] Test configuration restored");
        } else {
            console.warn("[MasterTest] ⚠️ No test configuration provided - startNextPhase may fail");
        }

        // Restore test state
        this.testState = {
            test_id: testId,
            current_phase: dbState.current_phase || 'BOUNDARY_DETECTION',
            boundary_results: boundaryResults,
            awaiting_user_confirmation: stateData.awaiting_user_confirmation || false,
            awaiting_test_selection: stateData.awaiting_test_selection || false,
            boundary_detection_completed: stateData.boundary_detection_completed || false,
            tangential_test_completed: stateData.tangential_test_completed || false,
            radial_test_completed: stateData.radial_test_completed || false,
            completed_step_count: stateData.completed_step_count || 0,
            progress: {
                phase: dbState.current_phase || 'BOUNDARY_DETECTION',
                total_steps: stateData.total_steps || 0,
                completed_steps: stateData.completed_steps || 0,
                current_step: stateData.current_step || 0
            }
        };

        // Mark as not running (paused/awaiting)
        this.isRunning = false;
        this.isPaused = false;

        console.log("[MasterTest] ✅ State restored:", {
            test_id: this.testState.test_id,
            current_phase: this.testState.current_phase,
            boundary_complete: this.testState.boundary_detection_completed,
            tangential_complete: this.testState.tangential_test_completed,
            radial_complete: this.testState.radial_test_completed,
            awaiting_selection: this.testState.awaiting_test_selection
        });

        // If awaiting test selection, emit event to trigger modal
        if (this.testState.awaiting_test_selection) {
            console.log("[MasterTest] 📢 Emitting phase_completed_awaiting_next event");

            this.emit("phase_completed_awaiting_next", {
                boundary_results: this.testState.boundary_results,
                tangential_completed: this.testState.tangential_test_completed,
                radial_completed: this.testState.radial_test_completed,
                message: "Test state restored. Please select next phase."
            });
        }
    }

    private ensureNotStopped(): void {
        if (this.stopRequested) {
            throw new StopRequestedError();
        }
    }

    private async waitForResume(): Promise<void> {
        return new Promise((resolve) => {
            const check = () => {
                if (!this.isPaused || this.stopRequested) resolve();
                else setTimeout(check, 100);
            };
            check();
        });
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    isTestPaused(): boolean {
        return this.isPaused;
    }

    isTestRunning(): boolean {
        return this.isRunning;
    }

    getCurrentTest(): MasterTestConfiguration | null {
        return this.currentTest;
    }
}

export default MasterTestOrchestrator;
