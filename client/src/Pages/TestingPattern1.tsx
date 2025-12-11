import { Layout, Button, Space, Tag, Typography, Card, Progress, List, Statistic, Row, Col, Modal, Steps } from "antd";
import { LeftOutlined, CheckCircleOutlined, ClockCircleOutlined, DownloadOutlined } from "@ant-design/icons";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import type { Test } from "../Types/test.ts"
import type { TestDB } from "../Components/testCard.tsx";
import { useMasterTest } from "../Hooks/useMasterTest.tsx";
import { useEffect, useState } from "react";
import { api } from "../Components/apiAxios";

const { Text, Title } = Typography;
const { Header, Content } = Layout;

// Utility function to format phase names to natural language
function formatPhaseName(phase: string | null | undefined): string {
    switch (phase) {
        case 'BOUNDARY_DETECTION': return 'Boundary Detection';
        case 'TANGENTIAL_TEST': return 'Tangential Test';
        case 'RADIAL_TEST': return 'Radial Test';
        case 'COMPLIANCE_TEST': return 'Tangential/Radial Test'; // Legacy
        case 'COMPLETED': return 'Completed';
        default: return 'Not Started';
    }
}

// Utility function to format event types to natural language
function formatEventType(eventType: string): string {
    switch (eventType) {
        case 'test_started': return 'Test Started';
        case 'test_log': return 'Log';
        case 'test_completed': return 'Test Completed';
        case 'test_failed': return 'Test Failed';
        case 'test_paused': return 'Test Paused';
        case 'test_resumed': return 'Test Resumed';
        case 'test_stopped': return 'Test Stopped';
        case 'boundary_found_at_angle': return 'Boundary Found';
        case 'boundary_detection_completed': return 'Boundary Detection Complete';
        case 'tangential_test_started': return 'Tangential Test Started';
        case 'radial_test_started': return 'Radial Test Started';
        case 'phase_completed_awaiting_next': return 'Phase Complete - Awaiting Next';
        case 'compliance_test_started': return 'Tangential/Radial Test Started'; // Legacy
        case 'compliance_measurement_completed': return 'Tangential/Radial Measurement';
        case 'movement_started': return 'Movement Started';
        case 'measurement_completed': return 'Measurement Complete';
        case 'detection': return 'Detection Event';
        case 'phase_progress': return 'Progress Update';
        default: return eventType.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
}

// Format event data to natural language
function formatEventData(event: any): string {
    const data = event.data;

    switch (event.type) {
        case 'test_log':
            return data.message ? String(data.message) : '';

        case 'boundary_found_at_angle':
            if (typeof data.boundary === 'number') {
                return `Angle ${data.angle}°: ${data.boundary.toFixed(2)}m boundary detected`;
            }
            return `Angle ${data.angle}°: No boundary detected`;

        case 'movement_started':
            if (data.angle !== undefined && data.distance !== undefined) {
                const attempt = data.attempt ? ` (attempt ${data.attempt})` : '';
                return `Moving to angle ${data.angle}°, distance ${data.distance}m${attempt}`;
            }
            return 'Robot moving to position';

        case 'measurement_completed':
            if (data.angle !== undefined && data.distance !== undefined) {
                const detected = data.detected ? '✓ Detected' : '✗ No detection';
                const attempt = data.attempt ? ` (attempt ${data.attempt})` : '';
                return `Angle ${data.angle}°, distance ${data.distance}m${attempt}: ${detected}`;
            }
            return 'Measurement completed';

        case 'detection':
            if (data.detected !== undefined) {
                return data.detected ? 'Sensor detected heat source' : 'No detection';
            }
            return 'Detection event';

        case 'compliance_measurement_completed':
            if (data.angle !== undefined && data.distance !== undefined) {
                const detected = data.detected ? '✓ Detected' : '✗ No detection';
                const offset = data.offset_from_boundary ? ` (${data.offset_from_boundary.toFixed(1)}m inside boundary)` : '';
                return `Angle ${data.angle}°, distance ${data.distance}m${offset}: ${detected}`;
            }
            return 'Measurement completed';

        case 'test_started':
            return data.phase ? `Starting ${data.phase.toLowerCase().replace('_', ' ')} phase` : 'Test started';

        case 'tangential_test_started':
        case 'radial_test_started':
            return 'Test phase starting...';

        case 'boundary_detection_completed':
            const results = data.boundary_results?.length || 0;
            return `Completed with ${results} boundary measurements`;

        case 'phase_completed_awaiting_next':
            if (data.completed_phase) {
                return `${data.completed_phase} test complete. Ready to start next phase.`;
            }
            return 'Phase complete. Awaiting user selection for next test.';

        case 'test_completed':
            return 'All test phases completed successfully';

        case 'test_failed':
            return data.error ? `Test failed: ${data.error}` : 'Test failed';

        case 'phase_progress':
            if (data.completed_angles !== undefined && data.total_angles !== undefined) {
                return `Progress: ${data.completed_angles}/${data.total_angles} angles completed`;
            } else if (data.completed_positions !== undefined && data.total_positions !== undefined) {
                return `Progress: ${data.completed_positions}/${data.total_positions} positions completed`;
            }
            return 'Test in progress...';

        default:
            const filteredData = { ...data };
            delete filteredData.test_step_id;
            delete filteredData.timestamp;

            const keys = Object.keys(filteredData);
            if (keys.length === 0) {
                return '';
            }


            return keys.map(key => `${key}: ${filteredData[key]}`).join(', ');
    }
}

// Export utility functions
function downloadCSV(filename: string, csvContent: string) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function downloadJSON(filename: string, data: any) {
    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

type TelemetrySample = {
    telemetry_id?: number;
    test_id?: number;
    ambient_temp?: number;
    humidity?: number;
    head_temp_avg?: number;
    body_temp_avg?: number;
    legs_temp_avg?: number;
    detector_angle?: number;
    robot_position_x?: number;
    robot_position_y?: number;
    detection_active?: boolean;
    timestamp?: string;
};

export default function TestingPattern1() {
    const navigate = useNavigate();
    const { state: locationState } = useLocation();
    const data = locationState as (Test | TestDB & { resuming?: boolean }) | undefined;

    // All hooks must be called before any conditional returns
    const {
        isRunning,
        isPaused,
        currentPhase,
        boundaryResults,
        tangentialResults,
        radialResults,
        awaitingContinuation,
        phaseProgress,
        events,
        connected,
        status,
        boundaryDetectionCompleted,
        tangentialTestCompleted,
        radialTestCompleted,
        startTest,
        startTestPhase,
        loadTestHistory,
        pauseTest,
        resumeTest,
        stopTest,
        fetchState
    } = useMasterTest();

    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [latestTelemetry, setLatestTelemetry] = useState<TelemetrySample | null>(null);

    // Derived state (safe to use data here because hooks are already called)
    const liveStatus = status || data?.status || 'PLANNED';
    const isCompleted = liveStatus === 'COMPLETED';

    // Debug logging
    useEffect(() => {
        console.log("=".repeat(60));
        console.log("📊 [UI] Component State:");
        console.log("=".repeat(60));
        console.log("isRunning:", isRunning);
        console.log("isPaused:", isPaused);
        console.log("isCompleted:", isCompleted);
        console.log("awaitingContinuation:", awaitingContinuation);
        console.log("connected:", connected);
        console.log("status:", liveStatus);
        console.log("data:", data);
        console.log("Button should show:", !isRunning && !isPaused && !awaitingContinuation);
        console.log("Button should be enabled:", !isCompleted);
        console.log("=".repeat(60));
    }, [isRunning, isPaused, isCompleted, awaitingContinuation, connected, liveStatus, data]);

    // Subscribe to telemetry SSE for this test
    useEffect(() => {
        if (!data?.test_id) return;

        const es = new EventSource(`/api/telemetry/stream?testId=${data.test_id}`);

        es.addEventListener("telemetry", (event) => {
            try {
                const payload = JSON.parse((event as MessageEvent).data);
                setLatestTelemetry(payload);
            } catch (err) {
                console.error("[TestingPattern1] Failed to parse telemetry event:", err);
            }
        });

        es.onerror = (err) => {
            console.error("[TestingPattern1] Telemetry SSE error:", err);
        };

        return () => {
            es.close();
        };
    }, [data?.test_id]);

    // Fallback polling to hydrate telemetry if SSE is silent
    useEffect(() => {
        if (!data?.test_id) return;
        let cancelled = false;

        const fetchLatest = async () => {
            try {
                const [teleRes, posRes, envRes, standRes, heatRes] = await Promise.all([
                    api.get(`/api/telemetry/test/${data.test_id}/latest`).catch(() => null),
                    api.get("/api/robot/position").catch(() => null),
                    api.get("/api/environment/reading").catch(() => null),
                    api.get("/api/stand/status").catch(() => null),
                    api.get("/api/heating/status").catch(() => null),
                ]);

                const tele = teleRes?.data || {};
                const pos = posRes?.data?.position || {};
                const env = envRes?.data || {};
                const stand = standRes?.data || {};
                const zones = Array.isArray(heatRes?.data?.zones) ? heatRes?.data?.zones : [];
                const head = zones.find((z: any) => z.zone === "HEAD");
                const body = zones.find((z: any) => z.zone === "BODY");
                const legs = zones.find((z: any) => z.zone === "LEGS");

                if (!cancelled) {
                    setLatestTelemetry(prev => ({
                        ...prev,
                        ...tele,
                        ambient_temp: tele.ambient_temp ?? env.temperature ?? prev?.ambient_temp ?? "N/A",
                        humidity: tele.humidity ?? env.humidity ?? prev?.humidity ?? "N/A",
                        robot_position_x: tele.robot_position_x ?? pos.x ?? prev?.robot_position_x,
                        robot_position_y: tele.robot_position_y ?? pos.y ?? prev?.robot_position_y,
                        detector_angle: tele.detector_angle ?? stand.currentAngle ?? prev?.detector_angle ?? "N/A",
                        head_temp_avg: tele.head_temp_avg ?? head?.currentTemp ?? prev?.head_temp_avg ?? "N/A",
                        body_temp_avg: tele.body_temp_avg ?? body?.currentTemp ?? prev?.body_temp_avg ?? "N/A",
                        legs_temp_avg: tele.legs_temp_avg ?? legs?.currentTemp ?? prev?.legs_temp_avg ?? "N/A",
                        timestamp: tele.timestamp ?? new Date().toISOString(),
                    }));
                }
            } catch (err) {
                // ignore 404 when no telemetry yet
            }
        };

        fetchLatest();
        const interval = setInterval(fetchLatest, 2000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [data?.test_id]);

    // Handle loading test state on mount
    useEffect(() => {
        const loadTestState = async () => {
            if (data?.test_id) {
                // Always load historical data first to show what's been done
                if (data.status && data.status !== 'PLANNED') {
                    await loadTestHistory(data.test_id);
                }

                // Check current orchestrator state
                await fetchState();

                // If orchestrator has no state but database does, restore from database
                // This handles the case where server restarted or orchestrator lost state
                try {
                    const dbStateRes = await api.get(`/api/test/${data.test_id}/state`);
                    if (dbStateRes.data) {
                        // If test is awaiting selection (or was stopped mid-phase), restore orchestrator state
                        // This ensures the buttons work correctly and user can restart/continue
                        if (dbStateRes.data.awaiting_test_selection) {
                            console.log("[TestingPattern1] Test awaiting selection, restoring orchestrator state from database");
                            console.log("[TestingPattern1] Current phase:", dbStateRes.data.current_phase);

                            try {
                                await api.post('/api/master-test/resume-from-database', {
                                    test_id: data.test_id
                                });

                                console.log("[TestingPattern1] Orchestrator state restored, waiting for SSE event");

                                // Wait a bit for SSE event to propagate and modal/buttons to appear
                                await new Promise(resolve => setTimeout(resolve, 1000));

                                // Refresh state to get updated orchestrator state
                                await fetchState();

                                console.log("[TestingPattern1] State refreshed after restore");
                            } catch (err) {
                                console.error("[TestingPattern1] Error restoring state:", err);
                            }
                        }
                    }
                } catch (err: any) {
                    if (err?.response?.status === 404) {
                        console.log("[TestingPattern1] No persisted state yet for this test (404) – skipping restore");
                    } else {
                        console.error("[TestingPattern1] Error checking/restoring state:", err);
                    }
                }
            }
        };

        loadTestState();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data?.test_id]); // fetchState and loadTestHistory are stable from hook

    // Early return after all hooks
    if (!data) return <Navigate to="/controlpanel" replace />;

    const getStatusColor = () => {
        switch (liveStatus) {
            case 'COMPLETED': return 'green';
            case 'IN_PROGRESS': return 'blue';
            case 'ERROR': return 'red';
            case 'PAUSED': return 'orange';
            case 'PLANNED':
            default: return 'default';
        }
    };

    const getStatusDisplay = () => {
        // More descriptive status messages based on current state
        if (liveStatus === 'COMPLETED') return 'All Tests Complete';
        if (liveStatus === 'ERROR') return 'Test Failed';

        if (awaitingContinuation) {
            if (tangentialTestCompleted && radialTestCompleted) {
                return 'All Tests Complete';
            } else if (tangentialTestCompleted) {
                return 'Awaiting Radial Test';
            } else if (radialTestCompleted) {
                return 'Awaiting Tangential Test';
            } else if (boundaryDetectionCompleted) {
                return 'Awaiting Test Selection';
            }
        }

        if (isRunning) {
            if (currentPhase === 'BOUNDARY_DETECTION') return 'Running Boundary Detection';
            if (currentPhase === 'TANGENTIAL_TEST') return 'Running Tangential Test';
            if (currentPhase === 'RADIAL_TEST') return 'Running Radial Test';
            return 'Test In Progress';
        }

        if (isPaused) return 'Paused';
        if (liveStatus === 'PLANNED') return 'Ready to Start';

        return liveStatus;
    };

    const getPhaseDisplay = () => {
        const formattedPhase = formatPhaseName(currentPhase);
        if (currentPhase === 'BOUNDARY_DETECTION') return 'Phase 1: ' + formattedPhase;
        if (currentPhase === 'TANGENTIAL_TEST') return 'Phase 2: Tangential Test';
        if (currentPhase === 'RADIAL_TEST') return 'Phase 3: Radial Test';
        if (currentPhase === 'COMPLETED') return 'Test Completed';
        return formattedPhase;
    };

    const getPhaseColor = () => {
        switch (currentPhase) {
            case 'BOUNDARY_DETECTION': return 'blue';
            case 'TANGENTIAL_TEST': return 'purple';
            case 'RADIAL_TEST': return 'orange';
            case 'COMPLETED': return 'green';
            default: return 'default';
        }
    };

    const handleStart = () => {
        console.log("=".repeat(60));
        console.log("🚀 [UI] START BUTTON CLICKED");
        console.log("=".repeat(60));
        console.log("Test ID:", data.test_id);
        console.log("Sensor ID:", data.sensor_id);
        console.log("Data:", data);

        if (!data.test_id || !data.sensor_id) {
            console.error("❌ Missing test_id or sensor_id!");
            console.log("Test ID:", data.test_id);
            console.log("Sensor ID:", data.sensor_id);
            return;
        }

        console.log("✅ Opening confirmation modal...");
        setConfirmModalOpen(true);
    };

    const handleConfirmStart = async () => {
        console.log("✅ User confirmed - Starting test...");

        if (!data.test_id || !data.sensor_id) {
            console.error("❌ Missing test_id or sensor_id");
            return;
        }

        try {
            console.log("📡 Calling startTest API...");
            await startTest({
                test_id: data.test_id,
                sensor_id: data.sensor_id,
                test_type: 'FULL',

                // Phase 1: Boundary Detection - IEC 63180 compliant
                // 10° increments for full 360° coverage (36 angles total)
                boundary_angles: Array.from({ length: 36 }, (_, i) => i * 10),
                boundary_start_distance: 8.0,  // Start far (outside detection range)
                boundary_end_distance: 1.0,     // Move close
                boundary_step: 0.5,             // 0.5m steps

                // Phase 2: Compliance Test (at 2m and 3m from boundary)
                compliance_test_distances: [2.0, 3.0],
                compliance_tangential_sweep: true,
                compliance_tangential_step: 15,

                // Timing - IEC 63180 compliant
                movement_speed: 50,             // 0.5 m/s
                detection_wait_time: 2000,      // 2 second wait
                repeat_measurements: 2          // 2 attempts per position
            });
            console.log("✅ Test started successfully!");
            setConfirmModalOpen(false);
        } catch (error: unknown) {
            console.error("❌ Failed to start test:", error);
            setConfirmModalOpen(false);

            // Check if test has existing state (axios error type checking)
            const axiosError = error as { response?: { status?: number; data?: { awaiting_test_selection?: boolean; boundary_detection_completed?: boolean; tangential_test_completed?: boolean; radial_test_completed?: boolean } } };
            if (axiosError?.response?.status === 409 && axiosError?.response?.data?.awaiting_test_selection) {
                Modal.warning({
                    title: "Test Already in Progress",
                    content: (
                        <div>
                            <p>This test has already completed boundary detection and is awaiting test selection.</p>
                            <p><strong>Completed phases:</strong></p>
                            <ul>
                                <li>Boundary Detection: {axiosError.response?.data?.boundary_detection_completed ? '✓ Complete' : '○ Pending'}</li>
                                <li>Tangential Test: {axiosError.response?.data?.tangential_test_completed ? '✓ Complete' : '○ Pending'}</li>
                                <li>Radial Test: {axiosError.response?.data?.radial_test_completed ? '✓ Complete' : '○ Pending'}</li>
                            </ul>
                            <p>Please use the "Start Tangential Test" or "Start Radial Test" buttons to continue.</p>
                        </div>
                    ),
                    okText: "Got it"
                });
                // Reload state to show proper buttons
                await fetchState();
                await loadTestHistory(data.test_id);
            }
        }
    };

    const handlePause = async () => {
        console.log("⏸️ Pause button clicked");
        try {
            await pauseTest();
            console.log("✅ Test paused");
        } catch (error) {
            console.error("❌ Failed to pause test:", error);
        }
    };

    const handleResume = async () => {
        console.log("▶️ Resume button clicked");
        try {
            await resumeTest();
            console.log("✅ Test resumed");
        } catch (error) {
            console.error("❌ Failed to resume test:", error);
        }
    };

    const handleStop = async () => {
        console.log("⏹️ Stop button clicked");
        try {
            await stopTest();
            console.log("✅ Test stopped");
        } catch (error) {
            console.error("❌ Failed to stop test:", error);
        }
    };

    const handleStartTangential = async () => {
        console.log("➡️ Start Tangential Test clicked");
        try {
            await startTestPhase('TANGENTIAL', data?.test_id ?? undefined);
            console.log("✅ Starting tangential test");
        } catch (error) {
            console.error("❌ Failed to start tangential test:", error);
        }
    };

    const handleStartRadial = async () => {
        console.log("➡️ Start Radial Test clicked");
        try {
            await startTestPhase('RADIAL', data?.test_id ?? undefined);
            console.log("✅ Starting radial test");
        } catch (error) {
            console.error("❌ Failed to start radial test:", error);
        }
    };

    // Export handlers
    const handleExportBoundaryCSV = () => {
        const csv = [
            'Angle (degrees),Detection Boundary (m),Detected Distance (m),No Detection Distance (m)',
            ...boundaryResults.map(r =>
                `${r.angle},${r.detection_boundary ?? 'N/A'},${r.detected_distance ?? 'N/A'},${r.no_detection_distance ?? 'N/A'}`
            )
        ].join('\n');
        downloadCSV(`${data.test_name}_boundary_results.csv`, csv);
    };

    const handleExportBoundaryJSON = () => {
        downloadJSON(`${data.test_name}_boundary_results.json`, {
            test_name: data.test_name,
            test_id: data.test_id,
            export_date: new Date().toISOString(),
            phase: 'Boundary Detection',
            results: boundaryResults
        });
    };

    const handleExportTangentialCSV = () => {
        const csv = [
            'Angle (degrees),Distance (m),Offset from Boundary (m),Detected',
            ...tangentialResults.map(r =>
                `${r.angle},${r.distance.toFixed(2)},${r.offset_from_boundary?.toFixed(2) ?? 'N/A'},${r.detected ? 'Yes' : 'No'}`
            )
        ].join('\n');
        downloadCSV(`${data.test_name}_tangential_results.csv`, csv);
    };

    const handleExportTangentialJSON = () => {
        downloadJSON(`${data.test_name}_tangential_results.json`, {
            test_name: data.test_name,
            test_id: data.test_id,
            export_date: new Date().toISOString(),
            phase: 'Tangential Test',
            results: tangentialResults
        });
    };

    const handleExportRadialCSV = () => {
        const csv = [
            'Angle (degrees),Distance (m),Offset from Boundary (m),Detected',
            ...radialResults.map(r =>
                `${r.angle},${r.distance.toFixed(2)},${r.offset_from_boundary?.toFixed(2) ?? 'N/A'},${r.detected ? 'Yes' : 'No'}`
            )
        ].join('\n');
        downloadCSV(`${data.test_name}_radial_results.csv`, csv);
    };

    const handleExportRadialJSON = () => {
        downloadJSON(`${data.test_name}_radial_results.json`, {
            test_name: data.test_name,
            test_id: data.test_id,
            export_date: new Date().toISOString(),
            phase: 'Radial Test',
            results: radialResults
        });
    };

    const handleExportAllCSV = () => {
        const csv = [
            '=== BOUNDARY DETECTION RESULTS ===',
            'Angle (degrees),Detection Boundary (m),Detected Distance (m),No Detection Distance (m)',
            ...boundaryResults.map(r =>
                `${r.angle},${r.detection_boundary ?? 'N/A'},${r.detected_distance ?? 'N/A'},${r.no_detection_distance ?? 'N/A'}`
            ),
            '',
            '=== TANGENTIAL TEST RESULTS ===',
            'Angle (degrees),Distance (m),Offset from Boundary (m),Detected',
            ...tangentialResults.map(r =>
                `${r.angle},${r.distance.toFixed(2)},${r.offset_from_boundary?.toFixed(2) ?? 'N/A'},${r.detected ? 'Yes' : 'No'}`
            ),
            '',
            '=== RADIAL TEST RESULTS ===',
            'Angle (degrees),Distance (m),Offset from Boundary (m),Detected',
            ...radialResults.map(r =>
                `${r.angle},${r.distance.toFixed(2)},${r.offset_from_boundary?.toFixed(2) ?? 'N/A'},${r.detected ? 'Yes' : 'No'}`
            )
        ].join('\n');
        downloadCSV(`${data.test_name}_all_results.csv`, csv);
    };

    const handleExportAllJSON = () => {
        downloadJSON(`${data.test_name}_all_results.json`, {
            test_name: data.test_name,
            test_id: data.test_id,
            export_date: new Date().toISOString(),
            boundary_detection: {
                completed: boundaryDetectionCompleted,
                results: boundaryResults
            },
            tangential_test: {
                completed: tangentialTestCompleted,
                results: tangentialResults
            },
            radial_test: {
                completed: radialTestCompleted,
                results: radialResults
            }
        });
    };

    return (
        <Layout>
            <Header
                style={{
                    position: "sticky",
                    top: 0,
                    zIndex: 10,
                    height: 56,
                    background: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingInline: 24,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                }}>
                <div style={{ flex: 1 }}>
                    <Button
                        type="link"
                        icon={<LeftOutlined />}
                        style={{ padding: 0, fontSize: 14 }}
                        onClick={() => navigate(-1)}
                    >
                        Back
                    </Button>
                </div>

                <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)" }}>
                    <Space>
                        <div style={{ background: "#1677ff", color: "#fff", padding: "4px", height: "20px", width: "20px" }} />
                        <Text>RoboControl-X1</Text>
                        <Tag color={getStatusColor()} style={{ borderRadius: "99px" }}>
                            {getStatusDisplay()}
                        </Tag>
                        <Tag color={getPhaseColor()}>
                            {getPhaseDisplay()}
                        </Tag>
                        <Tag color={connected ? "green" : "red"}>
                            {connected ? "●" : "○"} SSE
                        </Tag>
                    </Space>
                </div>

                <div style={{ flex: 1, display: "flex", justifyContent: "right" }}>
                    <Space>
                        {/* Start button only before boundary is done */}
                        {!isRunning && !isPaused && !isCompleted && !boundaryDetectionCompleted && (
                            <Button color="primary" variant="solid" onClick={handleStart}>
                                {boundaryResults.length > 0 ? 'Restart Test' : 'Start Test'}
                            </Button>
                        )}

                        {/* Phase selection buttons once boundary is done (works from history too) */}
                        {!isRunning && !isPaused && boundaryDetectionCompleted && !isCompleted && (
                            <Space>
                                <Button
                                    type="primary"
                                    onClick={handleStartTangential}
                                    disabled={tangentialTestCompleted}
                                >
                                    {tangentialTestCompleted ? 'Tangential Complete' : 'Start Tangential Test'}
                                </Button>
                                <Button
                                    type="primary"
                                    onClick={handleStartRadial}
                                    disabled={radialTestCompleted}
                                >
                                    {radialTestCompleted ? 'Radial Complete' : 'Start Radial Test'}
                                </Button>
                                {tangentialTestCompleted && (
                                    <Button
                                        type="default"
                                        disabled
                                        icon={<CheckCircleOutlined />}
                                        style={{ color: 'green', borderColor: 'green' }}
                                    >
                                        ✓ Tangential Complete
                                    </Button>
                                )}
                                {radialTestCompleted && (
                                    <Button
                                        type="default"
                                        disabled
                                        icon={<CheckCircleOutlined />}
                                        style={{ color: 'green', borderColor: 'green' }}
                                    >
                                        ✓ Radial Complete
                                    </Button>
                                )}
                            </Space>
                        )}

                        {/* Show pause/stop during active test execution */}
                        {isRunning && !isPaused && (
                            <>
                                <Button color="orange" variant="solid" onClick={handlePause}>
                                    Pause
                                </Button>
                                <Button color="red" variant="solid" onClick={handleStop}>
                                    Stop
                                </Button>
                            </>
                        )}

                        {/* Show resume/stop when test is paused (but not awaiting continuation) */}
                        {isPaused && !awaitingContinuation && (
                            <>
                                <Button color="primary" variant="solid" onClick={handleResume}>
                                    Resume
                                </Button>
                                <Button color="red" variant="solid" onClick={handleStop}>
                                    Stop
                                </Button>
                            </>
                        )}
                    </Space>
                </div>
            </Header>

            <Content style={{ height: '100vh', padding: 24, background: '#f5f5f5', overflow: 'auto' }}>
                <div style={{ textAlign: "center", marginBottom: 24 }}>
                    <Title level={2}>{data.test_name}</Title>
                    <Text>Two-phase boundary detection and tangential/radial testing</Text>
                </div>

                {/* Phase Timeline */}
                <Card style={{ marginBottom: 16 }} title="Test Progress Timeline">
                    <Steps
                        current={
                            currentPhase === 'COMPLETED' ? 3 :
                            (radialTestCompleted || currentPhase === 'RADIAL_TEST') ? 2 :
                            (tangentialTestCompleted || currentPhase === 'TANGENTIAL_TEST') ? 2 :
                            (boundaryDetectionCompleted || currentPhase === 'BOUNDARY_DETECTION') ? 1 :
                            0
                        }
                        status={
                            status === 'ERROR' ? 'error' :
                            status === 'IN_PROGRESS' ? 'process' :
                            currentPhase === 'COMPLETED' ? 'finish' :
                            'process'
                        }
                        items={[
                            {
                                title: 'Boundary Detection',
                                description: boundaryDetectionCompleted ? `${boundaryResults.length}/36 angles` : 'Pending',
                                icon: boundaryDetectionCompleted ? <CheckCircleOutlined /> : undefined,
                                status: boundaryDetectionCompleted ? 'finish' :
                                        currentPhase === 'BOUNDARY_DETECTION' ? 'process' : 'wait'
                            },
                            {
                                title: 'Tangential Test',
                                description: tangentialTestCompleted ? `${tangentialResults.length} measurements` :
                                            currentPhase === 'TANGENTIAL_TEST' && tangentialResults.length > 0 ? `${tangentialResults.length} measurements` :
                                            'Pending',
                                icon: tangentialTestCompleted ? <CheckCircleOutlined /> :
                                      currentPhase === 'TANGENTIAL_TEST' ? <ClockCircleOutlined /> : undefined,
                                status: tangentialTestCompleted ? 'finish' :
                                        currentPhase === 'TANGENTIAL_TEST' ? 'process' : 'wait'
                            },
                            {
                                title: 'Radial Test',
                                description: radialTestCompleted ? `${radialResults.length} measurements` :
                                            currentPhase === 'RADIAL_TEST' && radialResults.length > 0 ? `${radialResults.length} measurements` :
                                            'Pending',
                                icon: radialTestCompleted ? <CheckCircleOutlined /> :
                                      currentPhase === 'RADIAL_TEST' ? <ClockCircleOutlined /> : undefined,
                                status: radialTestCompleted ? 'finish' :
                                        currentPhase === 'RADIAL_TEST' ? 'process' : 'wait'
                            }
                        ]}
                    />
                </Card>

                {/* Test Summary */}
                <Card
                    title="Test Summary"
                    style={{ marginBottom: 16 }}
                    extra={
                        (boundaryResults.length > 0 || tangentialResults.length > 0 || radialResults.length > 0) && (
                            <Space>
                                <Button
                                    size="small"
                                    icon={<DownloadOutlined />}
                                    onClick={handleExportAllCSV}
                                >
                                    Export CSV
                                </Button>
                                <Button
                                    size="small"
                                    icon={<DownloadOutlined />}
                                    onClick={handleExportAllJSON}
                                >
                                    Export JSON
                                </Button>
                            </Space>
                        )
                    }
                >
                    <Row gutter={16}>
                        <Col xs={24} sm={8}>
                            <Statistic
                                title="Boundary Detection"
                                value={boundaryDetectionCompleted ? "Complete" : boundaryResults.length > 0 ? "In Progress" : "Pending"}
                                prefix={boundaryDetectionCompleted ? <CheckCircleOutlined style={{ color: 'green' }} /> : null}
                                valueStyle={{
                                    color: boundaryDetectionCompleted ? 'green' :
                                           boundaryResults.length > 0 ? 'blue' : 'gray',
                                    fontSize: 16
                                }}
                            />
                            {boundaryResults.length > 0 && (
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    {boundaryResults.filter(r => r.detection_boundary !== null).length}/{boundaryResults.length} detected
                                </Text>
                            )}
                        </Col>
                        <Col xs={24} sm={8}>
                            <Statistic
                                title="Tangential Test"
                                value={tangentialTestCompleted ? "Complete" : tangentialResults.length > 0 ? "In Progress" : "Pending"}
                                prefix={tangentialTestCompleted ? <CheckCircleOutlined style={{ color: 'green' }} /> : null}
                                valueStyle={{
                                    color: tangentialTestCompleted ? 'green' :
                                           tangentialResults.length > 0 ? 'blue' : 'gray',
                                    fontSize: 16
                                }}
                            />
                            {tangentialResults.length > 0 && (
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    {tangentialResults.filter(r => r.detected).length}/{tangentialResults.length} detected
                                </Text>
                            )}
                        </Col>
                        <Col xs={24} sm={8}>
                            <Statistic
                                title="Radial Test"
                                value={radialTestCompleted ? "Complete" : radialResults.length > 0 ? "In Progress" : "Pending"}
                                prefix={radialTestCompleted ? <CheckCircleOutlined style={{ color: 'green' }} /> : null}
                                valueStyle={{
                                    color: radialTestCompleted ? 'green' :
                                           radialResults.length > 0 ? 'blue' : 'gray',
                                    fontSize: 16
                                }}
                            />
                            {radialResults.length > 0 && (
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    {radialResults.filter(r => r.detected).length}/{radialResults.length} detected
                                </Text>
                            )}
                        </Col>
                    </Row>
                </Card>

                {/* Test Statistics and Insights */}
                {(boundaryDetectionCompleted || tangentialTestCompleted || radialTestCompleted) && (
                    <Card title="Test Statistics" style={{ marginBottom: 16 }}>
                        <Row gutter={16}>
                            {boundaryDetectionCompleted && (
                                <>
                                    <Col xs={12} sm={6}>
                                        <Statistic
                                            title="Boundary Detection Rate"
                                            value={(boundaryResults.filter(r => r.detection_boundary !== null).length / boundaryResults.length * 100).toFixed(1)}
                                            suffix="%"
                                            valueStyle={{ fontSize: 16, color: '#1677ff' }}
                                        />
                                    </Col>
                                    <Col xs={12} sm={6}>
                                        <Statistic
                                            title="Avg Boundary Distance"
                                            value={
                                                boundaryResults.filter(r => r.detection_boundary !== null).length > 0
                                                    ? (boundaryResults
                                                        .filter(r => r.detection_boundary !== null)
                                                        .reduce((sum, r) => sum + (r.detection_boundary || 0), 0) /
                                                        boundaryResults.filter(r => r.detection_boundary !== null).length).toFixed(2)
                                                    : 'N/A'
                                            }
                                            suffix={boundaryResults.filter(r => r.detection_boundary !== null).length > 0 ? 'm' : ''}
                                            valueStyle={{ fontSize: 16, color: '#1677ff' }}
                                        />
                                    </Col>
                                </>
                            )}
                            {tangentialTestCompleted && tangentialResults.length > 0 && (
                                <Col xs={12} sm={6}>
                                    <Statistic
                                        title="Tangential Detection Rate"
                                        value={(tangentialResults.filter(r => r.detected).length / tangentialResults.length * 100).toFixed(1)}
                                        suffix="%"
                                        valueStyle={{ fontSize: 16, color: '#722ed1' }}
                                    />
                                </Col>
                            )}
                            {radialTestCompleted && radialResults.length > 0 && (
                                <Col xs={12} sm={6}>
                                    <Statistic
                                        title="Radial Detection Rate"
                                        value={(radialResults.filter(r => r.detected).length / radialResults.length * 100).toFixed(1)}
                                        suffix="%"
                                        valueStyle={{ fontSize: 16, color: '#fa8c16' }}
                                    />
                                </Col>
                            )}
                        </Row>
                    </Card>
                )}

                {/* Visual Boundary Map */}
                {boundaryResults.length > 0 && (
                    <Card title="Boundary Detection Map" style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
                            <div style={{ position: 'relative', width: '400px', height: '400px' }}>
                                {/* Background circles (distance markers) */}
                                {[2, 4, 6, 8].map(distance => (
                                    <div
                                        key={distance}
                                        style={{
                                            position: 'absolute',
                                            top: '50%',
                                            left: '50%',
                                            transform: 'translate(-50%, -50%)',
                                            width: `${distance * 50}px`,
                                            height: `${distance * 50}px`,
                                            border: '1px solid #e0e0e0',
                                            borderRadius: '50%'
                                        }}
                                    />
                                ))}

                                {/* Distance labels */}
                                {[2, 4, 6, 8].map(distance => (
                                    <div
                                        key={`label-${distance}`}
                                        style={{
                                            position: 'absolute',
                                            top: '50%',
                                            left: `calc(50% + ${distance * 25}px)`,
                                            transform: 'translateY(-50%)',
                                            fontSize: '10px',
                                            color: '#999'
                                        }}
                                    >
                                        {distance}m
                                    </div>
                                ))}

                                {/* Center point */}
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: '50%',
                                        left: '50%',
                                        transform: 'translate(-50%, -50%)',
                                        width: '10px',
                                        height: '10px',
                                        background: '#1677ff',
                                        borderRadius: '50%',
                                        zIndex: 10
                                    }}
                                />

                                {/* Boundary points */}
                                {boundaryResults.map((result, idx) => {
                                    if (result.detection_boundary === null) return null;

                                    const angleRad = (result.angle * Math.PI) / 180;
                                    const distance = result.detection_boundary;
                                    // Scale: 50px per meter, max 8 meters
                                    const radius = Math.min(distance * 50, 200);
                                    const x = radius * Math.sin(angleRad);
                                    const y = -radius * Math.cos(angleRad); // Negative because CSS y-axis is inverted

                                    return (
                                        <div
                                            key={idx}
                                            style={{
                                                position: 'absolute',
                                                top: `calc(50% + ${y}px)`,
                                                left: `calc(50% + ${x}px)`,
                                                transform: 'translate(-50%, -50%)',
                                                width: '8px',
                                                height: '8px',
                                                background: '#52c41a',
                                                borderRadius: '50%',
                                                border: '1px solid #389e0d',
                                                zIndex: 5
                                            }}
                                            title={`${result.angle}°: ${result.detection_boundary.toFixed(2)}m`}
                                        />
                                    );
                                })}

                                {/* Angle markers (0°, 90°, 180°, 270°) */}
                                <div style={{ position: 'absolute', top: '5px', left: '50%', transform: 'translateX(-50%)', fontSize: '12px', fontWeight: 'bold' }}>
                                    0°
                                </div>
                                <div style={{ position: 'absolute', right: '5px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', fontWeight: 'bold' }}>
                                    90°
                                </div>
                                <div style={{ position: 'absolute', bottom: '5px', left: '50%', transform: 'translateX(-50%)', fontSize: '12px', fontWeight: 'bold' }}>
                                    180°
                                </div>
                                <div style={{ position: 'absolute', left: '5px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', fontWeight: 'bold' }}>
                                    270°
                                </div>
                            </div>
                        </div>
                        <div style={{ textAlign: 'center', marginTop: '10px' }}>
                            <Text type="secondary">
                                Green dots represent detected boundaries at each angle.
                            </Text>
                        </div>
                    </Card>
                )}

                {/* Live Telemetry Snapshot */}
                <Card title="Live Telemetry" style={{ marginBottom: 16 }}>
                    <Row gutter={16}>
                        <Col xs={24} sm={12} md={6}>
                            <Statistic
                                title="Ambient Temp"
                                value={latestTelemetry?.ambient_temp ?? 'N/A'}
                                suffix={latestTelemetry?.ambient_temp !== undefined ? '°C' : ''}
                            />
                            <Statistic
                                title="Humidity"
                                value={latestTelemetry?.humidity ?? 'N/A'}
                                suffix={latestTelemetry?.humidity !== undefined ? '%' : ''}
                            />
                        </Col>
                        <Col xs={24} sm={12} md={6}>
                            <Statistic
                                title="Head Temp"
                                value={latestTelemetry?.head_temp_avg ?? 'N/A'}
                                suffix={latestTelemetry?.head_temp_avg !== undefined ? '°C' : ''}
                            />
                            <Statistic
                                title="Body Temp"
                                value={latestTelemetry?.body_temp_avg ?? 'N/A'}
                                suffix={latestTelemetry?.body_temp_avg !== undefined ? '°C' : ''}
                            />
                            <Statistic
                                title="Legs Temp"
                                value={latestTelemetry?.legs_temp_avg ?? 'N/A'}
                                suffix={latestTelemetry?.legs_temp_avg !== undefined ? '°C' : ''}
                            />
                        </Col>
                        <Col xs={24} sm={12} md={6}>
                            <Statistic
                                title="Detector Angle"
                                value={latestTelemetry?.detector_angle ?? 'N/A'}
                                suffix={latestTelemetry?.detector_angle !== undefined ? '°' : ''}
                            />
                            <Statistic
                                title="Detection"
                                value={latestTelemetry?.detection_active ? 'Active' : 'Idle'}
                                valueStyle={{ color: latestTelemetry?.detection_active ? '#52c41a' : undefined }}
                            />
                        </Col>
                        <Col xs={24} sm={12} md={6}>
                            <Statistic
                                title="Robot X"
                                value={latestTelemetry?.robot_position_x ?? 'N/A'}
                                suffix={latestTelemetry?.robot_position_x !== undefined ? 'm' : ''}
                            />
                            <Statistic
                                title="Robot Y"
                                value={latestTelemetry?.robot_position_y ?? 'N/A'}
                                suffix={latestTelemetry?.robot_position_y !== undefined ? 'm' : ''}
                            />
                            <Text type="secondary" style={{ fontSize: 12 }}>
                                {latestTelemetry?.timestamp
                                    ? `Updated ${new Date(latestTelemetry.timestamp).toLocaleTimeString()}`
                                    : 'Waiting for telemetry...'}
                            </Text>
                        </Col>
                    </Row>
                </Card>

                {/* Phase Progress */}
                {phaseProgress && (
                    <Card style={{ marginBottom: 16 }}>
                        <Row gutter={16}>
                            <Col span={12}>
                                <Statistic
                                    title="Current Phase"
                                    value={formatPhaseName(phaseProgress.phase)}
                                    valueStyle={{ fontSize: 18 }}
                                />
                            </Col>
                            {phaseProgress.total_angles && (
                                <Col span={12}>
                                    <Statistic
                                        title="Angles Completed"
                                        value={phaseProgress.completed_angles}
                                        suffix={`/ ${phaseProgress.total_angles}`}
                                    />
                                </Col>
                            )}
                            {phaseProgress.total_positions && (
                                <Col span={12}>
                                    <Statistic
                                        title="Positions Completed"
                                        value={phaseProgress.completed_positions}
                                        suffix={`/ ${phaseProgress.total_positions}`}
                                    />
                                </Col>
                            )}
                        </Row>
                        <Progress
                            percent={
                                phaseProgress.total_angles && phaseProgress.completed_angles !== undefined
                                    ? Math.round((phaseProgress.completed_angles / phaseProgress.total_angles) * 100)
                                    : phaseProgress.total_positions && phaseProgress.completed_positions !== undefined
                                        ? Math.round((phaseProgress.completed_positions / phaseProgress.total_positions) * 100)
                                        : 0
                            }
                            status={isPaused ? "exception" : "active"}
                            style={{ marginTop: 16 }}
                        />
                    </Card>
                )}

                {/* Boundary Results */}
                {boundaryResults.length > 0 && (
                    <Card
                        title={`Boundary Detection Results (${boundaryResults.length}/36 angles)`}
                        style={{ marginBottom: 16 }}
                        extra={
                            <Space>
                                <Text type="secondary">
                                    {boundaryResults.filter(r => r.detection_boundary !== null).length} detected
                                </Text>
                                <Button
                                    size="small"
                                    icon={<DownloadOutlined />}
                                    onClick={handleExportBoundaryCSV}
                                >
                                    CSV
                                </Button>
                                <Button
                                    size="small"
                                    icon={<DownloadOutlined />}
                                    onClick={handleExportBoundaryJSON}
                                >
                                    JSON
                                </Button>
                            </Space>
                        }
                    >
                        <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                            <List
                                size="small"
                                grid={{ gutter: 8, xs: 2, sm: 3, md: 4, lg: 6, xl: 6 }}
                                dataSource={boundaryResults}
                                renderItem={(result) => (
                                    <List.Item>
                                        <Card
                                            size="small"
                                            style={{
                                                background: result.detection_boundary ? '#f6ffed' : '#fff2e8',
                                                border: result.detection_boundary ? '1px solid #b7eb8f' : '1px solid #ffd591'
                                            }}
                                        >
                                            <Statistic
                                                title={`${result.angle}°`}
                                                value={result.detection_boundary?.toFixed(2) || 'N/A'}
                                                suffix="m"
                                                prefix={result.detection_boundary ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : null}
                                                valueStyle={{ fontSize: 14 }}
                                            />
                                        </Card>
                                    </List.Item>
                                )}
                            />
                        </div>
                    </Card>
                )}

                {/* Tangential Test Results */}
                {tangentialResults.length > 0 && (
                    <Card
                        title={`Tangential Test Results (${tangentialResults.length} measurements)`}
                        style={{ marginBottom: 16 }}
                        extra={
                            <Space>
                                <Text type="secondary">
                                    {tangentialResults.filter(r => r.detected).length} detected
                                </Text>
                                <Button
                                    size="small"
                                    icon={<DownloadOutlined />}
                                    onClick={handleExportTangentialCSV}
                                >
                                    CSV
                                </Button>
                                <Button
                                    size="small"
                                    icon={<DownloadOutlined />}
                                    onClick={handleExportTangentialJSON}
                                >
                                    JSON
                                </Button>
                            </Space>
                        }
                    >
                        <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                            <List
                                size="small"
                                grid={{ gutter: 8, xs: 2, sm: 3, md: 4, lg: 6, xl: 6 }}
                                dataSource={tangentialResults}
                                renderItem={(result) => (
                                    <List.Item>
                                        <Card
                                            size="small"
                                            style={{
                                                background: result.detected ? '#f6ffed' : '#fff2e8',
                                                border: result.detected ? '1px solid #b7eb8f' : '1px solid #ffd591'
                                            }}
                                        >
                                            <Statistic
                                                title={`${result.angle}°`}
                                                value={result.distance.toFixed(2)}
                                                suffix="m"
                                                prefix={result.detected ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : null}
                                                valueStyle={{ fontSize: 14 }}
                                            />
                                            {result.offset_from_boundary !== undefined && (
                                                <Text type="secondary" style={{ fontSize: 11 }}>
                                                    {result.offset_from_boundary.toFixed(1)}m inside boundary
                                                </Text>
                                            )}
                                        </Card>
                                    </List.Item>
                                )}
                            />
                        </div>
                    </Card>
                )}

                {/* Radial Test Results */}
                {radialResults.length > 0 && (
                    <Card
                        title={`Radial Test Results (${radialResults.length} measurements)`}
                        style={{ marginBottom: 16 }}
                        extra={
                            <Space>
                                <Text type="secondary">
                                    {radialResults.filter(r => r.detected).length} detected
                                </Text>
                                <Button
                                    size="small"
                                    icon={<DownloadOutlined />}
                                    onClick={handleExportRadialCSV}
                                >
                                    CSV
                                </Button>
                                <Button
                                    size="small"
                                    icon={<DownloadOutlined />}
                                    onClick={handleExportRadialJSON}
                                >
                                    JSON
                                </Button>
                            </Space>
                        }
                    >
                        <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                            <List
                                size="small"
                                grid={{ gutter: 8, xs: 2, sm: 3, md: 4, lg: 6, xl: 6 }}
                                dataSource={radialResults}
                                renderItem={(result) => (
                                    <List.Item>
                                        <Card
                                            size="small"
                                            style={{
                                                background: result.detected ? '#f6ffed' : '#fff2e8',
                                                border: result.detected ? '1px solid #b7eb8f' : '1px solid #ffd591'
                                            }}
                                        >
                                            <Statistic
                                                title={`${result.angle}°`}
                                                value={result.distance.toFixed(2)}
                                                suffix="m"
                                                prefix={result.detected ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : null}
                                                valueStyle={{ fontSize: 14 }}
                                            />
                                            {result.offset_from_boundary !== undefined && (
                                                <Text type="secondary" style={{ fontSize: 11 }}>
                                                    {result.offset_from_boundary.toFixed(1)}m inside boundary
                                                </Text>
                                            )}
                                        </Card>
                                    </List.Item>
                                )}
                            />
                        </div>
                    </Card>
                )}

                {/* Event Log */}
                <Card title="Event Log" extra={<Text type="secondary">{events.length} events</Text>}>
                    <List
                        size="small"
                        style={{ maxHeight: '400px', overflow: 'auto' }}
                        dataSource={[...events].reverse().slice(0, 100)}
                        renderItem={(event) => (
                            <List.Item style={{ padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%' }}>
                                    <Text type="secondary" style={{ fontSize: 11, fontFamily: 'monospace', minWidth: 70, flexShrink: 0 }}>
                                        {new Date(event.timestamp).toLocaleTimeString()}
                                    </Text>
                                    <Tag
                                        style={{ margin: 0, minWidth: 140, maxWidth: 140, textAlign: 'center', flexShrink: 0 }}
                                        color={
                                            event.type === 'test_log' ? 'blue' :
                                                event.type.includes('completed') ? 'green' :
                                                    event.type.includes('failed') || event.type.includes('error') ? 'red' :
                                                        event.type.includes('started') ? 'cyan' :
                                                            event.type.includes('boundary_found') ? 'purple' :
                                                                event.type.includes('movement') ? 'orange' :
                                                                    'default'
                                        }>
                                        {formatEventType(event.type)}
                                    </Tag>
                                    <Text style={{ fontSize: 12, flex: 1 }}>
                                        {formatEventData(event)}
                                    </Text>
                                </div>
                            </List.Item>
                        )}
                    />
                </Card>
            </Content>

            {/* Start Test Confirmation Modal */}
            <Modal
                open={confirmModalOpen}
                title="Start Test?"
                onCancel={() => setConfirmModalOpen(false)}
                onOk={handleConfirmStart}
                okText="Start Test"
                cancelText="Cancel"
                width={500}
            >
                <div>
                    <p><strong>Test:</strong> {data.test_name}</p>
                    <p><strong>Type:</strong> Full Boundary Detection & Tangential/Radial Test (IEC 63180)</p>
                    <p><strong>Phases:</strong></p>
                    <ul style={{ marginLeft: 20 }}>
                        <li>Phase 1: Boundary Detection (36 angles, 10° increments)</li>
                        <li>Phase 2: Tangential/Radial Testing</li>
                    </ul>
                    <p><strong>Test Parameters:</strong></p>
                    <ul style={{ marginLeft: 20 }}>
                        <li>Movement speed: 0.5 m/s</li>
                        <li>Distance range: 1.0m - 8.0m (0.5m steps)</li>
                        <li>Repeat measurements: 2 per position</li>
                    </ul>
                    <p style={{ marginTop: 16, color: '#faad14' }}>
                        ⚠️ Make sure the robot and sensor are ready before starting!
                    </p>
                </div>
            </Modal>
        </Layout>
    );
}
