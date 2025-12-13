import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../Components/apiAxios";
import { message, Modal } from "antd";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export const TestExecutionState = {
    IDLE: 'IDLE',
    BOUNDARY_RUNNING: 'BOUNDARY_RUNNING',
    BOUNDARY_PAUSED: 'BOUNDARY_PAUSED',
    BOUNDARY_COMPLETE: 'BOUNDARY_COMPLETE',
    TANGENTIAL_RUNNING: 'TANGENTIAL_RUNNING',
    TANGENTIAL_PAUSED: 'TANGENTIAL_PAUSED',
    TANGENTIAL_COMPLETE: 'TANGENTIAL_COMPLETE',
    RADIAL_RUNNING: 'RADIAL_RUNNING',
    RADIAL_PAUSED: 'RADIAL_PAUSED',
    RADIAL_COMPLETE: 'RADIAL_COMPLETE',
    ALL_COMPLETE: 'ALL_COMPLETE',
    ERROR: 'ERROR'
} as const;

export type TestExecutionState = typeof TestExecutionState[keyof typeof TestExecutionState];

export type TestPhase = 'BOUNDARY_DETECTION' | 'TANGENTIAL_TEST' | 'RADIAL_TEST' | 'COMPLETED';
type TestStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'PAUSED' | 'ERROR';

export interface MasterTestConfiguration {
    test_id: number;
    sensor_id: number;
    test_type: 'RADIAL' | 'TANGENTIAL' | 'FULL';
    movement_speed?: number;
    detection_wait_time?: number;
    repeat_measurements?: number;
    initial_position?: {
        distanceFromSensor: number;
        facingAngle: number;
        robotOrientation: 'tangential' | 'radial';
    };
}

export interface BoundaryResult {
    angle: number;
    detection_boundary: number | null;    // Max distance where detected
    detected_distance: number | null;      // Distance of detection
    no_detection_distance: number | null;  // Distance of no detection
}

export interface ComplianceResult {
    angle: number;
    distance: number;
    offset_from_boundary?: number;
    detected: boolean;
}

export interface TestEvent {
    type: string;
    data: Record<string, unknown>;
    timestamp: string;
}

// =============================================================================
// HOOK
// =============================================================================

