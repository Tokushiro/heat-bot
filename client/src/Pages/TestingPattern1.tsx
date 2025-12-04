import { Layout, Button, Space, Tag, Typography, Card, Progress, List, Statistic, Row, Col } from "antd";
import { LeftOutlined, CheckCircleOutlined } from "@ant-design/icons";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import type { Test } from "../Types/test.ts"
import type { TestDB } from "../Components/testCard.tsx";
import { useMasterTest } from "../Hooks/useMasterTest";
import { useEffect } from "react";

const { Text, Title } = Typography;
const { Header, Content } = Layout;

export default function TestingPattern1() {
    const navigate = useNavigate();
    const { state: locationState } = useLocation();
    const data = locationState as (Test | TestDB & { resuming?: boolean }) | undefined;

    if (!data) return <Navigate to="/controlpanel" replace />;

    const {
        isRunning,
        currentPhase,
        boundaryResults,
        awaitingContinuation,
        phaseProgress,
        events,
        connected,
        startTest,
        continueToCompliance,
        resumeFromState,
        pauseTest,
        resumeTest,
        stopTest
    } = useMasterTest();

    const status = data.status ?? 'PLANNED';
    const isCompleted = status === 'COMPLETED';
    const isInProgress = status === 'IN_PROGRESS';
    const isPaused = status === 'PAUSED';

    // Handle resuming from history
    useEffect(() => {
        if (data.resuming && data.test_id) {
            resumeFromState(data.test_id);
        }
    }, []);

    const getStatusColor = () => {
        switch (status) {
            case 'COMPLETED': return 'green';
            case 'IN_PROGRESS': return 'blue';
            case 'ERROR': return 'red';
            case 'PAUSED': return 'orange';
            case 'PLANNED':
            default: return 'default';
        }
    };

    const getStatusDisplay = () => {
        switch (status) {
            case 'IN_PROGRESS': return 'In Progress';
            case 'COMPLETED': return 'Completed';
            case 'ERROR': return 'Error';
            case 'PAUSED': return 'Paused';
            case 'PLANNED':
            default: return 'Planned';
        }
    };

    const getPhaseDisplay = () => {
        switch (currentPhase) {
            case 'BOUNDARY_DETECTION': return 'Phase 1: Boundary Detection';
            case 'COMPLIANCE_TEST': return 'Phase 2: Compliance Test';
            case 'COMPLETED': return 'Test Completed';
            default: return 'Not Started';
        }
    };

    const getPhaseColor = () => {
        switch (currentPhase) {
            case 'BOUNDARY_DETECTION': return 'blue';
            case 'COMPLIANCE_TEST': return 'purple';
            case 'COMPLETED': return 'green';
            default: return 'default';
        }
    };

    const handleStart = async () => {
        if (!data.test_id || !data.sensor_id) return;

        try {
            await startTest({
                test_id: data.test_id,
                sensor_id: data.sensor_id,
                test_type: 'FULL',

                // Phase 1: Boundary Detection
                boundary_angles: [0, 45, 90, 135, 180, 225, 270, 315],
                boundary_start_distance: 8.0,  // Start far
                boundary_end_distance: 1.0,     // Move close
                boundary_step: 0.5,

                // Phase 2: Compliance Test (at 2m and 3m from boundary)
                compliance_test_distances: [2.0, 3.0],
                compliance_tangential_sweep: true,
                compliance_tangential_step: 15,

                // Timing
                movement_speed: 50,
                detection_wait_time: 2000,
                repeat_measurements: 2
            });
        } catch (error) {
            console.error("Failed to start test:", error);
        }
    };

    const handlePause = async () => {
        try {
            await pauseTest();
        } catch (error) {
            console.error("Failed to pause test:", error);
        }
    };

    const handleResume = async () => {
        try {
            await resumeTest();
        } catch (error) {
            console.error("Failed to resume test:", error);
        }
    };

    const handleStop = async () => {
        try {
            await stopTest();
        } catch (error) {
            console.error("Failed to stop test:", error);
        }
    };

    const handleContinue = async () => {
        try {
            await continueToCompliance();
        } catch (error) {
            console.error("Failed to continue:", error);
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
                                Continue to Compliance Test
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
                    <Text>Two-phase boundary detection and compliance testing</Text>
                </div>

                {/* Phase Progress */}
                {phaseProgress && (
                    <Card style={{ marginBottom: 16 }}>
                        <Row gutter={16}>
                            <Col span={12}>
                                <Statistic
                                    title="Current Phase"
                                    value={phaseProgress.phase}
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
                    <Card title="Boundary Detection Results" style={{ marginBottom: 16 }}>
                        <List
                            size="small"
                            grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 4 }}
                            dataSource={boundaryResults}
                            renderItem={(result) => (
                                <List.Item>
                                    <Card size="small">
                                        <Statistic
                                            title={`Angle ${result.angle}°`}
                                            value={result.detection_boundary?.toFixed(2) || 'N/A'}
                                            suffix="m"
                                            prefix={result.detection_boundary ? <CheckCircleOutlined style={{ color: 'green' }} /> : null}
                                            valueStyle={{ fontSize: 16 }}
                                        />
                                    </Card>
                                </List.Item>
                            )}
                        />
                    </Card>
                )}

                {/* Event Log */}
                <Card title="Event Log">
                    <List
                        size="small"
                        dataSource={events.slice(0, 30)}
                        renderItem={(event) => (
                            <List.Item>
                                <Space>
                                    <Text type="secondary" style={{ fontSize: 11, minWidth: 70 }}>
                                        {new Date(event.timestamp).toLocaleTimeString()}
                                    </Text>
                                    <Tag color={
                                        event.type.includes('completed') ? 'green' :
                                            event.type.includes('failed') || event.type.includes('error') ? 'red' :
                                                event.type.includes('started') ? 'blue' :
                                                    event.type.includes('boundary_found') ? 'cyan' :
                                                        'default'
                                    }>
                                        {event.type}
                                    </Tag>
                                    <Text style={{ fontSize: 12 }}>
                                        {event.type === 'boundary_found_at_angle' && event.data.boundary
                                            ? `${event.data.angle}°: ${event.data.boundary.toFixed(2)}m`
                                            : JSON.stringify(event.data).slice(0, 100)}
                                    </Text>
                                </Space>
                            </List.Item>
                        )}
                    />
                </Card>
            </Content>
        </Layout>
    );
}
