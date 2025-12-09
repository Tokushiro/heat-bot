import { useNavigate } from "react-router-dom";
import { Layout, Typography, Button, Space, Tag, Empty, message, Progress, Statistic, Row, Col, Divider } from "antd";
import { LeftOutlined, PlayCircleOutlined, DownOutlined, CheckCircleOutlined, ClockCircleOutlined, EnvironmentOutlined, DownloadOutlined } from "@ant-design/icons";
import type { TestDB } from "../Components/testCard.tsx";
import { useEffect, useState } from "react";
import type {Test} from "../Types/test.ts";
import { api } from "../Components/apiAxios.ts";

const { Header, Content } = Layout;
const { Text, Title } = Typography;

interface BoundaryResult {
    angle: number;
    detected_distance: number | null;
    no_detection_distance: number | null;
    detection_boundary: number | null;
}

interface TestWithState extends TestDB {
    test_phase?: 'BOUNDARY_DETECTION' | 'TANGENTIAL_TEST' | 'RADIAL_TEST' | 'COMPLIANCE_TEST' | 'COMPLETED';
    awaiting_confirmation?: boolean;
    awaiting_test_selection?: boolean;
    boundary_results?: BoundaryResult[];
    boundary_detection_completed?: boolean;
    tangential_test_completed?: boolean;
    radial_test_completed?: boolean;
    last_position_x?: number;
    last_position_y?: number;
    last_position_timestamp?: string;
    completed_step_count?: number;
    last_completed_angle?: number;
}

interface TestStepSummary {
    total: number;
    completed: number;
    running: number;
    pending: number;
    error: number;
}

interface ExportData {
    test: TestDB;
    state: {
        boundary_results: string;
        current_phase?: string;
        [key: string]: unknown;
    };
    steps: Array<{
        test_step_id: number;
        sequence_no: number;
        step_type: string;
        angle: number | null;
        distance_1: number | null;
        status: string;
        detection_1: boolean | null;
        detection_2: boolean | null;
        detection_final: boolean | null;
        started_at: string | null;
        finished_at: string | null;
    }>;
    summary: TestStepSummary;
}

// Utility function to format relative time
function formatRelativeTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return `${days} day${days > 1 ? 's' : ''} ago`;
}

