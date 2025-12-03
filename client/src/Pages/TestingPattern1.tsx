import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, Button, Progress, Tag, List, Space, Alert, Row, Col, Statistic } from "antd";
import {
    PlayCircleOutlined,
    StopOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    InfoCircleOutlined,
    WarningOutlined,
    WifiOutlined,
    ReloadOutlined,
    RobotOutlined
} from "@ant-design/icons";
import { api } from "../Components/apiAxios";
import useWebSocket, { WebSocketEvent } from "../hooks/useWebSocket";

interface LogEntry {
    id: number;
    timestamp: string;
    type: "info" | "success" | "warning" | "error";
    message: string;
}

interface TestProgress {
    testId: number;
    currentPhase: string;
    totalSteps: number;
    completedSteps: number;
    percentComplete: number;
}

interface RobotPosition {
    x: number;
    y: number;
    angle: number;
}

const TestingPageEnhanced: React.FC = () => {
    const [searchParams] = useSearchParams();
    const testIdParam = searchParams.get('testId');
    const resumeParam = searchParams.get('resume');

    const [testId, setTestId] = useState<number | null>(testIdParam ? parseInt(testIdParam) : null);
    const [isResuming, setIsResuming] = useState<boolean>(resumeParam === 'true');
    const [testRunning, setTestRunning] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [progress, setProgress] = useState<TestProgress | null>(null);
    const [robotPosition, setRobotPosition] = useState<RobotPosition>({ x: 0, y: 0, angle: 0 });
    const [lastDetection, setLastDetection] = useState<boolean | null>(null);
    const [resumeInfo, setResumeInfo] = useState<any>(null);

    const logEndRef = useRef<HTMLDivElement>(null);
    const logIdCounter = useRef(0);

    // WebSocket connection
    const { isConnected } = useWebSocket({
        onConnect: () => {
            addLog("info", "Connected to test monitoring");
        },
        onDisconnect: () => {
            addLog("warning", "Disconnected from test monitoring");
        },
        onEvent: handleWebSocketMessage
    });

    // Auto-start resume if testId and resume flag are present
    useEffect(() => {
        if (testId && isResuming) {
            loadResumeInfo();
        }
    }, [testId, isResuming]);

    const loadResumeInfo = async () => {
        if (!testId) return;

        try {
            const response = await api.get(`/api/test-execution/${testId}/details`);
            if (response.data.canResume && response.data.latestCheckpoint) {
                setResumeInfo({
                    checkpoint: response.data.latestCheckpoint,
                    interruption: response.data.test.interruption_reason,
                    interrupted_at: response.data.test.interrupted_at
                });
                addLog("info", `Test can be resumed from checkpoint: ${response.data.latestCheckpoint.current_phase}`);
                addLog("info", `Progress: ${response.data.latestCheckpoint.completed_measurements}/${response.data.latestCheckpoint.total_measurements} measurements`);
            }
        } catch (error: any) {
            addLog("error", `Failed to load resume info: ${error.message}`);
        }
    };

    const addLog = (type: LogEntry["type"], message: string) => {
        const newLog: LogEntry = {
            id: logIdCounter.current++,
            timestamp: new Date().toLocaleTimeString(),
            type,
            message
        };
        setLogs(prev => [...prev, newLog]);
    };

    const handleWebSocketMessage = (message: WebSocketEvent) => {
        const payload = message.payload ?? {};
        const type = payload.type || message.event;

        switch (type) {
            case "test:started":
                setTestRunning(true);
                addLog("success", "Test execution started");
                break;

            case "test:resumed":
                setTestRunning(true);
                setIsResuming(false);
                addLog("success", `Test resumed from checkpoint: ${payload.checkpoint?.phase}`);
                break;

            case "test:completed":
                setTestRunning(false);
                addLog("success", "Test completed successfully!");
                break;

            case "test:failed":
                setTestRunning(false);
                addLog("error", `Test failed: ${payload.error}`);
                break;

            case "test:interrupted":
                setTestRunning(false);
                addLog("warning", `Test interrupted: ${payload.reason}`);
                if (payload.canResume) {
                    addLog("info", "Test can be resumed from last checkpoint");
                    setIsResuming(true);
                    loadResumeInfo();
                }
                break;

            case "test:checkpoint_saved":
                addLog("info", `Checkpoint saved: ${payload.phase} (${payload.completed} measurements)`);
                break;

            case "test:phase_started":
                addLog("info", `Starting phase: ${payload.phase}`);
                break;

            case "test:measurement_started":
                addLog("info", `Measuring at ${payload.angle}°, ${payload.distance ?? payload.radius}m (attempt ${payload.attempt})`);
                break;

            case "test:measurement_completed": {
                const detectedLabel = payload.detected ? "✓ DETECTED" : "✗ NOT DETECTED";
                const logType = payload.detected ? "success" : "warning";
                addLog(logType, `Measurement complete: ${detectedLabel} at ${payload.angle}°, ${payload.distance ?? payload.radius}m`);
                setLastDetection(payload.detected ?? null);
                break;
            }

            case "robot:initialized":
                addLog("success", "Robot initialized successfully");
                break;

            case "robot:movement_started":
                addLog("info", `Robot moving to position...`);
                break;

            case "robot:movement_completed":
                if (payload.position) {
                    setRobotPosition(payload.position);
                    addLog("info", `Robot at position (${payload.position.x.toFixed(2)}, ${payload.position.y.toFixed(2)})`);
                }
                break;

            case "sensor-detection":
            case "sensor:detection":
                if (payload.detected) {
                    addLog("success", "Sensor detected movement!");
                }
                break;

            case "checkpoint_loaded":
                addLog("info", `Loaded checkpoint from ${payload.checkpoint.current_phase}`);
                break;

            default:
                break;
        }

        if (payload.testId === testId) {
            fetchProgress();
        }
    };

    const fetchProgress = async () => {
        if (!testId) return;

        try {
            const response = await api.get<TestProgress>(
                `/api/test-execution/${testId}/progress`
            );
            setProgress(response.data);
        } catch (error) {
            // Silently fail - progress might not be available yet
        }
    };

    const startTest = async () => {
        if (!testId) {
            addLog("error", "No test ID selected");
            return;
        }

        try {
            if (isResuming && resumeInfo) {
                // Resume test
                await api.post("/api/test-execution/resume", {
                    testId
                });
                addLog("info", "Resuming test from last checkpoint...");
            } else {
                // Start new test
                await api.post("/api/test-execution/start", {
                    testId
                });
                addLog("info", "Starting test execution...");
            }
            setTestRunning(true);
        } catch (error: any) {
            addLog("error", `Failed to start test: ${error.response?.data?.error || error.message}`);
        }
    };

    const stopTest = async () => {
        try {
            await api.post("/api/test-execution/stop");
            addLog("warning", "Test execution stopped by user");
            setTestRunning(false);
        } catch (error: any) {
            addLog("error", `Failed to stop test: ${error.message}`);
        }
    };

    // Auto-scroll logs
    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);

    // Poll progress while test is running
    useEffect(() => {
        if (testRunning && testId) {
            const interval = setInterval(fetchProgress, 2000);
            return () => clearInterval(interval);
        }
    }, [testRunning, testId]);

    const getLogIcon = (type: LogEntry["type"]) => {
        switch (type) {
            case "success": return <CheckCircleOutlined style={{ color: "#52c41a" }} />;
            case "error": return <CloseCircleOutlined style={{ color: "#ff4d4f" }} />;
            case "warning": return <WarningOutlined style={{ color: "#faad14" }} />;
            default: return <InfoCircleOutlined style={{ color: "#1890ff" }} />;
        }
    };

    const getPhaseTag = (phase: string) => {
        const phaseColors: { [key: string]: string } = {
            "radial_boundary": "blue",
            "tangential_boundary": "green",
            "tangential_grid": "purple",
            "pending": "default"
        };
        return <Tag color={phaseColors[phase] || "default"}>{phase.toUpperCase().replace("_", " ")}</Tag>;
    };

    return (
        <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
            <h1>Test Execution Monitor</h1>

            {/* Resume Alert */}
            {isResuming && resumeInfo && (
                <Alert
                    type="warning"
                    message="Test Can Be Resumed"
                    description={
                        <div>
                            <p>This test was interrupted and can continue from the last checkpoint:</p>
                            <ul style={{ marginBottom: 0 }}>
                                <li><strong>Phase:</strong> {resumeInfo.checkpoint.current_phase}</li>
                                <li><strong>Progress:</strong> {resumeInfo.checkpoint.completed_measurements}/{resumeInfo.checkpoint.total_measurements} measurements</li>
                                <li><strong>Reason:</strong> {resumeInfo.interruption}</li>
                                {resumeInfo.interrupted_at && (
                                    <li><strong>Interrupted:</strong> {new Date(resumeInfo.interrupted_at).toLocaleString()}</li>
                                )}
                            </ul>
                        </div>
                    }
                    action={
                        <Button
                            type="primary"
                            icon={<ReloadOutlined />}
                            onClick={startTest}
                            disabled={testRunning}
                        >
                            Resume Test
                        </Button>
                    }
                    style={{ marginBottom: 16 }}
                    showIcon
                    icon={<PlayCircleOutlined />}
                />
            )}

            <Row gutter={16}>
                {/* Left Column - Controls and Progress */}
                <Col span={8}>
                    {/* Controls */}
                    <Card title="Test Controls" style={{ marginBottom: 16 }}>
                        <Space direction="vertical" style={{ width: "100%" }}>
                            <div>
                                <label>Test ID: </label>
                                <strong>{testId || "Not selected"}</strong>
                            </div>

                            <Space>
                                {isResuming ? (
                                    <Button
                                        type="primary"
                                        icon={<ReloadOutlined />}
                                        onClick={startTest}
                                        disabled={testRunning}
                                        block
                                    >
                                        Resume Test
                                    </Button>
                                ) : (
                                    <Button
                                        type="primary"
                                        icon={<PlayCircleOutlined />}
                                        onClick={startTest}
                                        disabled={testRunning || !testId}
                                        block
                                    >
                                        Start Test
                                    </Button>
                                )}
                                <Button
                                    danger
                                    icon={<StopOutlined />}
                                    onClick={stopTest}
                                    disabled={!testRunning}
                                    block
                                >
                                    Stop Test
                                </Button>
                            </Space>

                            <div style={{ marginTop: 16 }}>
                                <Tag color={isConnected ? "green" : "red"} icon={<WifiOutlined />}>
                                    {isConnected ? "Connected" : "Disconnected"}
                                </Tag>
                                {testRunning && <Tag color="blue">RUNNING</Tag>}
                            </div>
                        </Space>
                    </Card>

                    {/* Progress */}
                    {progress && (
                        <Card title="Test Progress" style={{ marginBottom: 16 }}>
                            <Space direction="vertical" style={{ width: "100%" }}>
                                <div>
                                    <strong>Current Phase:</strong> {getPhaseTag(progress.currentPhase)}
                                </div>
                                <Progress
                                    percent={Math.round(progress.percentComplete)}
                                    status={testRunning ? "active" : "normal"}
                                />
                                <div>
                                    Completed {progress.completedSteps} of {progress.totalSteps} steps
                                </div>
                            </Space>
                        </Card>
                    )}

                    {/* Robot Status */}
                    <Card title={<span><RobotOutlined /> Robot Status</span>}>
                        <Row gutter={16}>
                            <Col span={8}>
                                <Statistic title="X" value={robotPosition.x.toFixed(2)} suffix="m" />
                            </Col>
                            <Col span={8}>
                                <Statistic title="Y" value={robotPosition.y.toFixed(2)} suffix="m" />
                            </Col>
                            <Col span={8}>
                                <Statistic title="Angle" value={robotPosition.angle.toFixed(0)} suffix="°" />
                            </Col>
                        </Row>
                        {lastDetection !== null && (
                            <div style={{ marginTop: 16 }}>
                                <strong>Last Detection: </strong>
                                <Tag color={lastDetection ? "green" : "red"}>
                                    {lastDetection ? "MOVEMENT DETECTED" : "NO MOVEMENT"}
                                </Tag>
                            </div>
                        )}
                        {/* Visual placeholder for robot position */}
                        <div style={{
                            marginTop: 16,
                            height: 200,
                            backgroundColor: "#f0f0f0",
                            borderRadius: 8,
                            position: "relative",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                        }}>
                            <div style={{
                                position: "absolute",
                                left: `${50 + robotPosition.x * 10}%`,
                                top: `${50 - robotPosition.y * 10}%`,
                                width: 12,
                                height: 12,
                                backgroundColor: testRunning ? "#1890ff" : "#666",
                                borderRadius: "50%",
                                transform: "translate(-50%, -50%)",
                                transition: "all 0.5s ease"
                            }} />
                            <span style={{ color: "#999" }}>Robot Position Grid</span>
                        </div>
                    </Card>
                </Col>

                {/* Right Column - Logs */}
                <Col span={16}>
                    <Card
                        title="Test Execution Log"
                        extra={<Button size="small" onClick={() => setLogs([])}>Clear</Button>}
                    >
                        <div style={{
                            height: 600,
                            overflowY: "auto",
                            backgroundColor: "#1e1e1e",
                            padding: 12,
                            borderRadius: 4
                        }}>
                            <List
                                dataSource={logs}
                                renderItem={(log) => (
                                    <div style={{
                                        marginBottom: 8,
                                        color: "#fff",
                                        fontSize: 13,
                                        fontFamily: "monospace"
                                    }}>
                                        <Space>
                                            {getLogIcon(log.type)}
                                            <span style={{ color: "#888" }}>[{log.timestamp}]</span>
                                            <span>{log.message}</span>
                                        </Space>
                                    </div>
                                )}
                            />
                            <div ref={logEndRef} />
                        </div>
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default TestingPageEnhanced;