export function useMasterTest() {
    // Single source of truth for test state
    const [executionState, setExecutionState] = useState<TestExecutionState>(TestExecutionState.IDLE);

    // Test data
    const [testId, setTestId] = useState<number | null>(null);
    const [boundaryResults, setBoundaryResults] = useState<BoundaryResult[]>([]);
    const [tangentialResults, setTangentialResults] = useState<ComplianceResult[]>([]);
    const [radialResults, setRadialResults] = useState<ComplianceResult[]>([]);

    // UI state
    const [events, setEvents] = useState<TestEvent[]>([]);
    const [connected, setConnected] = useState(false);
    const [phaseProgress, setPhaseProgress] = useState<{
        phase: string;
        total: number;
        completed: number;
    } | null>(null);

    // Refs
    const eventSourceRef = useRef<EventSource | null>(null);
    const modalShownRef = useRef<boolean>(false);

    // =========================================================================
    // DERIVED STATE - Computed from executionState
    // =========================================================================

    const isRunning = executionState === TestExecutionState.BOUNDARY_RUNNING ||
                     executionState === TestExecutionState.TANGENTIAL_RUNNING ||
                     executionState === TestExecutionState.RADIAL_RUNNING;

    const isPaused = executionState === TestExecutionState.BOUNDARY_PAUSED ||
                    executionState === TestExecutionState.TANGENTIAL_PAUSED ||
                    executionState === TestExecutionState.RADIAL_PAUSED;

    const isCompleted = executionState === TestExecutionState.ALL_COMPLETE;

    const boundaryComplete = executionState === TestExecutionState.BOUNDARY_COMPLETE ||
                            executionState === TestExecutionState.TANGENTIAL_RUNNING ||
                            executionState === TestExecutionState.TANGENTIAL_PAUSED ||
                            executionState === TestExecutionState.TANGENTIAL_COMPLETE ||
                            executionState === TestExecutionState.RADIAL_RUNNING ||
                            executionState === TestExecutionState.RADIAL_PAUSED ||
                            executionState === TestExecutionState.RADIAL_COMPLETE ||
                            executionState === TestExecutionState.ALL_COMPLETE;

    const tangentialComplete = executionState === TestExecutionState.TANGENTIAL_COMPLETE ||
                              executionState === TestExecutionState.RADIAL_RUNNING ||
                              executionState === TestExecutionState.RADIAL_PAUSED ||
                              executionState === TestExecutionState.RADIAL_COMPLETE ||
                              executionState === TestExecutionState.ALL_COMPLETE;

    const radialComplete = executionState === TestExecutionState.RADIAL_COMPLETE ||
                          executionState === TestExecutionState.ALL_COMPLETE;

    const awaitingSelection = executionState === TestExecutionState.BOUNDARY_COMPLETE ||
                             executionState === TestExecutionState.TANGENTIAL_COMPLETE ||
                             executionState === TestExecutionState.RADIAL_COMPLETE;

    // Map execution state to phase
    const currentPhase: TestPhase | null = (() => {
        switch (executionState) {
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
                return null;
        }
    })();

    // Map execution state to status
    const status: TestStatus = (() => {
        if (isRunning) return 'IN_PROGRESS';
        if (isPaused) return 'PAUSED';
        if (isCompleted) return 'COMPLETED';
        if (executionState === TestExecutionState.ERROR) return 'ERROR';
        return 'PLANNED';
    })();

    // =========================================================================
    // SSE EVENT HANDLERS
    // =========================================================================

    const connectStream = useCallback(() => {
        const baseURL = api.defaults.baseURL || "";
        const eventSource = new EventSource(`${baseURL}/api/master-test/stream`);

        eventSource.addEventListener("open", () => {
            setConnected(true);
            console.log("Connected to master test stream");
        });

        // Test started event
        eventSource.addEventListener("test_started", (e) => {
            const data = JSON.parse(e.data);
            setExecutionState(TestExecutionState.BOUNDARY_RUNNING);
            setTestId(data.test_id);
            setBoundaryResults([]);
            setTangentialResults([]);
            setRadialResults([]);
            setPhaseProgress(null);
            modalShownRef.current = false;
            addEvent("test_started", data);
            message.success(`Test ${data.test_id} started - IEC 63180 Boundary Detection`);
        });

        // Boundary detection completed
        eventSource.addEventListener("boundary_detection_completed", (e) => {
            const data = JSON.parse(e.data);
            setExecutionState(TestExecutionState.BOUNDARY_COMPLETE);
            setBoundaryResults(data.boundary_results || []);
            addEvent("boundary_detection_completed", data);

            // Show modal for phase selection
            if (!modalShownRef.current) {
                modalShownRef.current = true;
                showPhaseSelectionModal(data.test_id);
            }
        });

        // Tangential test started
        eventSource.addEventListener("tangential_test_started", (e) => {
            const data = JSON.parse(e.data);
            setExecutionState(TestExecutionState.TANGENTIAL_RUNNING);
            addEvent("tangential_test_started", data);
            message.info("Tangential test started");
        });

        // Radial test started
        eventSource.addEventListener("radial_test_started", (e) => {
            const data = JSON.parse(e.data);
            setExecutionState(TestExecutionState.RADIAL_RUNNING);
            addEvent("radial_test_started", data);
            message.info("Radial test started");
        });

        // Tangential test completed
        eventSource.addEventListener("tangential_test_completed", (e) => {
            const data = JSON.parse(e.data);
            setExecutionState(TestExecutionState.TANGENTIAL_COMPLETE);
            addEvent("tangential_test_completed", data);
            message.success("Tangential test completed!");
        });

        // Radial test completed
        eventSource.addEventListener("radial_test_completed", (e) => {
            const data = JSON.parse(e.data);
            setExecutionState(TestExecutionState.RADIAL_COMPLETE);
            addEvent("radial_test_completed", data);
            message.success("Radial test completed!");
        });

        // Phase completed, awaiting next selection
        eventSource.addEventListener("phase_completed_awaiting_next", (e) => {
            const data = JSON.parse(e.data);

            // Transition to appropriate complete state
            if (data.completed_phase === 'TANGENTIAL') {
                setExecutionState(TestExecutionState.TANGENTIAL_COMPLETE);
            } else if (data.completed_phase === 'RADIAL') {
                setExecutionState(TestExecutionState.RADIAL_COMPLETE);
            }

            addEvent("phase_completed_awaiting_next", data);

            // Show modal for next phase selection
            if (!modalShownRef.current) {
                modalShownRef.current = true;
                showNextPhaseModal(data.test_id, data.completed_phase, data.next_phase);
            }
        });

        // All tests completed
        eventSource.addEventListener("test_completed", (e) => {
            const data = JSON.parse(e.data);
            setExecutionState(TestExecutionState.ALL_COMPLETE);
            addEvent("test_completed", data);
            message.success("All tests completed successfully!");
        });

        // Test failed
        eventSource.addEventListener("test_failed", (e) => {
            const data = JSON.parse(e.data);
            setExecutionState(TestExecutionState.ERROR);
            addEvent("test_failed", data);
            message.error(`Test failed: ${data.error || 'Unknown error'}`);
        });

        // Test paused
        eventSource.addEventListener("test_paused", (e) => {
            const data = JSON.parse(e.data);

            // Transition to paused state based on current phase
            if (executionState === TestExecutionState.BOUNDARY_RUNNING) {
                setExecutionState(TestExecutionState.BOUNDARY_PAUSED);
            } else if (executionState === TestExecutionState.TANGENTIAL_RUNNING) {
                setExecutionState(TestExecutionState.TANGENTIAL_PAUSED);
            } else if (executionState === TestExecutionState.RADIAL_RUNNING) {
                setExecutionState(TestExecutionState.RADIAL_PAUSED);
            }

            addEvent("test_paused", data);
            message.info("Test paused");
        });

        // Test resumed
        eventSource.addEventListener("test_resumed", (e) => {
            const data = JSON.parse(e.data);

            // Transition back to running state
            if (executionState === TestExecutionState.BOUNDARY_PAUSED) {
                setExecutionState(TestExecutionState.BOUNDARY_RUNNING);
            } else if (executionState === TestExecutionState.TANGENTIAL_PAUSED) {
                setExecutionState(TestExecutionState.TANGENTIAL_RUNNING);
            } else if (executionState === TestExecutionState.RADIAL_PAUSED) {
                setExecutionState(TestExecutionState.RADIAL_RUNNING);
            }

            addEvent("test_resumed", data);
            message.info("Test resumed");
        });

        // Test stopped
        eventSource.addEventListener("test_stopped", (e) => {
            const data = JSON.parse(e.data);
            addEvent("test_stopped", data);
            message.info("Test stopped");
        });

        // Progress updates
        eventSource.addEventListener("phase_progress", (e) => {
            const data = JSON.parse(e.data);
            setPhaseProgress({
                phase: data.phase,
                total: data.total || 0,
                completed: data.completed || 0
            });
        });

        // Compliance measurement completed
        eventSource.addEventListener("compliance_measurement_completed", (e) => {
            const data = JSON.parse(e.data);

            if (data.x !== undefined && data.y !== undefined) {
                // Tangential grid test result
                setTangentialResults(prev => [...prev, {
                    angle: data.angle,
                    distance: data.distance,
                    detected: data.detected
                }]);
            } else {
                // Radial test result
                setRadialResults(prev => [...prev, {
                    angle: data.angle,
                    distance: data.distance,
                    offset_from_boundary: data.offset_from_boundary,
                    detected: data.detected
                }]);
            }
        });

        // Error handling
        eventSource.onerror = () => {
            console.error("SSE connection error");
            setConnected(false);
        };

        eventSourceRef.current = eventSource;

        return () => {
            eventSource.close();
        };
    }, [executionState]); // Include executionState in dependencies

    // Auto-connect to stream on mount
    useEffect(() => {
        const cleanup = connectStream();
        return cleanup;
    }, [connectStream]);

    // =========================================================================
    // MODAL FUNCTIONS
    // =========================================================================

    const showPhaseSelectionModal = (test_id: number) => {
        Modal.confirm({
            title: "Boundary Detection Complete",
            content: "Boundary detection is complete. Which test would you like to run next?",
            okText: "Tangential Test",
            cancelText: "Radial Test",
            onOk: () => {
                modalShownRef.current = false;
                startTestPhase('TANGENTIAL', test_id);
            },
            onCancel: () => {
                modalShownRef.current = false;
                startTestPhase('RADIAL', test_id);
            },
            closable: false,
            maskClosable: false
        });
    };

    const showNextPhaseModal = (test_id: number, completed_phase: string, next_phase: string) => {
        Modal.confirm({
            title: `${completed_phase} Test Complete`,
            content: `The ${completed_phase.toLowerCase()} test is complete. Would you like to run the ${next_phase.toLowerCase()} test now?`,
            okText: `Start ${next_phase} Test`,
            cancelText: "Finish",
            onOk: () => {
                modalShownRef.current = false;
                startTestPhase(next_phase as 'TANGENTIAL' | 'RADIAL', test_id);
            },
            onCancel: () => {
                modalShownRef.current = false;
                message.info("Test paused. You can resume later.");
            },
            closable: false,
            maskClosable: false
        });
    };

    // =========================================================================
    // API FUNCTIONS
    // =========================================================================

    const startTest = useCallback(async (config: MasterTestConfiguration) => {
        try {
            await api.post('/api/master-test/start', config);
            message.success("Test started!");
        } catch (error: any) {
            message.error(error.response?.data?.error || "Failed to start test");
            setExecutionState(TestExecutionState.ERROR);
        }
    }, []);

    const startTestPhase = useCallback(async (test_type: 'TANGENTIAL' | 'RADIAL', test_id?: number) => {
        try {
            await api.post('/api/master-test/start-phase', { test_type, test_id });
            message.success(`${test_type} test started!`);
        } catch (error: any) {
            message.error(error.response?.data?.error || `Failed to start ${test_type} test`);
        }
    }, []);

    const pauseTest = useCallback(async () => {
        try {
            await api.post('/api/master-test/pause');
        } catch (error: any) {
            message.error(error.response?.data?.error || "Failed to pause test");
        }
    }, []);

    const resumeTest = useCallback(async () => {
        try {
            await api.post('/api/master-test/resume');
        } catch (error: any) {
            message.error(error.response?.data?.error || "Failed to resume test");
        }
    }, []);

    const stopTest = useCallback(async () => {
        try {
            await api.post('/api/master-test/stop');
        } catch (error: any) {
            message.error(error.response?.data?.error || "Failed to stop test");
        }
    }, []);

    const loadTestHistory = useCallback(async (test_id: number, viewOnly: boolean = false) => {
        try {
            console.log(`[useMasterTest] Loading test history for test ${test_id}, viewOnly=${viewOnly}`);

            // 1. Load test metadata
            const testResponse = await api.get(`/api/test/${test_id}`);
            const test = testResponse.data;

            setTestId(test_id);

            // 2. Load test state (includes boundary results)
            const stateResponse = await api.get(`/api/test/${test_id}/state`);
            const state = stateResponse.data;

            // 3. Load boundary results
            if (state.boundary_results) {
                const parsed = typeof state.boundary_results === 'string'
                    ? JSON.parse(state.boundary_results)
                    : state.boundary_results;
                setBoundaryResults(parsed || []);
            }

            // 4. Load tangential results (compliance steps with type GRID_TANGENTIAL)
            try {
                const tangentialResponse = await api.get(`/api/test/${test_id}/steps`, {
                    params: { step_type: 'GRID_TANGENTIAL' }
                });

                const tangentialData = tangentialResponse.data.map((step: any) => ({
                    angle: step.angle,
                    distance: step.distance_1,
                    detected: step.detection_final,
                    offset_from_boundary: null
                }));
                setTangentialResults(tangentialData);
            } catch (err) {
                console.warn("[useMasterTest] No tangential results found");
                setTangentialResults([]);
            }

            // 5. Load radial results (compliance steps with type COMPLIANCE_RADIAL)
            try {
                const radialResponse = await api.get(`/api/test/${test_id}/steps`, {
                    params: { step_type: 'COMPLIANCE_RADIAL' }
                });

                const radialData = radialResponse.data.map((step: any) => ({
                    angle: step.angle,
                    distance: step.distance_1,
                    detected: step.detection_final,
                    offset_from_boundary: step.distance_2
                }));
                setRadialResults(radialData);
            } catch (err) {
                console.warn("[useMasterTest] No radial results found");
                setRadialResults([]);
            }

            // 6. Set execution state based on current phase and status
            const currentPhase = state.current_phase || test.test_phase;

            if (test.status === 'COMPLETED') {
                setExecutionState(TestExecutionState.ALL_COMPLETE);
            } else if (test.status === 'ERROR') {
                setExecutionState(TestExecutionState.ERROR);
            } else if (test.status === 'PAUSED') {
                // Determine correct paused state based on current phase
                if (currentPhase === 'BOUNDARY_DETECTION') {
                    setExecutionState(TestExecutionState.BOUNDARY_PAUSED);
                } else if (currentPhase === 'TANGENTIAL_TEST') {
                    setExecutionState(TestExecutionState.TANGENTIAL_PAUSED);
                } else if (currentPhase === 'RADIAL_TEST') {
                    setExecutionState(TestExecutionState.RADIAL_PAUSED);
                } else {
                    setExecutionState(TestExecutionState.IDLE);
                }
            } else if (test.status === 'IN_PROGRESS') {
                if (currentPhase === 'BOUNDARY_DETECTION') {
                    setExecutionState(TestExecutionState.BOUNDARY_RUNNING);
                } else if (currentPhase === 'TANGENTIAL_TEST') {
                    setExecutionState(TestExecutionState.TANGENTIAL_RUNNING);
                } else if (currentPhase === 'RADIAL_TEST') {
                    setExecutionState(TestExecutionState.RADIAL_RUNNING);
                }
            } else {
                setExecutionState(TestExecutionState.IDLE);
            }

            message.success(viewOnly ? "Test history loaded" : "Test resumed");
        } catch (error: any) {
            console.error("[useMasterTest] Failed to load test history:", error);
            message.error("Failed to load test history");
        }
    }, []);

    // =========================================================================
    // UTILITY FUNCTIONS
    // =========================================================================

    const addEvent = useCallback((type: string, data: Record<string, unknown>) => {
        setEvents(prev => [
            ...prev.slice(-99), // Keep last 100 events
            {
                type,
                data,
                timestamp: new Date().toISOString()
            }
        ]);
    }, []);

    // =========================================================================
    // RETURN HOOK API
    // =========================================================================

    return {
        // State
        executionState,
        testId,
        currentPhase,
        status,

        // Derived flags
        isRunning,
        isPaused,
        isCompleted,
        boundaryComplete,
        tangentialComplete,
        radialComplete,
        awaitingSelection,

        // Data
        boundaryResults,
        tangentialResults,
        radialResults,
        phaseProgress,
        events,
        connected,

        // Actions
        startTest,
        startTestPhase,
        pauseTest,
        resumeTest,
        stopTest,
        loadTestHistory
    };
}
