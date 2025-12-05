import { Request, Response } from "express";
import { MasterTestOrchestrator, MasterTestConfiguration } from "../services/master_test_orchestrator_service";

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
 * Continue to compliance test phase (after boundary detection)
 */
export async function continueToCompliance(req: Request, res: Response) {
    try {
        const orchestrator = MasterTestOrchestrator.instance;
        
        // Continue with compliance testing
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
