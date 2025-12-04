import { useNavigate } from "react-router-dom";
import { Layout, Typography, Button, Space, Tag, Empty, message, Progress, Collapse, List, Statistic, Row, Col, Divider } from "antd";
import { LeftOutlined, PlayCircleOutlined, DownOutlined, CheckCircleOutlined, ClockCircleOutlined, EnvironmentOutlined } from "@ant-design/icons";
import TestCard, { type TestDB } from "../Components/testCard.tsx";
import { useEffect, useState } from "react";
import type {Test} from "../Types/test.ts";
import { api } from "../Components/apiAxios.ts";
import moment from "moment";

const { Header, Content } = Layout;
const { Text, Title } = Typography;
const { Panel } = Collapse;

interface BoundaryResult {
    angle: number;
    detected_distance: number | null;
    no_detection_distance: number | null;
    detection_boundary: number | null;
}

interface TestWithState extends TestDB {
    test_phase?: 'BOUNDARY_DETECTION' | 'COMPLIANCE_TEST' | 'COMPLETED';
    awaiting_confirmation?: boolean;
    boundary_results?: BoundaryResult[];
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
                        const stepsRes = await api.get(`/api/test/${test.test_id}/steps/summary`);

                        return {
                            ...test,
                            test_date: new Date(test.test_date),
                            status: test.status ?? 'PLANNED',
                            test_phase: stateRes.data?.current_phase,
                            awaiting_confirmation: stateRes.data?.awaiting_confirmation,
                            boundary_results: stateRes.data?.boundary_results ? JSON.parse(stateRes.data.boundary_results) : [],
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
        } catch (err: any) {
            console.error("Error deleting test:", err);
            message.error(err?.response?.data?.error ?? "Failed to delete test");
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
            case 'COMPLETED':
                return <Tag color="green" icon={<CheckCircleOutlined />}>All Phases Complete</Tag>;
            default:
                return null;
        }
    };

    const renderExpandedContent = (item: TestWithState) => {
        const steps = testSteps[item.test_id!];
        const hasPosition = item.last_position_x !== undefined && item.last_position_y !== undefined;

        return (
            <div style={{ padding: '16px 0' }}>
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
                        <Text strong>Detected Boundaries:</Text>
                        <Row gutter={[8, 8]} style={{ marginTop: 8 }}>
                            {item.boundary_results.map((result: BoundaryResult) => (
                                <Col span={6} key={result.angle}>
                                    <div style={{
                                        background: '#f0f0f0',
                                        padding: '8px',
                                        borderRadius: 4,
                                        textAlign: 'center'
                                    }}>
                                        <Text strong>{result.angle}°</Text>
                                        <br />
                                        <Text style={{ fontSize: 18, color: result.detection_boundary ? '#52c41a' : '#999' }}>
                                            {result.detection_boundary ? `${result.detection_boundary.toFixed(2)}m` : 'N/A'}
                                        </Text>
                                        {result.detection_boundary && (
                                            <div>
                                                <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 12 }} />
                                            </div>
                                        )}
                                    </div>
                                </Col>
                            ))}
                        </Row>
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
                                        value={item.last_position_timestamp ? moment(item.last_position_timestamp).fromNow() : 'Unknown'}
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
                        <Text type="secondary">Created:</Text> <Text>{moment(item.test_date).format('YYYY-MM-DD HH:mm')}</Text>
                    </Col>
                    <Col span={12}>
                        <Text type="secondary">Status:</Text> <Tag color={getStatusColor(item.status)}>{item.status}</Tag>
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
                                                                onClick={() => handleExpand(item.test_id)}
                                                                style={{ padding: '4px 8px' }}
                                                            />
                                                            <div>
                                                                <Text strong style={{ fontSize: 16 }}>
                                                                    {item.test_name}
                                                                </Text>
                                                                <br />
                                                                <Space size="small">
                                                                    <Tag color={getStatusColor(item.status)}>
                                                                        {item.status}
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
