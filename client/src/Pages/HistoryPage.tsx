import { useNavigate } from "react-router-dom";
import { Layout, Typography, Button, Space, Tag, Empty, message, Progress, Statistic, Row, Col, Divider, Popconfirm, Card } from "antd";
import { LeftOutlined, PlayCircleOutlined, DownOutlined, CheckCircleOutlined, ClockCircleOutlined, EnvironmentOutlined, DownloadOutlined, AimOutlined, CloseCircleOutlined } from "@ant-design/icons";
import type { TestDB } from "../Components/testCard.tsx";
import { useEffect, useState, useCallback } from "react";
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

    const fetchTests = useCallback(async (showLoading = true) => {
        try {
            if (showLoading) {
                setLoading(true);
            }
            const res = await api.get<TestDB[]>(`/api/test`);

            // Get test states and step summaries for each test
            const testsWithStates = await Promise.all(
                res.data.map(async (test) => {
                    try {
                        // Fetch test state
                        const stateRes = await api.get(`/api/test/${test.test_id}/state`);

                        // Fetch test step summary (discarded here, but triggers server-side aggregate updates if any)
                        await api.get(`/api/test/${test.test_id}/steps/summary`);

                        // Safely parse boundary results (array or JSON string)
                        let boundaryResults: BoundaryResult[] = [];
                        const rawBoundaryResults = stateRes.data?.boundary_results;
                        if (Array.isArray(rawBoundaryResults)) {
                            boundaryResults = rawBoundaryResults;
                        } else if (typeof rawBoundaryResults === 'string' && rawBoundaryResults.trim()) {
                            try {
                                boundaryResults = JSON.parse(rawBoundaryResults);
                            } catch (err) {
                                console.warn("Failed to parse boundary_results for test", test.test_id, err);
                                boundaryResults = [];
                            }
                        }

                        const boundaryCompleted =
                            stateRes.data?.boundary_detection_completed ||
                            (boundaryResults?.length ?? 0) > 0;
                        const tangentialCompleted = Boolean(stateRes.data?.tangential_test_completed);
                        const radialCompleted = Boolean(stateRes.data?.radial_test_completed);

                        // Derive a best-effort current phase when backend doesn't send one
                        let derivedPhase = stateRes.data?.current_phase;
                        if (!derivedPhase) {
                            if (tangentialCompleted && radialCompleted) {
                                derivedPhase = 'COMPLETED';
                            } else if (tangentialCompleted && !radialCompleted) {
                                derivedPhase = 'TANGENTIAL_TEST';
                            } else if (radialCompleted && !tangentialCompleted) {
                                derivedPhase = 'RADIAL_TEST';
                            } else if (boundaryCompleted) {
                                derivedPhase = 'BOUNDARY_DETECTION';
                            }
                        }

                        return {
                            ...test,
                            test_date: new Date(test.test_date),
                            status: test.status ?? 'PLANNED',
                            test_phase: derivedPhase,
                            awaiting_confirmation: stateRes.data?.awaiting_confirmation,
                            awaiting_test_selection: stateRes.data?.awaiting_test_selection || stateRes.data?.state_data?.awaiting_test_selection,
                            boundary_results: boundaryResults,
                            boundary_detection_completed: boundaryCompleted,
                            tangential_test_completed: tangentialCompleted,
                            radial_test_completed: radialCompleted,
                            last_position_x: stateRes.data?.last_position_x,
                            last_position_y: stateRes.data?.last_position_y,
                            last_position_timestamp: stateRes.data?.last_position_timestamp,
                            completed_step_count: stateRes.data?.completed_step_count || 0,
                            last_completed_angle: stateRes.data?.last_completed_angle
                        };
                    } catch (err) {
                        console.warn("Failed to hydrate state for test", test.test_id, err);
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
    }, []);

    useEffect(() => {
        fetchTests(true); // Show loading on initial fetch

        // Auto-refresh every 3 seconds to keep history updated during test execution
        const interval = setInterval(() => {
            fetchTests(false); // Don't show loading on auto-refresh to avoid flickering
        }, 3000);

        return () => clearInterval(interval);
    }, [fetchTests]);

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

    const handleExportCSV = async (test: TestWithState) => {
        const testId = test.test_id;
        if (!testId) {
            message.error("Cannot export test with invalid ID");
            return;
        }

        const phasesCompleted = !!test.boundary_detection_completed && !!test.tangential_test_completed && !!test.radial_test_completed;
        const statusCompleted = test.status === 'COMPLETED';
        if (!phasesCompleted || !statusCompleted) {
            message.warning("CSV export is available only after boundary, tangential, and radial phases are completed.");
            return;
        }

        try {
            message.loading({ content: 'Generating comprehensive IEC 63180 report...', key: 'export' });

            // Use the comprehensive IEC export endpoint which includes:
            // - Overview section with metadata
            // - Tangential Boundary section with 15% rule calculations
            // - Radial section (if available)
            // - Environmental data (temperature & humidity)
            const response = await api.get(`/api/export/comprehensive/${testId}`, {
                responseType: 'blob'
            });

            // Download CSV file
            const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);

            link.setAttribute('href', url);
            link.setAttribute('download', `IEC63180_Test_${testId}_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            message.success({ content: 'IEC 63180 comprehensive report exported successfully', key: 'export' });
        } catch (err) {
            console.error("Error exporting CSV:", err);
            const axiosError = err as { response?: { data?: { error?: string } } };
            message.error({ content: axiosError?.response?.data?.error ?? 'Failed to export CSV', key: 'export' });
        }
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
        } else if (awaiting && (currentPhase === phaseName || !currentPhase)) {
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

        // Derive completion flags defensively (handles missing state flags)
        const boundaryCompleted = Boolean(item.boundary_detection_completed || (item.boundary_results?.length ?? 0) > 0);
        const tangentialCompleted = Boolean(item.tangential_test_completed);
        const radialCompleted = Boolean(item.radial_test_completed);

        // Get status for each phase
        const boundaryStatus = getIndividualPhaseStatus(
            boundaryCompleted,
            item.awaiting_test_selection,
            item.test_phase,
            'BOUNDARY_DETECTION',
            item.status
        );
        const tangentialStatus = getIndividualPhaseStatus(
            tangentialCompleted,
            item.awaiting_test_selection,
            item.test_phase,
            'TANGENTIAL_TEST',
            item.status
        );
        const radialStatus = getIndividualPhaseStatus(
            radialCompleted,
            item.awaiting_test_selection,
            item.test_phase,
            'RADIAL_TEST',
            item.status
        );

        return (
            <div style={{ padding: '16px 0' }}>
                {/* Phase Status */}
                <div style={{ marginBottom: 24 }}>
                    <Text strong style={{ fontSize: 16, marginBottom: 12, display: 'block', color: '#1890ff' }}>
                        Test Phases
                    </Text>
                    <Row gutter={[12, 12]}>
                        <Col xs={24} sm={8}>
                            <div style={{
                                background: boundaryStatus.color === 'green' ? '#f6ffed' : '#fafafa',
                                padding: '16px',
                                borderRadius: 8,
                                border: `2px solid ${boundaryStatus.color === 'green' ? '#52c41a' : boundaryStatus.color === 'blue' ? '#1890ff' : '#d9d9d9'}`,
                                transition: 'all 0.3s',
                                boxShadow: boundaryStatus.color === 'green' || boundaryStatus.color === 'blue' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none'
                            }}>
                                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                                    <Text type="secondary" style={{ fontSize: 12 }}>Phase 1</Text>
                                    <Text strong style={{ fontSize: 14 }}>Boundary Detection</Text>
                                    <Tag color={boundaryStatus.color} icon={boundaryStatus.icon} style={{ marginTop: 4 }}>
                                        {boundaryStatus.text}
                                    </Tag>
                                </Space>
                            </div>
                        </Col>
                        <Col xs={24} sm={8}>
                            <div style={{
                                background: tangentialStatus.color === 'green' ? '#f6ffed' : '#fafafa',
                                padding: '16px',
                                borderRadius: 8,
                                border: `2px solid ${tangentialStatus.color === 'green' ? '#52c41a' : tangentialStatus.color === 'blue' ? '#1890ff' : '#d9d9d9'}`,
                                transition: 'all 0.3s',
                                boxShadow: tangentialStatus.color === 'green' || tangentialStatus.color === 'blue' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none'
                            }}>
                                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                                    <Text type="secondary" style={{ fontSize: 12 }}>Phase 2A</Text>
                                    <Text strong style={{ fontSize: 14 }}>Tangential Test</Text>
                                    <Tag color={tangentialStatus.color} icon={tangentialStatus.icon} style={{ marginTop: 4 }}>
                                        {tangentialStatus.text}
                                    </Tag>
                                </Space>
                            </div>
                        </Col>
                        <Col xs={24} sm={8}>
                            <div style={{
                                background: radialStatus.color === 'green' ? '#f6ffed' : '#fafafa',
                                padding: '16px',
                                borderRadius: 8,
                                border: `2px solid ${radialStatus.color === 'green' ? '#52c41a' : radialStatus.color === 'blue' ? '#1890ff' : '#d9d9d9'}`,
                                transition: 'all 0.3s',
                                boxShadow: radialStatus.color === 'green' || radialStatus.color === 'blue' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none'
                            }}>
                                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                                    <Text type="secondary" style={{ fontSize: 12 }}>Phase 2B</Text>
                                    <Text strong style={{ fontSize: 14 }}>Radial Test</Text>
                                    <Tag color={radialStatus.color} icon={radialStatus.icon} style={{ marginTop: 4 }}>
                                        {radialStatus.text}
                                    </Tag>
                                </Space>
                            </div>
                        </Col>
                    </Row>
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
                        <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 12 }}>
                            Test Progress
                        </Text>
                        <Progress
                            percent={Math.round((steps.completed / steps.total) * 100)}
                            status={item.status === 'ERROR' ? 'exception' : item.status === 'COMPLETED' ? 'success' : 'active'}
                            strokeColor={{
                                '0%': '#108ee9',
                                '100%': '#87d068',
                            }}
                            style={{ marginBottom: 12 }}
                        />
                        <Row gutter={[12, 8]}>
                            <Col xs={12} sm={6}>
                                <Text type="success">
                                    <CheckCircleOutlined /> Completed: {steps.completed}
                                </Text>
                            </Col>
                            {steps.running > 0 && (
                                <Col xs={12} sm={6}>
                                    <Text type="warning">
                                        <ClockCircleOutlined /> Running: {steps.running}
                                    </Text>
                                </Col>
                            )}
                            {steps.error > 0 && (
                                <Col xs={12} sm={6}>
                                    <Text type="danger">
                                        ⚠️ Errors: {steps.error}
                                    </Text>
                                </Col>
                            )}
                            {steps.pending > 0 && (
                                <Col xs={12} sm={6}>
                                    <Text type="secondary">
                                        Pending: {steps.pending}
                                    </Text>
                                </Col>
                            )}
                        </Row>
                    </div>
                )}

                <Divider />

                {/* Boundary Results */}
                {item.boundary_results && item.boundary_results.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                        <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 12 }}>
                            <AimOutlined /> Boundary Detection Results
                        </Text>

                        {/* Summary Statistics */}
                        <Row gutter={12} style={{ marginBottom: 16 }}>
                            <Col xs={24} sm={8}>
                                <Card size="small" style={{ background: '#f6ffed', border: '1px solid #b7eb8f' }}>
                                    <Statistic
                                        title="Detected"
                                        value={item.boundary_results.filter((r: BoundaryResult) => r.detection_boundary !== null).length}
                                        suffix={`/ ${item.boundary_results.length}`}
                                        prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                                        valueStyle={{ color: '#52c41a', fontSize: 20 }}
                                    />
                                </Card>
                            </Col>
                            <Col xs={24} sm={8}>
                                <Card size="small" style={{ background: '#fff7e6', border: '1px solid #ffd591' }}>
                                    <Statistic
                                        title="Not Detected"
                                        value={item.boundary_results.filter((r: BoundaryResult) => r.detection_boundary === null).length}
                                        suffix={`/ ${item.boundary_results.length}`}
                                        prefix={<CloseCircleOutlined style={{ color: '#faad14' }} />}
                                        valueStyle={{ color: '#faad14', fontSize: 20 }}
                                    />
                                </Card>
                            </Col>
                            <Col xs={24} sm={8}>
                                <Card size="small" style={{ background: '#e6f7ff', border: '1px solid #91d5ff' }}>
                                    <Statistic
                                        title="Avg. Distance"
                                        value={(() => {
                                            const detected = item.boundary_results.filter((r: BoundaryResult) => r.detection_boundary !== null);
                                            if (detected.length === 0) return 0;
                                            const sum = detected.reduce((acc: number, r: BoundaryResult) => acc + (r.detection_boundary || 0), 0);
                                            return (sum / detected.length).toFixed(2);
                                        })()}
                                        suffix="m"
                                        prefix={<EnvironmentOutlined style={{ color: '#1890ff' }} />}
                                        valueStyle={{ color: '#1890ff', fontSize: 20 }}
                                    />
                                </Card>
                            </Col>
                        </Row>

                        {/* Boundary Grid */}
                        <div style={{
                            background: '#fafafa',
                            padding: '12px',
                            borderRadius: 8,
                            border: '1px solid #d9d9d9'
                        }}>
                            <div style={{ maxHeight: '300px', overflow: 'auto' }}>
                                <Row gutter={[8, 8]}>
                                    {item.boundary_results.map((result: BoundaryResult) => (
                                        <Col xs={12} sm={8} md={6} lg={4} key={result.angle}>
                                            <div style={{
                                                background: result.detection_boundary ? '#f6ffed' : '#fff2e8',
                                                border: result.detection_boundary ? '2px solid #52c41a' : '2px solid #ffd591',
                                                padding: '10px',
                                                borderRadius: 6,
                                                textAlign: 'center',
                                                transition: 'all 0.3s',
                                                boxShadow: result.detection_boundary ? '0 2px 4px rgba(82, 196, 26, 0.2)' : '0 2px 4px rgba(255, 173, 20, 0.2)',
                                                cursor: 'default'
                                            }}>
                                                <div style={{ marginBottom: 4 }}>
                                                    <Text strong style={{ fontSize: 13, color: '#262626' }}>
                                                        {result.angle}°
                                                    </Text>
                                                </div>
                                                <div style={{ marginBottom: 4 }}>
                                                    <Text style={{
                                                        fontSize: 16,
                                                        fontWeight: 600,
                                                        color: result.detection_boundary ? '#52c41a' : '#999'
                                                    }}>
                                                        {result.detection_boundary ? `${result.detection_boundary.toFixed(2)}m` : 'N/A'}
                                                    </Text>
                                                </div>
                                                {result.detection_boundary ? (
                                                    <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 14 }} />
                                                ) : (
                                                    <CloseCircleOutlined style={{ color: '#faad14', fontSize: 14 }} />
                                                )}
                                            </div>
                                        </Col>
                                    ))}
                                </Row>
                            </div>
                        </div>
                    </div>
                )}

                {/* Last Position */}
                {hasPosition && (
                    <div style={{ marginBottom: 16 }}>
                        <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 12 }}>
                            <EnvironmentOutlined /> Last Robot Position
                        </Text>
                        <div style={{
                            background: '#e6f7ff',
                            padding: '16px',
                            borderRadius: 8,
                            border: '1px solid #91d5ff',
                            boxShadow: '0 2px 4px rgba(24, 144, 255, 0.1)'
                        }}>
                            <Row gutter={[16, 16]}>
                                <Col xs={24} sm={8}>
                                    <Statistic
                                        title="X Coordinate"
                                        value={item.last_position_x}
                                        suffix="m"
                                        precision={2}
                                        valueStyle={{ fontSize: 18, color: '#1890ff' }}
                                    />
                                </Col>
                                <Col xs={24} sm={8}>
                                    <Statistic
                                        title="Y Coordinate"
                                        value={item.last_position_y}
                                        suffix="m"
                                        precision={2}
                                        valueStyle={{ fontSize: 18, color: '#1890ff' }}
                                    />
                                </Col>
                                <Col xs={24} sm={8}>
                                    <Statistic
                                        title="Last Updated"
                                        value={item.last_position_timestamp ? formatRelativeTime(item.last_position_timestamp) : 'Unknown'}
                                        valueStyle={{ fontSize: 16 }}
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
                <div style={{
                    background: '#fafafa',
                    padding: '16px',
                    borderRadius: 8,
                    border: '1px solid #d9d9d9'
                }}>
                    <Row gutter={[16, 12]}>
                        <Col xs={24} sm={12}>
                            <Space direction="vertical" size={0}>
                                <Text type="secondary" style={{ fontSize: 12 }}>Test ID</Text>
                                <Text strong style={{ fontSize: 14 }}>{item.test_id}</Text>
                            </Space>
                        </Col>
                        <Col xs={24} sm={12}>
                            <Space direction="vertical" size={0}>
                                <Text type="secondary" style={{ fontSize: 12 }}>Sensor ID</Text>
                                <Text strong style={{ fontSize: 14 }}>{item.sensor_id}</Text>
                            </Space>
                        </Col>
                        <Col xs={24} sm={12}>
                            <Space direction="vertical" size={0}>
                                <Text type="secondary" style={{ fontSize: 12 }}>Created</Text>
                                <Text strong style={{ fontSize: 14 }}>{formatDate(item.test_date)}</Text>
                            </Space>
                        </Col>
                        <Col xs={24} sm={12}>
                            <Space direction="vertical" size={0}>
                                <Text type="secondary" style={{ fontSize: 12 }}>Status</Text>
                                <Tag color={getStatusColor(item.status ?? 'PLANNED')} style={{ marginTop: 4 }}>
                                    {item.status ?? 'PLANNED'}
                                </Tag>
                            </Space>
                        </Col>
                    </Row>
                </div>
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
                                const phasesComplete = Boolean(
                                    item.boundary_detection_completed &&
                                    item.tangential_test_completed &&
                                    item.radial_test_completed
                                );
                                const canExport = phasesComplete && item.status === 'COMPLETED';

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
                                                            onClick={() => handleExportCSV(item)}
                                                            disabled={!canExport}
                                                            title={!canExport ? "Complete all phases to enable CSV export" : undefined}
                                                        >
                                                            Export CSV
                                                        </Button>
                                                        <Popconfirm
                                                            title="Delete this test?"
                                                            description="This will permanently delete the test and all associated data. This action cannot be undone."
                                                            okText="Delete"
                                                            cancelText="Cancel"
                                                            okButtonProps={{ danger: true, loading: deleting === item.test_id }}
                                                            onConfirm={() => handleDelete(item.test_id)}
                                                            disabled={deleting === item.test_id}
                                                        >
                                                            <Button
                                                                danger
                                                                loading={deleting === item.test_id}
                                                                disabled={deleting === item.test_id}
                                                            >
                                                                Delete
                                                            </Button>
                                                        </Popconfirm>
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
