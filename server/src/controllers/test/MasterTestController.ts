import { Request, Response } from "express";
import { MasterTestOrchestrator, MasterTestConfiguration } from "../../services/test/MasterTestOrchestrator";
import * as testStateService from "../../services/test/TestStateService";

export async function startMasterTest(req: Request, res: Response) {
    try {
        const config: MasterTestConfiguration = req.body;

        console.log("=".repeat(60));
        console.log("[MasterTest Controller] Received start test request");
        console.log(`[MasterTest Controller] Test ID: ${config.test_id}`);
        console.log(`[MasterTest Controller] Sensor ID: ${config.sensor_id}`);
        console.log(`[MasterTest Controller] Test Type: ${config.test_type}`);
        console.log(`[MasterTest Controller] Config:`, JSON.stringify(config, null, 2));
        console.log("=".repeat(60));

        if (!config.test_id) {
            console.error("[MasterTest Controller] ❌ Missing test_id");
            return res.status(400).json({ error: "test_id is required" });
        }

        if (!config.test_type) {
            console.error("[MasterTest Controller] ❌ Missing test_type");
            return res.status(400).json({ error: "test_type is required" });
        }

        const orchestrator = MasterTestOrchestrator.instance;

        if (orchestrator.isTestRunning()) {
            console.warn("[MasterTest Controller] ⚠️ Test already running");
            return res.status(409).json({ error: "A test is already running" });
        }

        // Check if test has existing state in orchestrator (in-memory)
        const currentState = orchestrator.getTestState();
        if (currentState && currentState.test_id === config.test_id) {
            // Test has existing state - check what phase we're in
            if (currentState.awaiting_test_selection) {
                console.log("[MasterTest Controller] ⚠️ Test already has state and is awaiting test selection");
                return res.status(409).json({
                    error: "Test is awaiting test selection. Use /start-phase endpoint instead.",
                    current_phase: currentState.current_phase,
                    awaiting_test_selection: true,
                    boundary_detection_completed: currentState.boundary_detection_completed,
                    tangential_test_completed: currentState.tangential_test_completed,
                    radial_test_completed: currentState.radial_test_completed
                });
            } else if (currentState.boundary_detection_completed) {
                console.log("[MasterTest Controller] ⚠️ Boundary detection already completed");
                return res.status(409).json({
                    error: "Boundary detection already completed. Use /resume or /start-phase endpoint.",
                    current_phase: currentState.current_phase,
                    boundary_detection_completed: true
                });
            }
        }

        // Also check database state (in case orchestrator was restarted or lost state)
        const dbState = await testStateService.getTestState(config.test_id);
        if (dbState) {
            console.log("[MasterTest Controller] 📊 Found existing state in database");
            const stateData = dbState.state_data || {};

            if (stateData.awaiting_test_selection) {
                console.log("[MasterTest Controller] ⚠️ Database shows test is awaiting test selection");
                return res.status(409).json({
                    error: "Test is awaiting test selection. Use /start-phase endpoint instead.",
                    current_phase: dbState.current_phase,
                    awaiting_test_selection: true,
                    boundary_detection_completed: stateData.boundary_detection_completed || false,
                    tangential_test_completed: stateData.tangential_test_completed || false,
                    radial_test_completed: stateData.radial_test_completed || false
                });
            } else if (stateData.boundary_detection_completed) {
                console.log("[MasterTest Controller] ⚠️ Database shows boundary detection already completed");
                return res.status(409).json({
                    error: "Boundary detection already completed. Use /resume or /start-phase endpoint.",
                    current_phase: dbState.current_phase,
                    boundary_detection_completed: true,
                    tangential_test_completed: stateData.tangential_test_completed || false,
                    radial_test_completed: stateData.radial_test_completed || false
                });
            }
        }

        console.log("[MasterTest Controller] ✅ Starting test asynchronously...");

        // Start test asynchronously (begins with boundary detection)
        orchestrator.startTest(config).catch((error) => {
            console.error("[MasterTest Controller] ❌ Test execution error:", error);
        });

        console.log("[MasterTest Controller] ✅ Test started successfully");

        return res.status(202).json({
            message: "Test started (boundary detection phase)",
            test_id: config.test_id,
            phase: 'BOUNDARY_DETECTION'
        });

    } catch (error: any) {
        console.error("[MasterTest Controller] ❌ Exception:", error);
        return res.status(500).json({
            error: error.message || "Failed to start test"
        });
    }
}

/**
 * Start a specific test phase (tangential or radial)
 * @param test_type - 'TANGENTIAL' or 'RADIAL'
 */