// Utility function to format date
function formatDate(dateInput: Date | string): string {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function HistoryPage() {
    const navigate = useNavigate();

    const [items, setItems] = useState<TestWithState[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState<number | null>(null);
    const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
    const [testSteps, setTestSteps] = useState<Record<number, TestStepSummary>>({});

    useEffect(() => {
        fetchTests();
    }, []);

    const fetchTests = async () => {
        try {
            setLoading(true);
            const res = await api.get<Test[]>(`/api/test`);

            // Get test states and step summaries for each test
            const testsWithStates = await Promise.all(
                res.data.map(async (test) => {
                    try {
                        // Fetch test state
                        const stateRes = await api.get(`/api/test/${test.test_id}/state`);

                        // Fetch test step summary
                        await api.get(`/api/test/${test.test_id}/steps/summary`);

                        return {
                            ...test,
                            test_date: new Date(test.test_date),
                            status: test.status ?? 'PLANNED',
                            test_phase: stateRes.data?.current_phase,
                            awaiting_confirmation: stateRes.data?.awaiting_confirmation,
                            awaiting_test_selection: stateRes.data?.awaiting_test_selection,
                            boundary_results: stateRes.data?.boundary_results ? JSON.parse(stateRes.data.boundary_results) : [],
                            boundary_detection_completed: stateRes.data?.boundary_detection_completed,
                            tangential_test_completed: stateRes.data?.tangential_test_completed,
                            radial_test_completed: stateRes.data?.radial_test_completed,
                            last_position_x: stateRes.data?.last_position_x,
                            last_position_y: stateRes.data?.last_position_y,
                            last_position_timestamp: stateRes.data?.last_position_timestamp,
                            completed_step_count: stateRes.data?.completed_step_count || 0,
                            last_completed_angle: stateRes.data?.last_completed_angle
                        };
                    } catch {
                        return {
                            ...test,
                            test_date: new Date(test.test_date),
                            status: test.status ?? 'PLANNED'
                        };
                    }
                })
            );

            setItems(testsWithStates);
        } catch (err: unknown) {
            console.error("Error fetching tests:", err);
            message.error("Failed to load test history");
        } finally {
            setLoading(false);
        }
    };

    const fetchTestSteps = async (test_id: number) => {
        try {
            const res = await api.get(`/api/test/${test_id}/steps/summary`);
            setTestSteps(prev => ({
                ...prev,
                [test_id]: res.data
            }));
        } catch (err) {
            console.error(`Failed to fetch steps for test ${test_id}:`, err);
        }
    };

    const handleExpand = (test_id: number | undefined) => {
        if (!test_id) return;

        const key = test_id.toString();
        if (!expandedKeys.includes(key)) {
            // Expanding - fetch step details if not already loaded
            if (!testSteps[test_id]) {
                fetchTestSteps(test_id);
            }
            setExpandedKeys([...expandedKeys, key]);
        } else {
            // Collapsing
            setExpandedKeys(expandedKeys.filter(k => k !== key));
        }
    };

    const handleDelete = async (testId: number | null | undefined) => {
        if (!testId) {
            message.error("Cannot delete test with invalid ID");
            return;
        }

        try {
            setDeleting(testId);
            await api.delete(`/api/test/${testId}`);
            message.success("Test deleted successfully");
            setItems(prev => prev.filter(item => item.test_id !== testId));
        } catch (err: unknown) {
            console.error("Error deleting test:", err);
            const axiosError = err as { response?: { data?: { error?: string } } };
            message.error(axiosError?.response?.data?.error ?? "Failed to delete test");
        } finally {
            setDeleting(null);
        }
    };

    const handleContinue = (item: TestWithState) => {
        if (item.awaiting_confirmation) {
            navigate("/testingpattern1", {
                state: {
                    ...item,
                    resuming: true
                }
            });
        } else {
            navigate("/testingpattern1", { state: item });
        }
    };

    const handleExportCSV = async (testId: number | null | undefined) => {
        if (!testId) {
            message.error("Cannot export test with invalid ID");
            return;
        }

        try {
            message.loading({ content: 'Generating CSV...', key: 'export' });

            // Fetch complete test data
            const response = await api.get(`/api/test/${testId}/export`);
            const data = response.data;

            // Generate CSV content
            const csv = generateCSV(data);

            // Download CSV file
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);

            link.setAttribute('href', url);
            link.setAttribute('download', `test_${testId}_${data.test.test_name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            message.success({ content: 'CSV exported successfully', key: 'export' });
        } catch (err) {
            console.error("Error exporting CSV:", err);
            message.error({ content: 'Failed to export CSV', key: 'export' });
        }
    };

    const generateCSV = (data: ExportData): string => {
        const lines: string[] = [];
        const { test, state, steps, summary } = data;

        // Header
        lines.push('"PIR SENSOR PERFORMANCE - BOUNDARY DETECTION TEST"');
        lines.push('');

        // Metadata Section
        lines.push('"Test Information"');
        lines.push(`"Standard","IEC 63180 Ed. 1"`);
        lines.push(`"Test Lab","H.E.A.T. Bot Testing System"`);
        lines.push(`"Test Method","Automated - Robot System"`);
        lines.push(`"Test ID","${test.test_id}"`);
        lines.push(`"Test Name","${test.test_name}"`);
        lines.push(`"Sensor ID","${test.sensor_id}"`);
        lines.push(`"Test Date","${new Date(test.test_date).toLocaleString()}"`);
        lines.push(`"Test Status","${test.status}"`);
        if (test.started_at) lines.push(`"Started At","${new Date(test.started_at).toLocaleString()}"`);
        if (test.finished_at) lines.push(`"Finished At","${new Date(test.finished_at).toLocaleString()}"`);
        lines.push('');

        // Test Parameters
        lines.push('"Test Parameters"');
        lines.push(`"Movement Speed","0.5 m/s"`);
        lines.push(`"Detection Wait Time","2 seconds"`);
        lines.push(`"Repeat Measurements","2 attempts"`);
        lines.push(`"Distance Range","1.0m - 8.0m"`);
        lines.push(`"Distance Step","0.5m"`);
        lines.push(`"Angle Increments","10° (36 angles total)"`);
        lines.push('');

        // Test Summary
        lines.push('"Test Summary"');
        if (summary) {
            lines.push(`"Total Steps","${summary.total}"`);
            lines.push(`"Completed","${summary.completed}"`);
            lines.push(`"Running","${summary.running}"`);
            lines.push(`"Pending","${summary.pending}"`);
            lines.push(`"Errors","${summary.error}"`);
            lines.push(`"Success Rate","${summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0}%"`);
        }
        lines.push('');

        // Boundary Detection Results
        if (state && state.boundary_results) {
            const boundaryResults = JSON.parse(state.boundary_results) as BoundaryResult[];

            lines.push('"BOUNDARY DETECTION RESULTS"');
            lines.push('');
            lines.push(`"Total Angles Tested","${boundaryResults.length}"`);
            const detectedCount = boundaryResults.filter((r) => r.detection_boundary !== null).length;
            lines.push(`"Angles with Detection","${detectedCount}"`);
            lines.push(`"Detection Rate","${boundaryResults.length > 0 ? Math.round((detectedCount / boundaryResults.length) * 100) : 0}%"`);
            lines.push('');

            // Column headers
            lines.push('"Angle (°)","Detected Distance (m)","No Detection Distance (m)","Detection Boundary (m)"');

            // Data rows
            boundaryResults.forEach((result) => {
                lines.push(
                    `"${result.angle}",` +
                    `"${result.detected_distance !== null ? result.detected_distance.toFixed(2) : 'N/A'}",` +
                    `"${result.no_detection_distance !== null ? result.no_detection_distance.toFixed(2) : 'N/A'}",` +
                    `"${result.detection_boundary !== null ? result.detection_boundary.toFixed(2) : 'N/A'}"`
                );
            });
            lines.push('');
        }

        // Detailed Test Steps
        if (steps && steps.length > 0) {
            lines.push('"DETAILED TEST STEPS"');
            lines.push('');

            // Column headers
            lines.push(
                '"Step ID","Sequence","Type","Angle (°)","Distance (m)","Status",' +
                '"Detection 1","Detection 2","Detection Final",' +
                '"Started At","Finished At"'
            );

            // Data rows
            steps.forEach((step) => {
                lines.push(
                    `"${step.test_step_id}",` +
                    `"${step.sequence_no}",` +
                    `"${step.step_type}",` +
                    `"${step.angle !== null ? step.angle : 'N/A'}",` +
                    `"${step.distance_1 !== null ? step.distance_1.toFixed(2) : 'N/A'}",` +
                    `"${step.status}",` +
                    `"${step.detection_1 !== null ? (step.detection_1 ? 'YES' : 'NO') : 'N/A'}",` +
                    `"${step.detection_2 !== null ? (step.detection_2 ? 'YES' : 'NO') : 'N/A'}",` +
                    `"${step.detection_final !== null ? (step.detection_final ? 'YES' : 'NO') : 'N/A'}",` +
                    `"${step.started_at ? new Date(step.started_at).toLocaleString() : 'N/A'}",` +
                    `"${step.finished_at ? new Date(step.finished_at).toLocaleString() : 'N/A'}"`
                );
            });
            lines.push('');
        }

        // Footer
        lines.push('');
        lines.push('"Generated by H.E.A.T. Bot Testing System"');
        lines.push(`"Export Date","${new Date().toLocaleString()}"`);
        lines.push('"Compliant with IEC 63180 Standard"');

        return lines.join('\n');
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'COMPLETED': return 'green';
            case 'IN_PROGRESS': return 'blue';
            case 'ERROR': return 'red';
            case 'PAUSED': return 'orange';
            case 'PLANNED':
            default: return 'default';
        }
    };

    const getPhaseTag = (item: TestWithState) => {
        if (!item.test_phase) return null;

        if (item.awaiting_confirmation) {
            return (
                <Tag color="gold" icon={<PlayCircleOutlined />}>
                    Ready to Continue
                </Tag>
            );
        }

        switch (item.test_phase) {
            case 'BOUNDARY_DETECTION':
                return <Tag color="blue">Phase 1: Boundary Detection</Tag>;
            case 'COMPLIANCE_TEST':
                return <Tag color="purple">Phase 2: Compliance Test</Tag>;
            case 'TANGENTIAL_TEST':
                return <Tag color="purple">Phase 2: Tangential Test</Tag>;
            case 'RADIAL_TEST':
                return <Tag color="purple">Phase 2: Radial Test</Tag>;
            case 'COMPLETED':
                return <Tag color="green" icon={<CheckCircleOutlined />}>All Phases Complete</Tag>;
            default:
                return null;
        }
    };

    const getIndividualPhaseStatus = (phaseCompleted?: boolean, awaiting?: boolean, currentPhase?: string, phaseName?: string, testStatus?: string) => {
        if (phaseCompleted) {
            return { color: 'green', icon: <CheckCircleOutlined />, text: 'Finished' };
        } else if (awaiting && currentPhase === phaseName) {
            return { color: 'gold', icon: <ClockCircleOutlined />, text: 'Awaiting Selection' };
        } else if (currentPhase === phaseName && testStatus === 'IN_PROGRESS') {
            return { color: 'blue', icon: <ClockCircleOutlined />, text: 'In Progress' };
        } else if (currentPhase === phaseName && testStatus === 'PAUSED') {
            return { color: 'orange', icon: <ClockCircleOutlined />, text: 'Paused' };
        } else if (currentPhase === phaseName && testStatus === 'ERROR') {
            return { color: 'red', icon: null, text: 'Error' };
        } else if (currentPhase === phaseName) {
            return { color: 'orange', icon: <ClockCircleOutlined />, text: 'Waiting to Resume' };
        } else {
            return { color: 'default', icon: null, text: 'Pending' };
        }
    };

    const renderExpandedContent = (item: TestWithState) => {
        const steps = testSteps[item.test_id!];
        const hasPosition = item.last_position_x !== undefined && item.last_position_y !== undefined;

        // Get status for each phase
        const boundaryStatus = getIndividualPhaseStatus(
            item.boundary_detection_completed,
            item.awaiting_test_selection,
            item.test_phase,
            'BOUNDARY_DETECTION',
            item.status
        );
        const tangentialStatus = getIndividualPhaseStatus(
            item.tangential_test_completed,
            item.awaiting_test_selection,
            item.test_phase,
            'TANGENTIAL_TEST',
            item.status
        );
        const radialStatus = getIndividualPhaseStatus(
            item.radial_test_completed,
            item.awaiting_test_selection,
            item.test_phase,
            'RADIAL_TEST',
            item.status
        );

        return (
            <div style={{ padding: '16px 0' }}>
                {/* Phase Status */}
                <div style={{ marginBottom: 16 }}>
                    <Text strong style={{ fontSize: 16, marginBottom: 8, display: 'block' }}>Test Phases</Text>
                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                        <div style={{
                            background: '#fff',
                            padding: '12px',
                            borderRadius: 6,
                            border: `1px solid ${boundaryStatus.color === 'green' ? '#b7eb8f' : '#d9d9d9'}`
                        }}>
                            <Space>
                                <Text strong>Boundary Detection:</Text>
                                <Tag color={boundaryStatus.color} icon={boundaryStatus.icon}>
                                    {boundaryStatus.text}
                                </Tag>
                            </Space>
                        </div>
                        <div style={{
                            background: '#fff',
                            padding: '12px',
                            borderRadius: 6,
                            border: `1px solid ${tangentialStatus.color === 'green' ? '#b7eb8f' : '#d9d9d9'}`
                        }}>
                            <Space>
                                <Text strong>Tangential Test:</Text>
                                <Tag color={tangentialStatus.color} icon={tangentialStatus.icon}>
                                    {tangentialStatus.text}
                                </Tag>
                            </Space>
                        </div>
                        <div style={{
                            background: '#fff',
                            padding: '12px',
                            borderRadius: 6,
                            border: `1px solid ${radialStatus.color === 'green' ? '#b7eb8f' : '#d9d9d9'}`
                        }}>
                            <Space>
                                <Text strong>Radial Test:</Text>
                                <Tag color={radialStatus.color} icon={radialStatus.icon}>
                                    {radialStatus.text}
                                </Tag>
                            </Space>
                        </div>
                    </Space>
                </div>

                <Divider />

                {/* Progress Summary */}
                <Row gutter={16} style={{ marginBottom: 16 }}>
                    <Col span={6}>
                        <Statistic
                            title="Phase"
                            value={item.test_phase || 'Not Started'}
                            valueStyle={{ fontSize: 16 }}
                        />
                    </Col>
                    <Col span={6}>
                        <Statistic
                            title="Completed Steps"
                            value={item.completed_step_count || 0}
                            valueStyle={{ fontSize: 16, color: '#52c41a' }}
                            prefix={<CheckCircleOutlined />}
                        />
                    </Col>
                    {steps && (
                        <>
                            <Col span={6}>
                                <Statistic
                                    title="Total Steps"
                                    value={steps.total}
                                    valueStyle={{ fontSize: 16 }}
                                />
                            </Col>
                            <Col span={6}>
                                <Statistic
                                    title="Success Rate"
                                    value={steps.total > 0 ? Math.round((steps.completed / steps.total) * 100) : 0}
                                    suffix="%"
                                    valueStyle={{ fontSize: 16 }}
                                />
                            </Col>
                        </>
                    )}
                </Row>

                {/* Progress Bar */}
                {steps && steps.total > 0 && (
                    <div style={{ marginBottom: 16 }}>
                        <Text strong>Test Progress:</Text>
                        <Progress
                            percent={Math.round((steps.completed / steps.total) * 100)}
                            status={item.status === 'ERROR' ? 'exception' : item.status === 'COMPLETED' ? 'success' : 'active'}
                            strokeColor={{
                                '0%': '#108ee9',
                                '100%': '#87d068',
                            }}
                        />
                        <Space size="large" style={{ marginTop: 8 }}>
                            <Text type="success">
                                <CheckCircleOutlined /> Completed: {steps.completed}
                            </Text>
                            {steps.running > 0 && (
                                <Text type="warning">
                                    <ClockCircleOutlined /> Running: {steps.running}
                                </Text>
                            )}
                            {steps.error > 0 && (
                                <Text type="danger">
                                    ⚠️ Errors: {steps.error}
                                </Text>
                            )}
                            {steps.pending > 0 && (
                                <Text type="secondary">
                                    Pending: {steps.pending}
                                </Text>
                            )}
                        </Space>
                    </div>
                )}

                <Divider />

                {/* Boundary Results */}
                {item.boundary_results && item.boundary_results.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                        <Text strong>
                            Detected Boundaries ({item.boundary_results.filter((r: BoundaryResult) => r.detection_boundary !== null).length}/{item.boundary_results.length} angles)
                        </Text>
                        <div style={{ maxHeight: '300px', overflow: 'auto', marginTop: 8 }}>
                            <Row gutter={[6, 6]}>
                                {item.boundary_results.map((result: BoundaryResult) => (
                                    <Col span={4} key={result.angle}>
                                        <div style={{
                                            background: result.detection_boundary ? '#f6ffed' : '#fff2e8',
                                            border: result.detection_boundary ? '1px solid #b7eb8f' : '1px solid #ffd591',
                                            padding: '6px',
                                            borderRadius: 4,
                                            textAlign: 'center'
                                        }}>
                                            <Text strong style={{ fontSize: 12 }}>{result.angle}°</Text>
                                            <br />
                                            <Text style={{ fontSize: 14, color: result.detection_boundary ? '#52c41a' : '#999' }}>
                                                {result.detection_boundary ? `${result.detection_boundary.toFixed(2)}m` : 'N/A'}
                                            </Text>
                                            {result.detection_boundary && (
                                                <div>
                                                    <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 10 }} />
                                                </div>
                                            )}
                                        </div>
                                    </Col>
                                ))}
                            </Row>
                        </div>
                    </div>
                )}

                {/* Last Position */}
                {hasPosition && (
                    <div style={{ marginBottom: 16 }}>
                        <Text strong>
                            <EnvironmentOutlined /> Last Robot Position:
                        </Text>
                        <div style={{
                            background: '#e6f7ff',
                            padding: '12px',
                            borderRadius: 4,
                            marginTop: 8,
                            border: '1px solid #91d5ff'
                        }}>
                            <Row gutter={16}>
                                <Col span={8}>
                                    <Statistic
                                        title="X Coordinate"
                                        value={item.last_position_x}
                                        suffix="m"
                                        precision={2}
                                        valueStyle={{ fontSize: 16 }}
                                    />
                                </Col>
                                <Col span={8}>
                                    <Statistic
                                        title="Y Coordinate"
                                        value={item.last_position_y}
                                        suffix="m"
                                        precision={2}
                                        valueStyle={{ fontSize: 16 }}
                                    />
                                </Col>
                                <Col span={8}>
                                    <Statistic
                                        title="Last Updated"
                                        value={item.last_position_timestamp ? formatRelativeTime(item.last_position_timestamp) : 'Unknown'}
                                        valueStyle={{ fontSize: 14 }}
                                    />
                                </Col>
                            </Row>
                        </div>
                    </div>
                )}

                {/* Resume Info */}
                {item.status === 'PAUSED' && (
                    <div style={{
                        background: '#fffbe6',
                        padding: '12px',
                        borderRadius: 4,
                        border: '1px solid #ffe58f'
                    }}>
                        <Text strong style={{ color: '#faad14' }}>
                            ⚠️ Test Paused - Can Resume
                        </Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            Click "Continue" to resume from {
                            item.awaiting_confirmation
                                ? 'user confirmation point'
                                : item.last_completed_angle !== undefined
                                    ? `angle ${item.last_completed_angle}°`
                                    : 'last position'
                        }
                        </Text>
                    </div>
                )}

                {/* Test Details */}
                <Divider />
                <Row gutter={16}>
                    <Col span={12}>
                        <Text type="secondary">Test ID:</Text> <Text>{item.test_id}</Text>
                    </Col>
                    <Col span={12}>
                        <Text type="secondary">Sensor ID:</Text> <Text>{item.sensor_id}</Text>
                    </Col>
                    <Col span={12}>
                        <Text type="secondary">Created:</Text> <Text>{formatDate(item.test_date)}</Text>
                    </Col>
                    <Col span={12}>
                        <Text type="secondary">Status:</Text> <Tag color={getStatusColor(item.status ?? 'PLANNED')}>{item.status ?? 'PLANNED'}</Tag>
                    </Col>
                </Row>
            </div>
        );
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
                }}
            >
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

                <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
                    <Space>
                        <div
                            style={{
                                background: "#1677ff",
                                color: "#fff",
                                padding: "4px",
                                height: "20px",
                                width: "20px",
                                borderRadius: 4,
                            }}
                        />
                        <Text>RoboControl-X1</Text>
                        <Tag color="green" style={{ borderRadius: 999 }}>Connected</Tag>
                    </Space>
                </div>

                <div style={{ flex: 1 }} />
            </Header>

            <Content
                style={{
                    height: "calc(100vh - 56px)",
                    overflow: "auto",
                    background: "#f5f5f5",
                }}
            >
                <Title level={2} style={{ textAlign: "center", marginTop: 24, marginBottom: 16 }}>
                    Test History
                </Title>

                <div style={{ maxWidth: 960, margin: "0 auto", padding: 16 }}>
                    {loading ? (
                        <div style={{ textAlign: "center", padding: "40px 0" }}>
                            <Typography.Text type="secondary">Loading tests...</Typography.Text>
                        </div>
                    ) : items.length === 0 ? (
                        <Empty description="No history yet" />
                    ) : (
                        <Space direction="vertical" size={12} style={{ width: "100%" }}>
                            {items.map(item => {
                                const isExpanded = expandedKeys.includes(item.test_id?.toString() || '');

                                return (
                                    <div key={item.test_id ?? `test-${item.test_name}`}>
                                        {/* Phase Tag */}
                                        {getPhaseTag(item)}

                                        {/* Main Card */}
                                        <div style={{
                                            background: '#fff',
                                            borderRadius: 8,
                                            overflow: 'hidden',
                                            border: '1px solid #f0f0f0'
                                        }}>
                                            {/* Compact View */}
                                            <div style={{ padding: 16 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div style={{ flex: 1 }}>
                                                        <Space>
                                                            <Button
                                                                type="text"
                                                                icon={<DownOutlined
                                                                    rotate={isExpanded ? 180 : 0}
                                                                    style={{ transition: 'transform 0.3s' }}
                                                                />}
                                                                onClick={() => handleExpand(item.test_id ?? undefined)}
                                                                style={{ padding: '4px 8px' }}
                                                            />
                                                            <div>
                                                                <Text strong style={{ fontSize: 16 }}>
                                                                    {item.test_name}
                                                                </Text>
                                                                <br />
                                                                <Space size="small">
                                                                    <Tag color={getStatusColor(item.status ?? 'PLANNED')}>
                                                                        {item.status ?? 'PLANNED'}
                                                                    </Tag>
                                                                    {item.completed_step_count !== undefined && item.completed_step_count > 0 && (
                                                                        <Text type="secondary" style={{ fontSize: 12 }}>
                                                                            <CheckCircleOutlined /> {item.completed_step_count} steps completed
                                                                        </Text>
                                                                    )}
                                                                    {item.last_position_x !== undefined && item.last_position_y !== undefined && (
                                                                        <Text type="secondary" style={{ fontSize: 12 }}>
                                                                            <EnvironmentOutlined /> ({item.last_position_x.toFixed(1)}m, {item.last_position_y.toFixed(1)}m)
                                                                        </Text>
                                                                    )}
                                                                </Space>
                                                            </div>
                                                        </Space>
                                                    </div>

                                                    {/* Action Buttons */}
                                                    <Space>
                                                        {item.status === 'PAUSED' && (
                                                            <Button
                                                                type="primary"
                                                                icon={<PlayCircleOutlined />}
                                                                onClick={() => handleContinue(item)}
                                                            >
                                                                Continue
                                                            </Button>
                                                        )}
                                                        <Button onClick={() => handleContinue(item)}>
                                                            View
                                                        </Button>
                                                        <Button
                                                            icon={<DownloadOutlined />}
                                                            onClick={() => handleExportCSV(item.test_id)}
                                                        >
                                                            Export CSV
                                                        </Button>
                                                        <Button
                                                            danger
                                                            onClick={() => handleDelete(item.test_id)}
                                                            loading={deleting === item.test_id}
                                                        >
                                                            Delete
                                                        </Button>
                                                    </Space>
                                                </div>
                                            </div>

                                            {/* Expanded View */}
                                            {isExpanded && (
                                                <div style={{
                                                    borderTop: '1px solid #f0f0f0',
                                                    background: '#fafafa',
                                                    padding: '0 16px'
                                                }}>
                                                    {renderExpandedContent(item)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </Space>
                    )}
                </div>
            </Content>
        </Layout>
    );
}
