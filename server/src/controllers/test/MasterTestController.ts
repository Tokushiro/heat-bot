import { Request, Response } from "express";
import { MasterTestOrchestrator, MasterTestConfiguration, TestExecutionState } from "../../services/test/MasterTestOrchestrator";

export async function startMasterTest(req: Request, res: Response) {
    try {
        const config: MasterTestConfiguration = req.body;

        console.log("=".repeat(60));
        console.log("[MasterTest Controller] Received start test request");
        console.log(`[MasterTest Controller] Test ID: ${config.test_id}`);
        console.log(`[MasterTest Controller] Sensor ID: ${config.sensor_id}`);
        console.log(`[MasterTest Controller] Test Type: ${config.test_type}`);
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
        const executionState = orchestrator.getExecutionState();

        // If test is in a complete or error state, automatically reset to IDLE
        const completeStates = [
            TestExecutionState.ALL_COMPLETE,
            TestExecutionState.BOUNDARY_COMPLETE,
            TestExecutionState.TANGENTIAL_COMPLETE,
            TestExecutionState.RADIAL_COMPLETE,
            TestExecutionState.ERROR
        ];

        if (completeStates.includes(executionState)) {
            console.log(`[MasterTest Controller] Test in ${executionState} state - resetting to IDLE before starting new test`);
            await orchestrator.resetToIdle();
        } else if (executionState !== TestExecutionState.IDLE) {
            // Test is running or paused - cannot start new test
            console.warn(`[MasterTest Controller] ⚠️ Test in state: ${executionState}`);
            return res.status(409).json({
                error: `Cannot start test. Current state: ${executionState}. Please stop or complete the current test first.`,
                execution_state: executionState
            });
        }

        console.log("[MasterTest Controller] ✅ Starting test asynchronously...");

        // Start test asynchronously (begins with IEC 63180 boundary detection)
        orchestrator.startTest(config).catch((error) => {
            console.error("[MasterTest Controller] ❌ Test execution error:", error);
        });

        console.log("[MasterTest Controller] ✅ Test started successfully");

        return res.status(202).json({
            message: "Test started (IEC 63180 boundary detection phase)",
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
        const { test_type, test_id } = req.body;

        if (!test_type || (test_type !== 'TANGENTIAL' && test_type !== 'RADIAL')) {
            return res.status(400).json({
                error: "Invalid test_type. Must be 'TANGENTIAL' or 'RADIAL'"
            });
        }

        const orchestrator = MasterTestOrchestrator.instance;
        const executionState = orchestrator.getExecutionState();
        const testState = orchestrator.getTestState();

        // Validate that boundary detection is complete
        if (executionState !== TestExecutionState.BOUNDARY_COMPLETE &&
            executionState !== TestExecutionState.TANGENTIAL_COMPLETE &&
            executionState !== TestExecutionState.RADIAL_COMPLETE) {
            return res.status(409).json({
                error: `Cannot start ${test_type} test. Current state: ${executionState}`,
                execution_state: executionState
            });
        }

        // Validate test_id matches if provided
        if (test_id && testState && testState.test_id !== test_id) {
            return res.status(400).json({
                error: `Test ID mismatch. Orchestrator has test ${testState.test_id}, but ${test_id} was requested.`
            });
        }

        // Check if this phase is already complete
        if (test_type === 'TANGENTIAL' && testState && testState.tangential_results_count > 0) {
            return res.status(409).json({
                error: "Tangential test already completed",
                execution_state: executionState
            });
        }
        if (test_type === 'RADIAL' && testState && testState.radial_results_count > 0) {
            return res.status(409).json({
                error: "Radial test already completed",
                execution_state: executionState
            });
        }

        console.log(`[MasterTest Controller] Starting ${test_type} test phase...`);

        // Start the requested test phase
        orchestrator.startTestPhase(test_type, test_id).catch((error: any) => {
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

export async function resumeMasterTest(req: Request, res: Response) {
    try {
        const orchestrator = MasterTestOrchestrator.instance;
        const executionState = orchestrator.getExecutionState();

        // Check if test is paused
        if (executionState !== TestExecutionState.BOUNDARY_PAUSED &&
            executionState !== TestExecutionState.TANGENTIAL_PAUSED &&
            executionState !== TestExecutionState.RADIAL_PAUSED) {
            return res.status(409).json({
                error: `Test is not paused. Current state: ${executionState}`,
                execution_state: executionState
            });
        }

        await orchestrator.resumeTest();

        return res.status(200).json({
            message: "Test resumed",
            execution_state: orchestrator.getExecutionState()
        });

    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
}

export async function pauseMasterTest(req: Request, res: Response) {
    try {
        const orchestrator = MasterTestOrchestrator.instance;
        await orchestrator.pauseTest();

        return res.status(200).json({
            message: "Test paused",
            execution_state: orchestrator.getExecutionState()
        });

    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
}

export async function stopMasterTest(req: Request, res: Response) {
    try {
        const orchestrator = MasterTestOrchestrator.instance;
        await orchestrator.stopTest();

        return res.status(200).json({
            message: "Test stopped",
            execution_state: orchestrator.getExecutionState()
        });

    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
}

export async function getMasterTestState(req: Request, res: Response) {
    try {
        const orchestrator = MasterTestOrchestrator.instance;
        const testState = orchestrator.getTestState();
        const executionState = orchestrator.getExecutionState();

        if (!testState) {
            return res.status(404).json({
                error: "No test in progress",
                execution_state: executionState
            });
        }

        return res.status(200).json({
            test_state: testState,
            execution_state: executionState,
            is_running: orchestrator.isTestRunning(),
            is_paused: orchestrator.isTestPaused()
        });

    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
}

/**
 * SSE stream for test events
 */
export function masterTestEventStream(req: Request, res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const orchestrator = MasterTestOrchestrator.instance;

    const sendEvent = (event: string, data: any) => {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Forward all orchestrator events to SSE stream
    const events = [
        'test_started',
        'boundary_detection_completed',
        'tangential_test_started',
        'radial_test_started',
        'tangential_test_completed',
        'radial_test_completed',
        'phase_completed_awaiting_next',
        'test_completed',
        'test_failed',
        'test_paused',
        'test_resumed',
        'test_stopped',
        'state_changed',
        'phase_progress',
        'movement_started',
        'measurement_completed',
        'compliance_measurement_completed',
        'detection',
        'position_updated'
    ];

    const listeners: Record<string, any> = {};

    events.forEach(event => {
        const listener = (data: any) => sendEvent(event, data);
        orchestrator.on(event, listener);
        listeners[event] = listener;
    });

    // Clean up on client disconnect
    req.on('close', () => {
        events.forEach(event => {
            orchestrator.off(event, listeners[event]);
        });
        res.end();
    });
}