export async function startTestPhase(req: Request, res: Response) {
    try {
        const { test_type } = req.body;

        if (!test_type || (test_type !== 'TANGENTIAL' && test_type !== 'RADIAL')) {
            return res.status(400).json({
                error: "Invalid test_type. Must be 'TANGENTIAL' or 'RADIAL'"
            });
        }

        const orchestrator = MasterTestOrchestrator.instance;

        // Start the requested test phase
        orchestrator.startNextPhase(test_type).catch((error) => {
            console.error(`[MasterTest] ${test_type} test error:`, error);
        });

        return res.status(202).json({
            message: `Starting ${test_type.toLowerCase()} test phase`,
            test_type
        });

    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
}

/**
 * Continue to compliance test phase (after boundary detection)
 * @deprecated Use startTestPhase instead
 */
export async function continueToCompliance(req: Request, res: Response) {
    try {
        const orchestrator = MasterTestOrchestrator.instance;

        // Continue with compliance testing (defaults to tangential)
        orchestrator.continueToComplianceTest().catch((error) => {
            console.error("[MasterTest] Compliance test error:", error);
        });

        return res.status(202).json({
            message: "Continuing to compliance test phase"
        });

    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
}

/**
 * Resume test from saved state (from history page)
 */
export async function resumeFromState(req: Request, res: Response) {
    try {
        const { test_id, config } = req.body;

        if (!test_id) {
            return res.status(400).json({ error: "test_id is required" });
        }

        if (!config) {
            return res.status(400).json({ error: "config is required to resume test" });
        }

        const orchestrator = MasterTestOrchestrator.instance;

        if (orchestrator.isTestRunning()) {
            return res.status(409).json({ error: "A test is already running" });
        }

        // Resume test asynchronously with the config and resuming flag
        orchestrator.startTest(config, true).catch((error) => {
            console.error("[MasterTest] Resume error:", error);
        });

        return res.status(202).json({
            message: "Test resuming from saved state",
            test_id
        });

    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
}

/**
 * Restore orchestrator state from database
 * Used when loading test from history after server restart
 */
export async function resumeFromDatabase(req: Request, res: Response) {
    try {
        const { test_id } = req.body;

        console.log("[MasterTest Controller] Resume from database request:", test_id);

        if (!test_id) {
            return res.status(400).json({ error: "test_id is required" });
        }

        const orchestrator = MasterTestOrchestrator.instance;

        if (orchestrator.isTestRunning()) {
            return res.status(409).json({ error: "A test is already running" });
        }

        // Check if orchestrator already has state for this test
        const currentState = orchestrator.getTestState();
        if (currentState && currentState.test_id === test_id) {
            console.log("[MasterTest Controller] Orchestrator already has state for this test");
            return res.status(200).json({ message: "State already loaded" });
        }

        // Load state from database
        const dbState = await testStateService.getTestState(test_id);
        if (!dbState) {
            return res.status(404).json({ error: "No state found in database for this test" });
        }

        // Load test configuration from database (needed for startNextPhase to work)
        const testService = await import("../../services/test/TestService");
        const test = await testService.getTestById(test_id);
        if (!test) {
            return res.status(404).json({ error: "Test not found" });
        }

        // Create a minimal test configuration for orchestrator
        // This allows startNextPhase to work properly
        const testConfig = {
            test_id: test_id,
            sensor_id: test.sensor_id,
            test_type: 'FULL' as const,
            boundary_angles: Array.from({ length: 36 }, (_, i) => i * 10),
            boundary_start_distance: 8.0,
            boundary_end_distance: 1.0,
            boundary_step: 0.5,
            compliance_test_distances: [2.0, 3.0],
            compliance_tangential_sweep: true,
            compliance_tangential_step: 15,
            movement_speed: 50,
            detection_wait_time: 2000,
            repeat_measurements: 2
        };

        // Restore orchestrator state from database with test config
        await orchestrator.restoreFromDatabase(test_id, dbState, testConfig);

        return res.status(200).json({
            message: "State restored from database",
            test_id,
            current_phase: dbState.current_phase,
            awaiting_test_selection: dbState.state_data?.awaiting_test_selection || false
        });

    } catch (error: any) {
        console.error("[MasterTest Controller] Error restoring from database:", error);
        return res.status(500).json({ error: error.message || "Failed to restore state" });
    }
}

export async function pauseMasterTest(req: Request, res: Response) {
    try {
        const orchestrator = MasterTestOrchestrator.instance;
        await orchestrator.pauseTest();
        
        return res.status(200).json({ message: "Test paused" });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
}

export async function resumeMasterTest(req: Request, res: Response) {
    try {
        const orchestrator = MasterTestOrchestrator.instance;
        await orchestrator.resumeTest();
        
        return res.status(200).json({ message: "Test resumed" });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
}

export async function stopMasterTest(req: Request, res: Response) {
    try {
        const orchestrator = MasterTestOrchestrator.instance;
        await orchestrator.stopTest();
        
        return res.status(200).json({ message: "Test stopped" });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
}

export async function getMasterTestState(req: Request, res: Response) {
    const orchestrator = MasterTestOrchestrator.instance;
    const state = orchestrator.getTestState();
    const isRunning = orchestrator.isTestRunning();
    const isPaused = orchestrator.isTestPaused();
    const currentTest = orchestrator.getCurrentTest();

    return res.status(200).json({
        is_running: isRunning,
        is_paused: isPaused,
        current_test: currentTest,
        state: state
    });
}

/**
 * SSE Stream for real-time test updates
 */
export function masterTestStream(req: Request, res: Response) {

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const send = (event: string, data: unknown) => {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    send("connected", { timestamp: new Date().toISOString() });

    const orchestrator = MasterTestOrchestrator.instance;

    // Event handlers
    const onTestStarted = (data: any) => send("test_started", data);
    const onBoundaryDetectionCompleted = (data: any) => send("boundary_detection_completed", data);
    const onComplianceTestStarted = (data: any) => send("compliance_test_started", data);
    const onTangentialTestStarted = (data: any) => send("tangential_test_started", data);
    const onRadialTestStarted = (data: any) => send("radial_test_started", data);
    const onPhaseCompletedAwaitingNext = (data: any) => send("phase_completed_awaiting_next", data);
    const onTestCompleted = (data: any) => send("test_completed", data);
    const onTestFailed = (data: any) => send("test_failed", data);
    const onTestPaused = () => send("test_paused", {});
    const onTestResumed = () => send("test_resumed", {});
    const onTestStopped = () => send("test_stopped", {});
    const onMovementStarted = (data: any) => send("movement_started", data);
    const onMeasurementCompleted = (data: any) => send("measurement_completed", data);
    const onDetection = (data: any) => send("detection", data);
    const onBoundaryFoundAtAngle = (data: any) => send("boundary_found_at_angle", data);
    const onComplianceMeasurementCompleted = (data: any) => send("compliance_measurement_completed", data);
    const onPhaseProgress = (data: any) => send("phase_progress", data);
    const onTestLog = (data: any) => send("test_log", data);

    // Register listeners
    orchestrator.on("test_started", onTestStarted);
    orchestrator.on("boundary_detection_completed", onBoundaryDetectionCompleted);
    orchestrator.on("compliance_test_started", onComplianceTestStarted);
    orchestrator.on("tangential_test_started", onTangentialTestStarted);
    orchestrator.on("radial_test_started", onRadialTestStarted);
    orchestrator.on("phase_completed_awaiting_next", onPhaseCompletedAwaitingNext);
    orchestrator.on("test_completed", onTestCompleted);
    orchestrator.on("test_failed", onTestFailed);
    orchestrator.on("test_paused", onTestPaused);
    orchestrator.on("test_resumed", onTestResumed);
    orchestrator.on("test_stopped", onTestStopped);
    orchestrator.on("movement_started", onMovementStarted);
    orchestrator.on("measurement_completed", onMeasurementCompleted);
    orchestrator.on("detection", onDetection);
    orchestrator.on("boundary_found_at_angle", onBoundaryFoundAtAngle);
    orchestrator.on("compliance_measurement_completed", onComplianceMeasurementCompleted);
    orchestrator.on("phase_progress", onPhaseProgress);
    orchestrator.on("test_log", onTestLog);

    // Clean up when client disconnects
    req.on("close", () => {
        orchestrator.off("test_started", onTestStarted);
        orchestrator.off("boundary_detection_completed", onBoundaryDetectionCompleted);
        orchestrator.off("compliance_test_started", onComplianceTestStarted);
        orchestrator.off("tangential_test_started", onTangentialTestStarted);
        orchestrator.off("radial_test_started", onRadialTestStarted);
        orchestrator.off("phase_completed_awaiting_next", onPhaseCompletedAwaitingNext);
        orchestrator.off("test_completed", onTestCompleted);
        orchestrator.off("test_failed", onTestFailed);
        orchestrator.off("test_paused", onTestPaused);
        orchestrator.off("test_resumed", onTestResumed);
        orchestrator.off("test_stopped", onTestStopped);
        orchestrator.off("movement_started", onMovementStarted);
        orchestrator.off("measurement_completed", onMeasurementCompleted);
        orchestrator.off("detection", onDetection);
        orchestrator.off("boundary_found_at_angle", onBoundaryFoundAtAngle);
        orchestrator.off("compliance_measurement_completed", onComplianceMeasurementCompleted);
        orchestrator.off("phase_progress", onPhaseProgress);
        orchestrator.off("test_log", onTestLog);
        res.end();
    });
}
