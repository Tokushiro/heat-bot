import { Layout, Button, Space, Tag, Typography, Card, Progress, List, Statistic, Row, Col, Modal } from "antd";
import { LeftOutlined, CheckCircleOutlined } from "@ant-design/icons";
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

// Format event data to natural language (no JSON, no test_step_id)
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
                const offset = data.offset_from_boundary ? ` (+${data.offset_from_boundary.toFixed(1)}m from boundary)` : '';
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
            // For any unhandled events, only show if there's meaningful data (excluding test_step_id)
            const filteredData = { ...data };
            delete filteredData.test_step_id;
            delete filteredData.timestamp;

            const keys = Object.keys(filteredData);
            if (keys.length === 0) {
                return '';
            }

            // Format remaining data in a readable way
            return keys.map(key => `${key}: ${filteredData[key]}`).join(', ');
    }
}

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
                } catch (err) {
                    console.error("[TestingPattern1] Error checking/restoring state:", err);
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
        switch (liveStatus) {
            case 'IN_PROGRESS': return 'In Progress';
            case 'COMPLETED': return 'Completed';
            case 'ERROR': return 'Error';
            case 'PAUSED': return 'Paused';
            case 'PLANNED':
            default: return 'Planned';
        }
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
            await startTestPhase('TANGENTIAL');
            console.log("✅ Starting tangential test");
        } catch (error) {
            console.error("❌ Failed to start tangential test:", error);
        }
    };

    const handleStartRadial = async () => {
        console.log("➡️ Start Radial Test clicked");
        try {
            await startTestPhase('RADIAL');
            console.log("✅ Starting radial test");
        } catch (error) {
            console.error("❌ Failed to start radial test:", error);
        }
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
                        {!isRunning && !isPaused && !awaitingContinuation && (
                            <Button color="primary" variant="solid" onClick={handleStart} disabled={isCompleted}>
                                Start Test
                            </Button>
                        )}
                        {awaitingContinuation && (
                            <Space>
                                <Button
                                    type="primary"
                                    onClick={handleStartTangential}
                                    disabled={tangentialTestCompleted}
                                    icon={tangentialTestCompleted ? <CheckCircleOutlined /> : undefined}
                                >
                                    {tangentialTestCompleted ? '✓ Tangential Complete' : 'Start Tangential Test'}
                                </Button>
                                <Button
                                    type="primary"
                                    onClick={handleStartRadial}
                                    disabled={radialTestCompleted}
                                    icon={radialTestCompleted ? <CheckCircleOutlined /> : undefined}
                                >
                                    {radialTestCompleted ? '✓ Radial Complete' : 'Start Radial Test'}
                                </Button>
                            </Space>
                        )}
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
                            <Text type="secondary">
                                {boundaryResults.filter(r => r.detection_boundary !== null).length} detected
                            </Text>
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
                            <Text type="secondary">
                                {tangentialResults.filter(r => r.detected).length} detected
                            </Text>
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
                                                    +{result.offset_from_boundary.toFixed(1)}m from boundary
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
                            <Text type="secondary">
                                {radialResults.filter(r => r.detected).length} detected
                            </Text>
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
                                                    +{result.offset_from_boundary.toFixed(1)}m from boundary
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
