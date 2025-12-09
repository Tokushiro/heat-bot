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

export interface ComplianceResult {
    angle: number;
    distance: number;
    offset_from_boundary?: number;
    detected: boolean;
}

export interface TestState {
    test_id: number;
    current_phase: TestPhase;
    boundary_results: BoundaryResult[];
    awaiting_user_confirmation: boolean;
    awaiting_test_selection?: boolean;
    boundary_detection_completed?: boolean;
    tangential_test_completed?: boolean;
    radial_test_completed?: boolean;
}

export interface TestEvent {
    type: string;
    data: Record<string, unknown>;
    timestamp: string;
}

export function useMasterTest() {
    const [isRunning, setIsRunning] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [currentPhase, setCurrentPhase] = useState<TestPhase | null>(null);
    const [testState, setTestState] = useState<TestState | null>(null);
    const [boundaryResults, setBoundaryResults] = useState<BoundaryResult[]>([]);
    const [tangentialResults, setTangentialResults] = useState<ComplianceResult[]>([]);
    const [radialResults, setRadialResults] = useState<ComplianceResult[]>([]);
    const [awaitingContinuation, setAwaitingContinuation] = useState(false);
    const [status, setStatus] = useState<TestStatus>('PLANNED');
    const [events, setEvents] = useState<TestEvent[]>([]);
    const [connected, setConnected] = useState(false);
    const [phaseProgress, setPhaseProgress] = useState<{
        phase: string;
        total_angles?: number;
        completed_angles?: number;
        total_positions?: number;
        completed_positions?: number;
    } | null>(null);

    // Refs
    const eventSourceRef = useRef<EventSource | null>(null);
    const showContinuationModalRef = useRef<((data: { boundary_results: BoundaryResult[]; tangential_completed?: boolean; radial_completed?: boolean; message?: string }) => void) | null>(null);
    const currentPhaseRef = useRef<TestPhase | null>(null);
    const modalShownRef = useRef<boolean>(false); // Track if modal is already showing to prevent duplicates

    // Keep currentPhase in sync with ref for event handlers
    useEffect(() => {
        currentPhaseRef.current = currentPhase;
    }, [currentPhase]);

    // Phase completion tracking
    const [boundaryDetectionCompleted, setBoundaryDetectionCompleted] = useState(false);
    const [tangentialTestCompleted, setTangentialTestCompleted] = useState(false);
    const [radialTestCompleted, setRadialTestCompleted] = useState(false);

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
            console.log("[useMasterTest] boundary_detection_completed event received", { modalShown: modalShownRef.current });

            setIsRunning(false);
            setIsPaused(false);
            setCurrentPhase('BOUNDARY_DETECTION');
            setBoundaryResults(data.boundary_results);
            setBoundaryDetectionCompleted(true);
            setAwaitingContinuation(true);
            setStatus('PAUSED');

            // Track phase completions from event data
            if (data.tangential_completed) setTangentialTestCompleted(true);
            if (data.radial_completed) setRadialTestCompleted(true);

            addEvent("boundary_detection_completed", data);

            // Show modal asking user to continue (prevent duplicates)
            if (showContinuationModalRef.current && !modalShownRef.current) {
                modalShownRef.current = true;
                showContinuationModalRef.current(data);
            }
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
            console.log("[useMasterTest] tangential_test_started event received");

            modalShownRef.current = false; // Reset modal flag when test starts
            setIsRunning(true);
            setCurrentPhase('TANGENTIAL_TEST');
            setAwaitingContinuation(false);
            setIsPaused(false);
            setStatus('IN_PROGRESS');
            setTangentialResults([]); // Clear previous results
            addEvent("tangential_test_started", data);
            message.success("Starting tangential test phase");
        });

        eventSource.addEventListener("radial_test_started", (e) => {
            const data = JSON.parse(e.data);
            console.log("[useMasterTest] radial_test_started event received");

            modalShownRef.current = false; // Reset modal flag when test starts
            setIsRunning(true);
            setCurrentPhase('RADIAL_TEST');
            setAwaitingContinuation(false);
            setIsPaused(false);
            setStatus('IN_PROGRESS');
            setRadialResults([]); // Clear previous results
            addEvent("radial_test_started", data);
            message.success("Starting radial test phase");
        });

        eventSource.addEventListener("phase_completed_awaiting_next", (e) => {
            const data = JSON.parse(e.data);
            console.log("[useMasterTest] phase_completed_awaiting_next event received", {
                completed_phase: data.completed_phase,
                modalShown: modalShownRef.current
            });

            setIsRunning(false);
            setAwaitingContinuation(true);
            setStatus('PAUSED');

            // Update current phase to the one that just completed
            if (data.completed_phase === 'TANGENTIAL') {
                setCurrentPhase('TANGENTIAL_TEST');
                setTangentialTestCompleted(true);
            } else if (data.completed_phase === 'RADIAL') {
                setCurrentPhase('RADIAL_TEST');
                setRadialTestCompleted(true);
            }

            // Track phase completions
            if (data.tangential_completed) setTangentialTestCompleted(true);
            if (data.radial_completed) setRadialTestCompleted(true);

            addEvent("phase_completed_awaiting_next", data);

            // Show modal for next test (prevent duplicates)
            if (showContinuationModalRef.current && !modalShownRef.current) {
                modalShownRef.current = true;
                showContinuationModalRef.current(data);
            }
        });

        eventSource.addEventListener("test_completed", (e) => {
            const data = JSON.parse(e.data);
            console.log("[useMasterTest] test_completed event received");

            modalShownRef.current = false; // Reset modal flag
            setIsRunning(false);
            setCurrentPhase('COMPLETED');
            setIsPaused(false);
            setAwaitingContinuation(false);
            setStatus('COMPLETED');
            addEvent("test_completed", data);
            message.success(`Test ${data.test_id} completed successfully!`);
        });

        eventSource.addEventListener("test_failed", (e) => {
            const data = JSON.parse(e.data);
            console.log("[useMasterTest] test_failed event received");

            modalShownRef.current = false; // Reset modal flag
            setIsRunning(false);
            setIsPaused(false);
            setAwaitingContinuation(false);
            setStatus('ERROR');
            addEvent("test_failed", data);
            message.error(`Test failed: ${data.error}`);
        });

        eventSource.addEventListener("test_paused", () => {
            console.log("[useMasterTest] test_paused event received");

            setIsPaused(true);
            setIsRunning(false);
            setStatus('PAUSED');
            addEvent("test_paused", {});
            message.info("Test paused");
        });

        eventSource.addEventListener("test_resumed", () => {
            console.log("[useMasterTest] test_resumed event received");

            setIsPaused(false);
            setIsRunning(true);
            setStatus('IN_PROGRESS');
            addEvent("test_resumed", {});
            message.info("Test resumed");
        });

        eventSource.addEventListener("test_stopped", (e) => {
            const data = JSON.parse(e.data);
            console.log("[useMasterTest] test_stopped event received", data);

            setIsRunning(false);
            setIsPaused(false);
            setStatus('PAUSED');

            // Update phase completion flags from event
            if (data.boundary_detection_completed !== undefined) {
                setBoundaryDetectionCompleted(data.boundary_detection_completed);
            }
            if (data.tangential_test_completed !== undefined) {
                setTangentialTestCompleted(data.tangential_test_completed);
            }
            if (data.radial_test_completed !== undefined) {
                setRadialTestCompleted(data.radial_test_completed);
            }

            // If test was stopped during a phase that can be restarted, set awaitingContinuation
            if (data.awaiting_test_selection) {
                setAwaitingContinuation(true);
                console.log("[useMasterTest] Test stopped mid-phase, showing restart buttons", {
                    boundary_completed: data.boundary_detection_completed,
                    tangential_completed: data.tangential_test_completed,
                    radial_completed: data.radial_test_completed
                });
            } else {
                setAwaitingContinuation(false);
            }

            // Update phase if provided
            if (data.current_phase) {
                setCurrentPhase(data.current_phase);
            }

            addEvent("test_stopped", data);
            message.info("Test stopped");
        });

        eventSource.addEventListener("boundary_found_at_angle", (e) => {
            const data = JSON.parse(e.data);
            addEvent("boundary_found_at_angle", data);
            message.success(`Boundary found at ${data.angle}°: ${data.boundary?.toFixed(2)}m`);
        });

        eventSource.addEventListener("compliance_measurement_completed", (e) => {
            const data = JSON.parse(e.data);

            // Add to appropriate results array based on current phase (use ref to get latest value)
            const result: ComplianceResult = {
                angle: data.angle as number,
                distance: data.distance as number,
                offset_from_boundary: data.offset_from_boundary as number | undefined,
                detected: data.detected as boolean
            };

            if (currentPhaseRef.current === 'TANGENTIAL_TEST') {
                setTangentialResults(prev => [...prev, result]);
            } else if (currentPhaseRef.current === 'RADIAL_TEST') {
                setRadialResults(prev => [...prev, result]);
            }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Empty deps - use refs for callbacks to avoid re-creating SSE connection

    /**
     * Show modal asking user to continue to compliance test
     */
    // Define startTestPhase first to avoid circular dependency
    /**
     * Start a specific test phase (tangential or radial)
     */
    const startTestPhase = useCallback(async (testType: 'TANGENTIAL' | 'RADIAL') => {
        try {
            await api.post("/api/master-test/start-phase", { test_type: testType });
            setAwaitingContinuation(false);
            message.success(`Starting ${testType.toLowerCase()} test`);
        } catch (err: unknown) {
            const axiosError = err as { response?: { data?: { error?: string } } };
            message.error(axiosError?.response?.data?.error || `Failed to start ${testType.toLowerCase()} test`);
            throw err;
        }
    }, []);

    const showContinuationModal = useCallback((data: { boundary_results: BoundaryResult[]; tangential_completed?: boolean; radial_completed?: boolean; message?: string }) => {
        console.log("[useMasterTest] showContinuationModal called", data);
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
                    modalShownRef.current = false; // Reset flag when user makes choice
                    await startTestPhase('TANGENTIAL');
                },
                onCancel: async () => {
                    modalShownRef.current = false; // Reset flag when user makes choice
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
                    modalShownRef.current = false; // Reset flag when user makes choice
                    await startTestPhase('TANGENTIAL');
                },
                onCancel: () => {
                    modalShownRef.current = false; // Reset flag when user dismisses
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
                    modalShownRef.current = false; // Reset flag when user makes choice
                    await startTestPhase('RADIAL');
                },
                onCancel: () => {
                    modalShownRef.current = false; // Reset flag when user dismisses
                    message.info("Test stopped after tangential phase");
                    setAwaitingContinuation(false);
                }
            });
        }
    }, [startTestPhase]);

    // Keep ref in sync with latest callback
    useEffect(() => {
        showContinuationModalRef.current = showContinuationModal;
    }, [showContinuationModal]);

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
    const addEvent = (type: string, data: Record<string, unknown>) => {
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
        } catch (err: unknown) {
            console.error("❌ API Error:", err);
            const axiosError = err as { response?: { data?: { error?: string } } };
            console.error("Error response:", axiosError?.response?.data);
            message.error(axiosError?.response?.data?.error || "Failed to start test");
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
        } catch (err: unknown) {
            const axiosError = err as { response?: { data?: { error?: string } } };
            message.error(axiosError?.response?.data?.error || "Failed to continue to compliance test");
            throw err;
        }
    }, []);

    /**
     * Load historical test data (steps, boundary results, progress)
     */
    const loadTestHistory = useCallback(async (test_id: number) => {
        try {
            // Load test details (including status)
            const testRes = await api.get(`/api/test/${test_id}`);
            if (testRes.data && testRes.data.status) {
                setStatus(testRes.data.status);
                console.log("[useMasterTest] Loaded test status from database:", testRes.data.status);
            }

            // Load test state
            const stateRes = await api.get(`/api/test/${test_id}/state`);
            if (stateRes.data) {
                // Determine actual current phase based on completion flags
                const stateData = stateRes.data.state_data || {};
                const boundaryComplete = stateRes.data.boundary_detection_completed || stateData.boundary_detection_completed || false;
                const tangentialComplete = stateRes.data.tangential_test_completed || stateData.tangential_test_completed || false;
                const radialComplete = stateRes.data.radial_test_completed || stateData.radial_test_completed || false;

                // Determine correct phase based on what's completed
                let actualPhase = stateRes.data.current_phase;
                if (stateRes.data.current_phase === 'COMPLETED') {
                    actualPhase = 'COMPLETED';
                } else if (radialComplete && tangentialComplete) {
                    // Both compliance tests done
                    actualPhase = 'COMPLETED';
                    // Also ensure status is set to COMPLETED
                    setStatus('COMPLETED');
                } else if (radialComplete && !tangentialComplete) {
                    // Radial done, awaiting tangential
                    actualPhase = 'RADIAL_TEST';
                } else if (tangentialComplete && !radialComplete) {
                    // Tangential done, awaiting radial
                    actualPhase = 'TANGENTIAL_TEST';
                } else if (boundaryComplete && !radialComplete && !tangentialComplete) {
                    // Boundary done, awaiting selection
                    actualPhase = 'BOUNDARY_DETECTION';
                }

                setCurrentPhase(actualPhase);

                // Parse boundary results safely
                let parsedBoundaryResults: BoundaryResult[] = [];
                if (stateRes.data.boundary_results) {
                    try {
                        // Check if it's already an array (not stringified)
                        if (Array.isArray(stateRes.data.boundary_results)) {
                            parsedBoundaryResults = stateRes.data.boundary_results;
                        } else if (typeof stateRes.data.boundary_results === 'string' && stateRes.data.boundary_results.trim()) {
                            // Only parse if it's a non-empty string
                            parsedBoundaryResults = JSON.parse(stateRes.data.boundary_results);
                        }
                        setBoundaryResults(parsedBoundaryResults);
                    } catch (parseError) {
                        console.error("Failed to parse boundary_results:", parseError);
                        console.log("Raw boundary_results:", stateRes.data.boundary_results);
                        // Set empty array on parse error
                        setBoundaryResults([]);
                    }
                }

                // Check state_data for awaiting flags (reuse variables from above)
                const isAwaitingContinuation =
                    stateRes.data.awaiting_confirmation ||
                    stateRes.data.awaiting_test_selection ||
                    stateData.awaiting_test_selection ||
                    stateData.awaiting_user_confirmation ||
                    false;

                setAwaitingContinuation(isAwaitingContinuation);

                // Set phase completion status (using variables defined above)

                setBoundaryDetectionCompleted(boundaryComplete);
                setTangentialTestCompleted(tangentialComplete);
                setRadialTestCompleted(radialComplete);

                // Set status based on phase completion
                if (stateRes.data.current_phase === 'COMPLETED') {
                    setStatus('COMPLETED');
                } else if (isAwaitingContinuation) {
                    setStatus('PAUSED');
                    setIsPaused(false); // Not technically paused, just awaiting selection
                } else if (parsedBoundaryResults.length > 0) {
                    setStatus('IN_PROGRESS');
                }

                // Set phase progress
                if (stateRes.data.current_phase === 'BOUNDARY_DETECTION' || parsedBoundaryResults.length > 0) {
                    setPhaseProgress({
                        phase: stateRes.data.current_phase || 'BOUNDARY_DETECTION',
                        completed_angles: parsedBoundaryResults.length,
                        total_angles: 36
                    });
                }

                console.log("[useMasterTest] Loaded test state from database:");
                console.log("  - Current phase:", stateRes.data.current_phase);
                console.log("  - Boundary complete:", boundaryComplete);
                console.log("  - Tangential complete:", tangentialComplete);
                console.log("  - Radial complete:", radialComplete);
                console.log("  - Awaiting continuation:", isAwaitingContinuation);

                // Load compliance results (always try to fetch, even if not complete - to show partial results)
                try {
                    const tangentialRes = await api.get(`/api/test/${test_id}/compliance-results?type=TANGENTIAL`);
                    if (tangentialRes.data && tangentialRes.data.length > 0) {
                        setTangentialResults(tangentialRes.data);
                        console.log(`[useMasterTest] Loaded ${tangentialRes.data.length} tangential results from database`);
                    }
                } catch (err) {
                    console.error("Failed to load tangential results:", err);
                }

                try {
                    const radialRes = await api.get(`/api/test/${test_id}/compliance-results?type=RADIAL`);
                    if (radialRes.data && radialRes.data.length > 0) {
                        setRadialResults(radialRes.data);
                        console.log(`[useMasterTest] Loaded ${radialRes.data.length} radial results from database`);
                    }
                } catch (err) {
                    console.error("Failed to load radial results:", err);
                }
            }

            // Load test steps and convert to events
            const stepsRes = await api.get<Array<{ sequence_no: number; step_type: string; angle: number; distance_1: number; status: string; started_at?: string }>>(`/api/test/${test_id}/steps`);
            if (stepsRes.data && stepsRes.data.length > 0) {
                const historicalEvents: TestEvent[] = stepsRes.data.map((step) => ({
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
        } catch (err: unknown) {
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
        } catch (err: unknown) {
            const axiosError = err as { response?: { data?: { error?: string } } };
            message.error(axiosError?.response?.data?.error || "Failed to resume test");
            throw err;
        }
    }, [loadTestHistory]);

    /**
     * Pause the current test
     */
    const pauseTest = useCallback(async () => {
        try {
            await api.post("/api/master-test/pause");
        } catch (err: unknown) {
            const axiosError = err as { response?: { data?: { error?: string } } };
            message.error(axiosError?.response?.data?.error || "Failed to pause test");
            throw err;
        }
    }, []);

    /**
     * Resume the current test execution
     */
    const resumeTest = useCallback(async () => {
        try {
            await api.post("/api/master-test/resume-execution");
        } catch (err: unknown) {
            const axiosError = err as { response?: { data?: { error?: string } } };
            message.error(axiosError?.response?.data?.error || "Failed to resume test");
            throw err;
        }
    }, []);

    /**
     * Stop the current test
     */
    const stopTest = useCallback(async () => {
        try {
            await api.post("/api/master-test/stop");
        } catch (err: unknown) {
            const axiosError = err as { response?: { data?: { error?: string } } };
            message.error(axiosError?.response?.data?.error || "Failed to stop test");
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
                // Set awaitingContinuation if EITHER flag is true
                setAwaitingContinuation(
                    res.data.state.awaiting_user_confirmation ||
                    res.data.state.awaiting_test_selection ||
                    false
                );

                // Also set phase completion flags
                setBoundaryDetectionCompleted(res.data.state.boundary_detection_completed || false);
                setTangentialTestCompleted(res.data.state.tangential_test_completed || false);
                setRadialTestCompleted(res.data.state.radial_test_completed || false);
            } else {
                // If orchestrator has no state, don't override awaitingContinuation
                // It might have been set by loadTestHistory from database
                console.log("[useMasterTest] Orchestrator has no state, keeping current UI state");
            }
        } catch (err: unknown) {
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
        tangentialResults,
        radialResults,
        awaitingContinuation,
        status,
        phaseProgress,
        events,
        connected,
        boundaryDetectionCompleted,
        tangentialTestCompleted,
        radialTestCompleted,
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
