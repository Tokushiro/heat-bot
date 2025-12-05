import { Layout, Button, Space, Tag, Typography, Card, Progress, List, Statistic, Row, Col, Modal } from "antd";
import { LeftOutlined, CheckCircleOutlined } from "@ant-design/icons";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import type { Test } from "../Types/test.ts"
import type { TestDB } from "../Components/testCard.tsx";
import { useMasterTest } from "../Hooks/useMasterTest.tsx";
import { useEffect, useState } from "react";

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

export default function TestingPattern1() {
    const navigate = useNavigate();
    const { state: locationState } = useLocation();
    const data = locationState as (Test | TestDB & { resuming?: boolean }) | undefined;

    if (!data) return <Navigate to="/controlpanel" replace />;

    const {
        isRunning,
        isPaused,
        currentPhase,
        boundaryResults,
        awaitingContinuation,
        phaseProgress,
        events,
        connected,
        status,
        startTest,
        continueToCompliance,
        resumeFromState,
        loadTestHistory,
        pauseTest,
        resumeTest,
        stopTest
    } = useMasterTest();

    const liveStatus = status || data.status || 'PLANNED';
    const isCompleted = liveStatus === 'COMPLETED';
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);

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

    // Handle resuming from history or loading historical data
    useEffect(() => {
        if (data.test_id) {
            if ('resuming' in data && data.resuming) {
                // Resume the test execution
                resumeFromState(data.test_id);
            } else if (data.status && data.status !== 'PLANNED') {
                // Just viewing - load historical data
                loadTestHistory(data.test_id);
            }
        }
    }, []);

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
        if (currentPhase === 'COMPLIANCE_TEST') return 'Phase 2: Tangential/Radial Test'; // Legacy
        if (currentPhase === 'COMPLETED') return 'Test Completed';
        return formattedPhase;
    };

    const getPhaseColor = () => {
        switch (currentPhase) {
            case 'BOUNDARY_DETECTION': return 'blue';
            case 'TANGENTIAL_TEST': return 'purple';
            case 'RADIAL_TEST': return 'orange';
            case 'COMPLIANCE_TEST': return 'purple'; // Legacy
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
        } catch (error) {
            console.error("❌ Failed to start test:", error);
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

    const handleContinue = async () => {
        console.log("➡️ Continue button clicked");
        try {
            await continueToCompliance();
            console.log("✅ Continuing to compliance test");
        } catch (error) {
            console.error("❌ Failed to continue:", error);
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
                            <Button type="primary" onClick={handleContinue}>
                                Continue to Tangential/Radial Test
                            </Button>
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
                                phaseProgress.total_angles
                                    ? Math.round((phaseProgress.completed_angles / phaseProgress.total_angles) * 100)
                                    : phaseProgress.total_positions
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
                                        {event.type === 'test_log' && event.data.message
                                            ? event.data.message
                                            : event.type === 'boundary_found_at_angle' && event.data.boundary
                                                ? `Angle ${event.data.angle}°: ${event.data.boundary.toFixed(2)}m boundary detected`
                                                : event.type === 'movement_started' && event.data.angle !== undefined
                                                    ? `Moving to angle ${event.data.angle}°, distance ${event.data.distance}m (attempt ${event.data.attempt})`
                                                    : JSON.stringify(event.data).length > 2
                                                        ? JSON.stringify(event.data).slice(0, 150) + (JSON.stringify(event.data).length > 150 ? '...' : '')
                                                        : ''}
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
