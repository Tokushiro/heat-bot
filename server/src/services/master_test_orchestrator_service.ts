import { EventEmitter } from "events";
import { RobotAPI, Position } from "./robot_api_service";
import bleEventBus, { DetectionEvent } from "./bleEventBus";
import * as testService from "./test_service";
import * as testStepService from "./test_step_service";
import pool from "../db_conn";

export type TestPhase = 'BOUNDARY_DETECTION' | 'COMPLIANCE_TEST' | 'COMPLETED';
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
        if (this.isRunning) {
            throw new Error("Test already running");
        }

        try {
            this.isRunning = true;
            this.currentTest = config;

            if (resuming) {
                await this.resumeExistingTest(config.test_id);
            } else {
                await this.startNewTest(config);
            }

            return true;

        } catch (error) {
            console.error("[MasterTest] Test failed:", error);
            
            await testService.updateTestStatus(
                config.test_id,
                'ERROR',
                undefined,
                new Date()
            );

            this.emit("test_failed", { test_id: config.test_id, error });
            return false;

        } finally {
            if (!this.testState?.awaiting_user_confirmation) {
                this.isRunning = false;
                this.currentTest = null;
            }
        }
    }

    /**
     * Start a brand new test
     */
    private async startNewTest(config: MasterTestConfiguration): Promise<void> {
        this.sequenceCounter = 0;

        this.testState = {
            test_id: config.test_id,
            current_phase: 'BOUNDARY_DETECTION',
            boundary_results: [],
            awaiting_user_confirmation: false,
            completed_step_count: 0,
            progress: {
                phase: 'BOUNDARY_DETECTION',
                total_steps: this.calculateTotalSteps(config, 'BOUNDARY_DETECTION'),
                completed_steps: 0,
                current_step: 0
            }
        };

        await this.saveTestState();
        await testService.updateTestStatus(config.test_id, 'IN_PROGRESS', new Date());

        this.emit("test_started", { 
            test_id: config.test_id, 
            phase: 'BOUNDARY_DETECTION' 
        });

        const initialized = await RobotAPI.instance.initialize();
        if (!initialized) {
            throw new Error("Robot initialization failed");
        }

        await this.executeBoundaryDetection(config);
        await this.saveBoundaryResults();

        this.testState.current_phase = 'BOUNDARY_DETECTION';
        this.testState.awaiting_user_confirmation = true;
        await this.saveTestState();

        this.isRunning = false;
        await testService.updateTestStatus(config.test_id, 'PAUSED');

        this.emit("boundary_detection_completed", {
            test_id: config.test_id,
            boundary_results: this.testState.boundary_results,
            message: "Boundary detection complete. Continue with compliance test?"
        });
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

        // NEW: Move robot to last saved position if available
        if (this.testState.last_position_x !== undefined && this.testState.last_position_y !== undefined) {
            console.log(`[MasterTest] Moving robot to last saved position: (${this.testState.last_position_x}, ${this.testState.last_position_y})`);
            
            this.emit("resuming_to_position", {
                test_id,
                x: this.testState.last_position_x,
                y: this.testState.last_position_y,
                timestamp: this.testState.last_position_timestamp
            });

            const moveResult = await RobotAPI.instance.moveCartesian(
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

        if (this.testState.awaiting_user_confirmation) {
            this.isRunning = false;
            await testService.updateTestStatus(test_id, 'PAUSED');
            
            this.emit("boundary_detection_completed", {
                test_id: test_id,
                boundary_results: this.testState.boundary_results,
                message: "Boundary detection was completed earlier. Continue with compliance test?"
            });
            
        } else if (this.testState.current_phase === 'BOUNDARY_DETECTION') {
            await this.resumeBoundaryDetection(this.currentTest);
            
            await this.saveBoundaryResults();
            this.testState.awaiting_user_confirmation = true;
            await this.saveTestState();
            
            this.isRunning = false;
            await testService.updateTestStatus(test_id, 'PAUSED');
            
            this.emit("boundary_detection_completed", {
                test_id: test_id,
                boundary_results: this.testState.boundary_results,
                message: "Boundary detection complete. Continue with compliance test?"
            });
            
        } else if (this.testState.current_phase === 'COMPLIANCE_TEST') {
            await this.resumeComplianceTest(this.currentTest);
            
            this.testState.current_phase = 'COMPLETED';
            await this.saveTestState();
            await testService.updateTestStatus(test_id, 'COMPLETED', undefined, new Date());
            
            this.emit("test_completed", { test_id: test_id });
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
            
            const existingResult = this.testState!.boundary_results.find(r => r.angle === angle);
            if (existingResult) {
                console.log(`[MasterTest] Angle ${angle}° already completed, skipping`);
                continue;
            }
            
            if (this.isPaused) await this.waitForResume();

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
            if (boundary.detection_boundary === null) {
                console.warn(`No boundary found at angle ${boundary.angle}, skipping compliance test`);
                continue;
            }

            for (const offsetDistance of testDistances) {
                if (this.isPaused) await this.waitForResume();

                const testDistance = boundary.detection_boundary + offsetDistance;

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
            
            if (this.isPaused) await this.waitForResume();

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
            if (this.isPaused) await this.waitForResume();

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
            if (boundary.detection_boundary === null) {
                console.warn(`No boundary found at angle ${boundary.angle}, skipping compliance test`);
                continue;
            }

            for (const offsetDistance of testDistances) {
                if (this.isPaused) await this.waitForResume();

                const testDistance = boundary.detection_boundary + offsetDistance;

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

                const result = await RobotAPI.instance.movePolar(angle, distance, speed);

                if (!result.success) {
                    throw new Error(`Movement failed: ${result.error}`);
                }

                await this.delay(waitTime);

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
            const position = await RobotAPI.instance.getCurrentPosition();
            
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

    async continueToComplianceTest(): Promise<boolean> {
        if (!this.testState || !this.currentTest) {
            throw new Error("No test in progress");
        }

        if (!this.testState.awaiting_user_confirmation) {
            throw new Error("Not awaiting confirmation");
        }

        try {
            this.isRunning = true;
            this.testState.awaiting_user_confirmation = false;
            this.testState.current_phase = 'COMPLIANCE_TEST';
            this.testState.progress.phase = 'COMPLIANCE_TEST';
            this.testState.progress.total_steps = this.calculateTotalSteps(this.currentTest, 'COMPLIANCE_TEST');
            await this.saveTestState();

            await testService.updateTestStatus(this.currentTest.test_id, 'IN_PROGRESS');

            this.emit("compliance_test_started", { 
                test_id: this.currentTest.test_id 
            });

            await this.executeComplianceTest(this.currentTest);

            this.testState.current_phase = 'COMPLETED';
            await this.saveTestState();

            await testService.updateTestStatus(
                this.currentTest.test_id,
                'COMPLETED',
                undefined,
                new Date()
            );

            this.emit("test_completed", { test_id: this.currentTest.test_id });
            return true;

        } catch (error) {
            console.error("[MasterTest] Compliance test failed:", error);
            
            await testService.updateTestStatus(
                this.currentTest.test_id,
                'ERROR',
                undefined,
                new Date()
            );

            this.emit("test_failed", { test_id: this.currentTest.test_id, error });
            return false;

        } finally {
            this.isRunning = false;
            this.currentTest = null;
            this.testState = null;
        }
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
        } else {
            const boundaries = this.testState?.boundary_results.length || config.boundary_angles.length;
            return boundaries * config.compliance_test_distances.length;
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

        await RobotAPI.instance.stopMovement();
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

        await RobotAPI.instance.stopMovement();
        
        if (this.currentTest) {
            // Save position before stopping
            await this.updateRobotPosition();
            await testService.updateTestStatus(this.currentTest.test_id, 'PAUSED');
            await this.saveTestState();
        }

        this.isRunning = false;
        this.isPaused = false;
        this.currentTest = null;

        this.emit("test_stopped");
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
        return {
            test_id: row.test_id,
            current_phase: row.current_phase,
            boundary_results: JSON.parse(row.boundary_results || '[]'),
            awaiting_user_confirmation: row.awaiting_confirmation,
            last_completed_angle: row.last_completed_angle,
            last_completed_distance: row.last_completed_distance,
            completed_step_count: row.completed_step_count || 0,
            last_position_x: row.last_position_x,
            last_position_y: row.last_position_y,
            last_position_timestamp: row.last_position_timestamp,
            progress: row.state_data ? JSON.parse(row.state_data).progress : null
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

    private async waitForResume(): Promise<void> {
        return new Promise((resolve) => {
            const check = () => {
                if (!this.isPaused) resolve();
                else setTimeout(check, 100);
            };
            check();
        });
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    isTestRunning(): boolean {
        return this.isRunning;
    }

    getCurrentTest(): MasterTestConfiguration | null {
        return this.currentTest;
    }
}

export default MasterTestOrchestrator;
