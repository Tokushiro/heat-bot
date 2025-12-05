import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../Components/apiAxios";
import { message, Modal } from "antd";

export type TestPhase = 'BOUNDARY_DETECTION' | 'TANGENTIAL_TEST' | 'RADIAL_TEST' | 'COMPLETED';
type TestStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'PAUSED' | 'ERROR';

export interface MasterTestConfiguration {
    test_id: number;
    sensor_id: number;
    test_type: 'RADIAL' | 'TANGENTIAL' | 'FULL';
    
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

export interface BoundaryResult {
    angle: number;
    detected_distance: number | null;
    no_detection_distance: number | null;
    detection_boundary: number | null;
}

export interface TestState {
    test_id: number;
    current_phase: TestPhase;
    boundary_results: BoundaryResult[];
    awaiting_user_confirmation: boolean;
}

export interface TestEvent {
    type: string;
    data: any;
    timestamp: string;
}

export function useMasterTest() {
    const [isRunning, setIsRunning] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [currentPhase, setCurrentPhase] = useState<TestPhase | null>(null);
    const [testState, setTestState] = useState<TestState | null>(null);
    const [boundaryResults, setBoundaryResults] = useState<BoundaryResult[]>([]);
    const [awaitingContinuation, setAwaitingContinuation] = useState(false);
    const [status, setStatus] = useState<TestStatus>('PLANNED');
    const [events, setEvents] = useState<TestEvent[]>([]);
    const [connected, setConnected] = useState(false);
    const [phaseProgress, setPhaseProgress] = useState<any>(null);
    const eventSourceRef = useRef<EventSource | null>(null);

    /**
     * Connect to SSE stream
     */
    const connectStream = useCallback(() => {
        const baseURL = api.defaults.baseURL || "";
        const eventSource = new EventSource(`${baseURL}/api/master-test/stream`);

        eventSource.addEventListener("connected", () => {
            setConnected(true);
            console.log("Connected to master test stream");
        });

        eventSource.addEventListener("test_started", (e) => {
            const data = JSON.parse(e.data);
            setIsRunning(true);
            setIsPaused(false);
            setCurrentPhase(data.phase);
            setStatus('IN_PROGRESS');
            addEvent("test_started", data);
            message.success(`Test ${data.test_id} started - Phase: ${data.phase}`);
        });

        eventSource.addEventListener("boundary_detection_completed", (e) => {
            const data = JSON.parse(e.data);
            setIsRunning(false);
            setIsPaused(false);
            setBoundaryResults(data.boundary_results);
            setAwaitingContinuation(true);
            setStatus('PAUSED');
            addEvent("boundary_detection_completed", data);
            
            // Show modal asking user to continue
            showContinuationModal(data);
        });

        eventSource.addEventListener("compliance_test_started", (e) => {
            const data = JSON.parse(e.data);
            setIsRunning(true);
            setCurrentPhase('TANGENTIAL_TEST'); // Default to tangential for legacy
            setAwaitingContinuation(false);
            setIsPaused(false);
            setStatus('IN_PROGRESS');
            addEvent("compliance_test_started", data);
            message.success("Starting compliance test phase");
        });

        eventSource.addEventListener("tangential_test_started", (e) => {
            const data = JSON.parse(e.data);
            setIsRunning(true);
            setCurrentPhase('TANGENTIAL_TEST');
            setAwaitingContinuation(false);
            setIsPaused(false);
            setStatus('IN_PROGRESS');
            addEvent("tangential_test_started", data);
            message.success("Starting tangential test phase");
        });

        eventSource.addEventListener("radial_test_started", (e) => {
            const data = JSON.parse(e.data);
            setIsRunning(true);
            setCurrentPhase('RADIAL_TEST');
            setAwaitingContinuation(false);
            setIsPaused(false);
            setStatus('IN_PROGRESS');
            addEvent("radial_test_started", data);
            message.success("Starting radial test phase");
        });

        eventSource.addEventListener("phase_completed_awaiting_next", (e) => {
            const data = JSON.parse(e.data);
            setIsRunning(false);
            setAwaitingContinuation(true);
            setStatus('PAUSED');
            addEvent("phase_completed_awaiting_next", data);

            // Show modal for next test
            showContinuationModal(data);
        });

        eventSource.addEventListener("test_completed", (e) => {
            const data = JSON.parse(e.data);
            setIsRunning(false);
            setCurrentPhase('COMPLETED');
            setIsPaused(false);
            setStatus('COMPLETED');
            addEvent("test_completed", data);
            message.success(`Test ${data.test_id} completed successfully!`);
        });

        eventSource.addEventListener("test_failed", (e) => {
            const data = JSON.parse(e.data);
            setIsRunning(false);
            setIsPaused(false);
            setStatus('ERROR');
            addEvent("test_failed", data);
            message.error(`Test failed: ${data.error}`);
        });

        eventSource.addEventListener("test_paused", () => {
            setIsPaused(true);
            setIsRunning(false);
            setStatus('PAUSED');
            addEvent("test_paused", {});
            message.info("Test paused");
        });

        eventSource.addEventListener("test_resumed", () => {
            setIsPaused(false);
            setIsRunning(true);
            setStatus('IN_PROGRESS');
            addEvent("test_resumed", {});
            message.info("Test resumed");
        });

        eventSource.addEventListener("test_stopped", () => {
            setIsRunning(false);
            setIsPaused(false);
            setAwaitingContinuation(false);
            setStatus('PAUSED');
            addEvent("test_stopped", {});
            message.info("Test stopped");
        });

        eventSource.addEventListener("boundary_found_at_angle", (e) => {
            const data = JSON.parse(e.data);
            addEvent("boundary_found_at_angle", data);
            message.success(`Boundary found at ${data.angle}°: ${data.boundary?.toFixed(2)}m`);
        });

        eventSource.addEventListener("compliance_measurement_completed", (e) => {
            const data = JSON.parse(e.data);
            addEvent("compliance_measurement_completed", data);
        });

        eventSource.addEventListener("phase_progress", (e) => {
            const data = JSON.parse(e.data);
            setPhaseProgress(data);
        });

        eventSource.addEventListener("movement_started", (e) => {
            const data = JSON.parse(e.data);
            addEvent("movement_started", data);
        });

        eventSource.addEventListener("measurement_completed", (e) => {
            const data = JSON.parse(e.data);
            addEvent("measurement_completed", data);
        });

        eventSource.addEventListener("detection", (e) => {
            const data = JSON.parse(e.data);
            addEvent("detection", data);

            if (data.detected) {
                message.info("Detection event received", 1);
            }
        });

        eventSource.addEventListener("test_log", (e) => {
            const data = JSON.parse(e.data);
            addEvent("test_log", data);
        });

        eventSource.onerror = (error) => {
            setConnected(false);
            console.error("Master test SSE error:", error);
        };

        eventSourceRef.current = eventSource;
    }, []);

    /**
     * Show modal asking user to continue to compliance test
     */
    const showContinuationModal = (data: any) => {
        // Determine which tests are still pending
        const tangentialPending = !data.tangential_completed;
        const radialPending = !data.radial_completed;

        if (tangentialPending && radialPending) {
            // Both tests pending - ask user which to start first
            Modal.confirm({
                title: "Boundary Detection Complete",
                content: (
                    <div>
                        <p>{data.message}</p>
                        <p>Detected boundaries at {data.boundary_results.length} angles.</p>
                        <p style={{ marginTop: 16, fontWeight: '500' }}>Which test would you like to run first?</p>
                        <ul style={{ marginTop: 8 }}>
                            <li><strong>Tangential Test:</strong> Sweeps around at fixed radii (2m, 3m) in 15° increments</li>
                            <li><strong>Radial Test:</strong> Tests at boundary + 2m and boundary + 3m for all detected angles</li>
                        </ul>
                    </div>
                ),
                okText: "Start Tangential Test",
                cancelText: "Start Radial Test",
                onOk: async () => {
                    await startTestPhase('TANGENTIAL');
                },
                onCancel: async () => {
                    await startTestPhase('RADIAL');
                }
            });
        } else if (tangentialPending) {
            // Only tangential pending
            Modal.confirm({
                title: "Radial Test Complete",
                content: (
                    <div>
                        <p>Radial test completed successfully!</p>
                        <p>Would you like to continue with the Tangential test?</p>
                    </div>
                ),
                okText: "Start Tangential Test",
                cancelText: "Stop Here",
                onOk: async () => {
                    await startTestPhase('TANGENTIAL');
                },
                onCancel: () => {
                    message.info("Test stopped after radial phase");
                    setAwaitingContinuation(false);
                }
            });
        } else if (radialPending) {
            // Only radial pending
            Modal.confirm({
                title: "Tangential Test Complete",
                content: (
                    <div>
                        <p>Tangential test completed successfully!</p>
                        <p>Would you like to continue with the Radial test?</p>
                    </div>
                ),
                okText: "Start Radial Test",
                cancelText: "Stop Here",
                onOk: async () => {
                    await startTestPhase('RADIAL');
                },
                onCancel: () => {
                    message.info("Test stopped after tangential phase");
                    setAwaitingContinuation(false);
                }
            });
        }
    };

    /**
     * Disconnect from SSE stream
     */
    const disconnectStream = useCallback(() => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
            setConnected(false);
        }
    }, []);

    /**
     * Add event to log
     */
    const addEvent = (type: string, data: any) => {
        setEvents((prev) => [
            {
                type,
                data,
                timestamp: new Date().toISOString()
            },
            ...prev
        ].slice(0, 100));
    };

    /**
     * Start a new master test
     */
    const startTest = useCallback(async (config: MasterTestConfiguration) => {
        console.log("=".repeat(60));
        console.log("📡 [Hook] startTest called");
        console.log("=".repeat(60));
        console.log("Config:", config);
        console.log("API URL:", "/api/master-test/start");

        try {
            console.log("📤 Sending POST request...");
            const response = await api.post("/api/master-test/start", config);
            console.log("✅ Response received:", response.data);
            // Status will be updated via SSE
        } catch (err: any) {
            console.error("❌ API Error:", err);
            console.error("Error response:", err?.response?.data);
            message.error(err?.response?.data?.error || "Failed to start test");
            throw err;
        }
    }, []);

    /**
     * Start a specific test phase (tangential or radial)
     */
    const startTestPhase = useCallback(async (testType: 'TANGENTIAL' | 'RADIAL') => {
        try {
            await api.post("/api/master-test/start-phase", { test_type: testType });
            setAwaitingContinuation(false);
            message.success(`Starting ${testType.toLowerCase()} test`);
        } catch (err: any) {
            message.error(err?.response?.data?.error || `Failed to start ${testType.toLowerCase()} test`);
            throw err;
        }
    }, []);

    /**
     * Continue to compliance test phase (legacy)
     * @deprecated Use startTestPhase instead
     */
    const continueToCompliance = useCallback(async () => {
        try {
            await api.post("/api/master-test/continue");
            setAwaitingContinuation(false);
        } catch (err: any) {
            message.error(err?.response?.data?.error || "Failed to continue to compliance test");
            throw err;
        }
    }, []);

    /**
     * Load historical test data (steps, boundary results, progress)
     */
    const loadTestHistory = useCallback(async (test_id: number) => {
        try {
            // Load test state
            const stateRes = await api.get(`/api/test/${test_id}/state`);
            if (stateRes.data) {
                setCurrentPhase(stateRes.data.current_phase);
                if (stateRes.data.boundary_results) {
                    const results = JSON.parse(stateRes.data.boundary_results);
                    setBoundaryResults(results);
                }
                setAwaitingContinuation(stateRes.data.awaiting_confirmation || false);

                // Set phase progress
                if (stateRes.data.current_phase === 'BOUNDARY_DETECTION' || stateRes.data.boundary_results) {
                    const results = stateRes.data.boundary_results ? JSON.parse(stateRes.data.boundary_results) : [];
                    setPhaseProgress({
                        phase: stateRes.data.current_phase || 'BOUNDARY_DETECTION',
                        completed_angles: results.length,
                        total_angles: 36
                    });
                }
            }

            // Load test steps and convert to events
            const stepsRes = await api.get(`/api/test/${test_id}/steps`);
            if (stepsRes.data && stepsRes.data.length > 0) {
                const historicalEvents: TestEvent[] = stepsRes.data.map((step: any) => ({
                    type: 'test_log',
                    data: {
                        message: `Step ${step.sequence_no}: ${step.step_type} at angle ${step.angle}°, distance ${step.distance_1}m - ${step.status}`
                    },
                    timestamp: step.started_at || new Date().toISOString()
                }));
                setEvents(historicalEvents.reverse().slice(0, 100));
            }

            // Load summary for progress
            const summaryRes = await api.get(`/api/test/${test_id}/steps/summary`);
            if (summaryRes.data) {
                // This data can be used for additional progress indicators if needed
                console.log("Test summary loaded:", summaryRes.data);
            }
        } catch (err: any) {
            console.error("Failed to load test history:", err);
            message.warning("Some historical data could not be loaded");
        }
    }, []);

    /**
     * Resume test from saved state
     */
    const resumeFromState = useCallback(async (test_id: number) => {
        try {
            // First load the historical data
            await loadTestHistory(test_id);

            // Then resume the test execution
            await api.post("/api/master-test/resume", { test_id });
            message.success("Test state loaded");
            // State will be updated via SSE
        } catch (err: any) {
            message.error(err?.response?.data?.error || "Failed to resume test");
            throw err;
        }
    }, [loadTestHistory]);

    /**
     * Pause the current test
     */
    const pauseTest = useCallback(async () => {
        try {
            await api.post("/api/master-test/pause");
        } catch (err: any) {
            message.error(err?.response?.data?.error || "Failed to pause test");
            throw err;
        }
    }, []);

    /**
     * Resume the current test execution
     */
    const resumeTest = useCallback(async () => {
        try {
            await api.post("/api/master-test/resume-execution");
        } catch (err: any) {
            message.error(err?.response?.data?.error || "Failed to resume test");
            throw err;
        }
    }, []);

    /**
     * Stop the current test
     */
    const stopTest = useCallback(async () => {
        try {
            await api.post("/api/master-test/stop");
        } catch (err: any) {
            message.error(err?.response?.data?.error || "Failed to stop test");
            throw err;
        }
    }, []);

    /**
     * Fetch current state
     */
    const fetchState = useCallback(async () => {
        try {
            const res = await api.get<{ 
                is_running: boolean; 
                is_paused: boolean;
                current_test: MasterTestConfiguration | null;
                state: TestState | null;
            }>("/api/master-test/state");
            
            setIsRunning(res.data.is_running);
            setIsPaused(res.data.is_paused);
            setTestState(res.data.state);
            if (res.data.state?.current_phase === 'COMPLETED') {
                setStatus('COMPLETED');
            } else if (res.data.is_running) {
                setStatus('IN_PROGRESS');
            } else if (res.data.is_paused || res.data.state) {
                setStatus('PAUSED');
            } else {
                setStatus('PLANNED');
            }
            
            if (res.data.state) {
                setCurrentPhase(res.data.state.current_phase);
                setBoundaryResults(res.data.state.boundary_results);
                setAwaitingContinuation(res.data.state.awaiting_user_confirmation);
            }
        } catch (err: any) {
            console.error("Failed to fetch state:", err);
        }
    }, []);

    /**
     * Clear event log
     */
    const clearEvents = useCallback(() => {
        setEvents([]);
    }, []);

    // Auto-connect to stream on mount
    useEffect(() => {
        connectStream();
        fetchState();

        return () => {
            disconnectStream();
        };
    }, [connectStream, disconnectStream, fetchState]);

    return {
        isRunning,
        isPaused,
        currentPhase,
        testState,
        boundaryResults,
        awaitingContinuation,
        status,
        phaseProgress,
        events,
        connected,
        startTest,
        startTestPhase,
        continueToCompliance,
        resumeFromState,
        loadTestHistory,
        pauseTest,
        resumeTest,
        stopTest,
        fetchState,
        clearEvents
    };
}
