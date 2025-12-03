import { useNavigate } from "react-router-dom";
import { Layout, Typography, Button, Space, Tag, Table, Collapse, Card, Statistic, Row, Col, message, Modal } from "antd";
import {
    LeftOutlined,
    DownloadOutlined,
    EyeOutlined,
    DeleteOutlined,
    PlayCircleOutlined,
    ExclamationCircleOutlined,
    ClockCircleOutlined,
    CheckCircleOutlined
} from "@ant-design/icons";
import { useEffect, useState } from "react";
import type {Test} from "../Types/test.ts";
import { api } from "../Components/apiAxios.ts";

const { Header, Content } = Layout;
const { Text, Title } = Typography;
const { Panel } = Collapse;

interface TestDetails {
    test: any;
    measurements: any[];
    radialBoundaries: any[];
    tangentialBoundaries: any[];
    canResume?: boolean;
    latestCheckpoint?: any;
}

interface TestWithDetails extends Test {
    status: "completed" | "in_progress" | "pending" | "failed";
    can_resume?: boolean;
    interrupted_at?: string;
    interruption_reason?: string;
    last_checkpoint?: any;
    details?: TestDetails;
}

export default function HistoryPageEnhanced() {
    const navigate = useNavigate();
    const [tests, setTests] = useState<TestWithDetails[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedRowKeys, setExpandedRowKeys] = useState<number[]>([]);
    const [detailsCache, setDetailsCache] = useState<Map<number, TestDetails>>(new Map());

    useEffect(() => {
        fetchTests();
    }, []);

    const fetchTests = async () => {
        try {
            setLoading(true);
            const res = await api.get<Test[]>(`/api/test`);
            const testsWithStatus: TestWithDetails[] = res.data.map((t: any) => ({
                ...t,
                test_date: new Date(t.test_date),
                status: t.status || "pending",
                can_resume: t.can_resume || false,
                interrupted_at: t.interrupted_at,
                interruption_reason: t.interruption_reason,
                last_checkpoint: t.last_checkpoint
            }));
            setTests(testsWithStatus);
        } catch (err) {
            console.error("Error fetching tests:", err);
            message.error("Failed to load test history");
        } finally {
            setLoading(false);
        }
    };

    const fetchTestDetails = async (testId: number) => {
        // Check cache first
        if (detailsCache.has(testId)) {
            return detailsCache.get(testId)!;
        }

        try {
            const response = await api.get(`/api/test-execution/${testId}/details`);
            const details: TestDetails = response.data;

            // Update cache
            const newCache = new Map(detailsCache);
            newCache.set(testId, details);
            setDetailsCache(newCache);

            return details;
        } catch (error: any) {
            message.error(`Failed to load test details: ${error.message}`);
            throw error;
        }
    };

    const handleExpand = async (expanded: boolean, record: TestWithDetails) => {
        if (expanded) {
            try {
                const details = await fetchTestDetails(record.test_id);

                // Update the test with details
                setTests(prevTests =>
                    prevTests.map(t =>
                        t.test_id === record.test_id
                            ? { ...t, details }
                            : t
                    )
                );

                setExpandedRowKeys([...expandedRowKeys, record.test_id]);
            } catch (error) {
                // Error already handled in fetchTestDetails
            }
        } else {
            setExpandedRowKeys(expandedRowKeys.filter(key => key !== record.test_id));
        }
    };

    const handleViewTest = (testId: number) => {
        navigate(`/testing?testId=${testId}`);
    };

    const handleResumeTest = (test: TestWithDetails) => {
        Modal.confirm({
            title: "Resume Interrupted Test",
            icon: <PlayCircleOutlined style={{ color: "#1890ff" }} />,
            content: (
                <div>
                    <p>This test was interrupted and can be resumed from the last checkpoint.</p>
                    {test.interruption_reason && (
                        <div style={{ marginTop: 12, padding: 8, backgroundColor: "#fff7e6", borderRadius: 4 }}>
                            <Text strong>Reason: </Text>
                            <Text type="danger">{test.interruption_reason}</Text>
                        </div>
                    )}
                    {test.last_checkpoint && (
                        <div style={{ marginTop: 12, padding: 8, backgroundColor: "#f0f0f0", borderRadius: 4 }}>
                            <Text strong>Progress: </Text>
                            <Text>
                                {test.last_checkpoint.completed || 0} of {test.last_checkpoint.total || 0} measurements
                                ({Math.round(((test.last_checkpoint.completed || 0) / (test.last_checkpoint.total || 1)) * 100)}%)
                            </Text>
                        </div>
                    )}
                    {test.interrupted_at && (
                        <div style={{ marginTop: 8 }}>
                            <Text type="secondary">
                                Interrupted: {new Date(test.interrupted_at).toLocaleString()}
                            </Text>
                        </div>
                    )}
                    <p style={{ marginTop: 16 }}>
                        Do you want to resume this test? It will continue from where it left off.
                    </p>
                </div>
            ),
            okText: "Resume Test",
            cancelText: "Cancel",
            onOk: async () => {
                try {
                    await api.post('/api/test-execution/resume', { testId: test.test_id });
                    message.success(`Test "${test.test_name}" is resuming...`);
                    // Navigate to testing page with resume flag
                    navigate(`/testing?testId=${test.test_id}&resume=true`);
                } catch (error: any) {
                    message.error(`Failed to resume test: ${error.message}`);
                }
            }
        });
    };

    const handleDownloadCSV = async (testId: number, testName: string) => {
        try {
            const response = await api.get(`/api/test-execution/${testId}/export/csv`, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${testName}_report.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            message.success('CSV downloaded successfully');
        } catch (error: any) {
            message.error(`Failed to download CSV: ${error.message}`);
        }
    };

    const handleDownloadStatistics = async (testId: number, testName: string) => {
        try {
            const response = await api.get(`/api/test-execution/${testId}/export/statistics`, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${testName}_statistics.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            message.success('Statistics downloaded successfully');
        } catch (error: any) {
            message.error(`Failed to download statistics: ${error.message}`);
        }
    };

    const handleDeleteTest = (testId: number, testName: string) => {
        Modal.confirm({
            title: 'Delete Test',
            content: `Are you sure you want to delete test "${testName}"? This action cannot be undone.`,
            okText: 'Delete',
            okType: 'danger',
            cancelText: 'Cancel',
            onOk: async () => {
                try {
                    await api.delete(`/api/test/${testId}`);
                    message.success('Test deleted successfully');
                    fetchTests();
                } catch (error: any) {
                    message.error(`Failed to delete test: ${error.message}`);
                }
            }
        });
    };

    const getStatusTag = (status: string, canResume?: boolean) => {
        const statusConfig: { [key: string]: { color: string; icon: React.ReactNode } } = {
            completed: { color: "green", icon: <CheckCircleOutlined /> },
            in_progress: { color: "blue", icon: <ClockCircleOutlined /> },
            pending: { color: "orange", icon: <ClockCircleOutlined /> },
            failed: { color: "red", icon: <ExclamationCircleOutlined /> }
        };

        const config = statusConfig[status] || { color: "default", icon: null };

        return (
            <Space>
                <Tag color={config.color} icon={config.icon}>
                    {status.toUpperCase().replace("_", " ")}
                </Tag>
                {canResume && (
                    <Tag color="warning" icon={<PlayCircleOutlined />}>
                        CAN RESUME
                    </Tag>
                )}
            </Space>
        );
    };

    const expandedRowRender = (record: TestWithDetails) => {
        const details = record.details;

        if (!details) {
            return <div style={{ padding: 16 }}>Loading details...</div>;
        }

        const totalMeasurements = details.measurements?.length || 0;
        const successfulDetections = details.measurements?.filter((m: any) => m.detection_result === 'detected').length || 0;
        const successRate = totalMeasurements > 0 ? (successfulDetections / totalMeasurements * 100).toFixed(1) : '0.0';

        return (
            <div style={{ padding: 16 }}>
                {/* Statistics Cards */}
                <Row gutter={16} style={{ marginBottom: 16 }}>
                    <Col span={8}>
                        <Card size="small">
                            <Statistic
                                title="Total Measurements"
                                value={totalMeasurements}
                                valueStyle={{ color: '#1890ff' }}
                            />
                        </Card>
                    </Col>
                    <Col span={8}>
                        <Card size="small">
                            <Statistic
                                title="Successful Detections"
                                value={successfulDetections}
                                valueStyle={{ color: '#52c41a' }}
                            />
                        </Card>
                    </Col>
                    <Col span={8}>
                        <Card size="small">
                            <Statistic
                                title="Success Rate"
                                value={successRate}
                                suffix="%"
                                valueStyle={{ color: parseFloat(successRate) > 90 ? '#52c41a' : '#faad14' }}
                            />
                        </Card>
                    </Col>
                </Row>

                {/* Resume Info (if applicable) */}
                {record.can_resume && details.latestCheckpoint && (
                    <Card
                        size="small"
                        style={{ marginBottom: 16, backgroundColor: '#fff7e6', borderColor: '#ffa940' }}
                    >
                        <Space direction="vertical" style={{ width: '100%' }}>
                            <Text strong style={{ fontSize: 16 }}>
                                <PlayCircleOutlined /> Test Can Be Resumed
                            </Text>
                            <div>
                                <Text type="secondary">Last Phase: </Text>
                                <Text strong>{details.latestCheckpoint.current_phase}</Text>
                            </div>
                            <div>
                                <Text type="secondary">Progress: </Text>
                                <Text strong>
                                    {details.latestCheckpoint.completed_measurements} of {details.latestCheckpoint.total_measurements} measurements
                                </Text>
                            </div>
                            {record.interruption_reason && (
                                <div>
                                    <Text type="secondary">Reason: </Text>
                                    <Text type="danger">{record.interruption_reason}</Text>
                                </div>
                            )}
                        </Space>
                    </Card>
                )}

                {/* Detailed Results */}
                <Collapse>
                    {/* Radial Boundaries */}
                    {details.radialBoundaries?.length > 0 && (
                        <Panel header={`Radial Boundaries (${details.radialBoundaries.length})`} key="radial">
                            <Table
                                dataSource={details.radialBoundaries}
                                columns={[
                                    { title: "Distance (m)", dataIndex: "measurement1_2", key: "distance" },
                                    {
                                        title: "Verdict",
                                        dataIndex: "verdict1",
                                        key: "verdict",
                                        render: (verdict: number) => (
                                            <Tag color={verdict === 1 ? "green" : "red"}>
                                                {verdict === 1 ? "DETECTED" : "NOT DETECTED"}
                                            </Tag>
                                        )
                                    },
                                    { title: "Retry Count", dataIndex: "retry_count", key: "retry" },
                                    {
                                        title: "Measured At",
                                        dataIndex: "measured_at",
                                        key: "time",
                                        render: (time: string) => new Date(time).toLocaleString()
                                    }
                                ]}
                                pagination={false}
                                size="small"
                                rowKey={(record, index) => `radial-${index}`}
                            />
                        </Panel>
                    )}

                    {/* Tangential Boundaries */}
                    {details.tangentialBoundaries?.length > 0 && (
                        <Panel header={`Tangential Boundaries (${details.tangentialBoundaries.length})`} key="tangential">
                            <Table
                                dataSource={details.tangentialBoundaries}
                                columns={[
                                    { title: "Angle (°)", dataIndex: "angle", key: "angle" },
                                    { title: "Distance (m)", dataIndex: "measurement2m", key: "distance" },
                                    {
                                        title: "Verdict",
                                        dataIndex: "verdict2m",
                                        key: "verdict",
                                        render: (verdict: number) => (
                                            <Tag color={verdict === 1 ? "green" : "red"}>
                                                {verdict === 1 ? "DETECTED" : "NOT DETECTED"}
                                            </Tag>
                                        )
                                    },
                                    { title: "Retry Count", dataIndex: "retry_count", key: "retry" },
                                    {
                                        title: "Measured At",
                                        dataIndex: "measurement_time",
                                        key: "time",
                                        render: (time: string) => new Date(time).toLocaleString()
                                    }
                                ]}
                                pagination={false}
                                size="small"
                                rowKey={(record, index) => `tangential-${index}`}
                            />
                        </Panel>
                    )}

                    {/* All Measurements */}
                    {details.measurements?.length > 0 && (
                        <Panel header={`All Measurements (${details.measurements.length})`} key="measurements">
                            <Table
                                dataSource={details.measurements}
                                columns={[
                                    { title: "Type", dataIndex: "test_type", key: "type" },
                                    { title: "Angle (°)", dataIndex: "angle", key: "angle" },
                                    { title: "Distance (m)", dataIndex: "distance", key: "distance" },
                                    { title: "X", dataIndex: "robot_x", key: "x", render: (x: number) => x?.toFixed(2) },
                                    { title: "Y", dataIndex: "robot_y", key: "y", render: (y: number) => y?.toFixed(2) },
                                    {
                                        title: "Result",
                                        dataIndex: "detection_result",
                                        key: "result",
                                        render: (result: string) => (
                                            <Tag color={result === 'detected' ? "green" : result === 'not_detected' ? "red" : "orange"}>
                                                {result.toUpperCase().replace("_", " ")}
                                            </Tag>
                                        )
                                    },
                                    { title: "Attempt", dataIndex: "attempt_number", key: "attempt" }
                                ]}
                                pagination={{ pageSize: 10 }}
                                size="small"
                                scroll={{ x: 800 }}
                                rowKey="measurement_id"
                            />
                        </Panel>
                    )}
                </Collapse>
            </div>
        );
    };

    const columns = [
        {
            title: "Test ID",
            dataIndex: "test_id",
            key: "test_id",
            width: 100
        },
        {
            title: "Test Name",
            dataIndex: "test_name",
            key: "test_name",
            render: (text: string, record: TestWithDetails) => (
                <div>
                    <div style={{ fontWeight: 500 }}>{text}</div>
                    <div style={{ fontSize: 12, color: "#999" }}>
                        {record.test_choice?.test_name} • {record.sensor?.name}
                    </div>
                </div>
            )
        },
        {
            title: "Status",
            dataIndex: "status",
            key: "status",
            width: 180,
            render: (status: string, record: TestWithDetails) => getStatusTag(status, record.can_resume)
        },
        {
            title: "Date",
            dataIndex: "test_date",
            key: "test_date",
            width: 150,
            render: (date: Date) => date.toLocaleDateString()
        },
        {
            title: "Actions",
            key: "actions",
            width: 280,
            render: (_: any, record: TestWithDetails) => (
                <Space>
                    {record.can_resume ? (
                        <Button
                            type="primary"
                            icon={<PlayCircleOutlined />}
                            onClick={() => handleResumeTest(record)}
                            style={{ backgroundColor: '#fa8c16', borderColor: '#fa8c16' }}
                        >
                            Resume
                        </Button>
                    ) : (
                        <Button
                            icon={<EyeOutlined />}
                            onClick={() => handleViewTest(record.test_id)}
                        >
                            View
                        </Button>
                    )}
                    <Button
                        icon={<DownloadOutlined />}
                        onClick={() => handleDownloadCSV(record.test_id, record.test_name)}
                    >
                        CSV
                    </Button>
                    <Button
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleDeleteTest(record.test_id, record.test_name)}
                    >
                        Delete
                    </Button>
                </Space>
            )
        }
    ];

    return (
        <Layout style={{ minHeight: "100vh" }}>
            <Header style={{ background: "#fff", padding: "0 24px", display: "flex", alignItems: "center" }}>
                <Button type="text" icon={<LeftOutlined />} onClick={() => navigate(-1)}>
                    Back
                </Button>
                <Title level={3} style={{ margin: "0 0 0 16px" }}>
                    Test History
                </Title>
            </Header>
            <Content style={{ padding: 24 }}>
                <Card>
                    <Table
                        dataSource={tests}
                        columns={columns}
                        rowKey="test_id"
                        loading={loading}
                        expandable={{
                            expandedRowRender,
                            onExpand: handleExpand,
                            expandedRowKeys
                        }}
                        pagination={{ pageSize: 10 }}
                    />
                </Card>
            </Content>
        </Layout>
    );
}
