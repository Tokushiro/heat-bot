import React, { useState, useEffect } from 'react';
import { Card, Select, Row, Col, Statistic, Table, Button, message, Tabs, Space, Alert } from 'antd';
import {
    LineChartOutlined,
    BarChartOutlined,
    DotChartOutlined,
    ReloadOutlined,
    SwapOutlined
} from '@ant-design/icons';
import '../Styles/TestAnalysis.css';

const { Option } = Select;
const { TabPane } = Tabs;

interface Test {
    test_id: number;
    test_name: string;
    test_status: string;
    start_time: string;
}

interface AngularStatistic {
    angle: number;
    avgDistance: number;
    stdDev: number;
    minDistance: number;
    maxDistance: number;
    detectionRate: number;
    measurementCount: number;
    confidenceInterval95: { lower: number; upper: number };
}

interface DetectionProbability {
    distance: number;
    probability: number;
}

interface TestComparison {
    test1: { testId: number; testName: string };
    test2: { testId: number; testName: string };
    boundaryDifference: {
        avgDifference: number;
        maxDifference: number;
        correlationCoefficient: number;
        significantDifferences: Array<{ angle: number; difference: number }>;
    };
    performanceMetrics: {
        test1Duration: number;
        test2Duration: number;
        test1DetectionRate: number;
        test2DetectionRate: number;
    };
}

interface TrendAnalysis {
    testIds: number[];
    testDates: string[];
    avgBoundaryTrend: Array<{ date: string; avgBoundary: number }>;
    detectionRateTrend: Array<{ date: string; detectionRate: number }>;
    durationTrend: Array<{ date: string; durationMinutes: number }>;
    trendDirection: 'IMPROVING' | 'DECLINING' | 'STABLE';
    recommendations: string[];
}

interface OutlierAnalysis {
    outlierCount: number;
    outlierPercentage: number;
    outlierAngles: number[];
    recommendation: string;
}

const TestAnalysis: React.FC = () => {
    const [tests, setTests] = useState<Test[]>([]);
    const [selectedTest, setSelectedTest] = useState<number | null>(null);
    const [angularStats, setAngularStats] = useState<AngularStatistic[]>([]);
    const [detectionProb, setDetectionProb] = useState<DetectionProbability[]>([]);
    const [outlierAnalysis, setOutlierAnalysis] = useState<OutlierAnalysis | null>(null);

    // Comparison state
    const [selectedTest1, setSelectedTest1] = useState<number | null>(null);
    const [selectedTest2, setSelectedTest2] = useState<number | null>(null);
    const [comparison, setComparison] = useState<TestComparison | null>(null);

    // Trend analysis state
    const [selectedTests, setSelectedTests] = useState<number[]>([]);
    const [trendAnalysis, setTrendAnalysis] = useState<TrendAnalysis | null>(null);

    const [loading, setLoading] = useState(false);

    // Fetch available tests
    useEffect(() => {
        fetchTests();
    }, []);

    const fetchTests = async () => {
        try {
            const response = await fetch('/api/test/all');
            if (response.ok) {
                const data = await response.json();
                setTests(data.filter((t: Test) => t.test_status === 'COMPLETED'));
            }
        } catch (error) {
            console.error('Error fetching tests:', error);
            message.error('Failed to load tests');
        }
    };

    // Fetch angular statistics
    const fetchAngularStatistics = async (testId: number) => {
        setLoading(true);
        try {
            const response = await fetch(`/api/analysis/angular/${testId}`);
            if (response.ok) {
                const data = await response.json();
                setAngularStats(data.statistics);
                message.success('Angular statistics loaded');
            } else {
                message.error('Failed to load angular statistics');
            }
        } catch (error) {
            console.error('Error fetching angular statistics:', error);
            message.error('Failed to load angular statistics');
        } finally {
            setLoading(false);
        }
    };

    // Fetch detection probability
    const fetchDetectionProbability = async (testId: number) => {
        setLoading(true);
        try {
            const response = await fetch(`/api/analysis/detection-probability/${testId}`);
            if (response.ok) {
                const data = await response.json();
                setDetectionProb(data.analysis.probabilityCurve);
                message.success('Detection probability analysis loaded');
            } else {
                message.error('Failed to load detection probability');
            }
        } catch (error) {
            console.error('Error fetching detection probability:', error);
            message.error('Failed to load detection probability');
        } finally {
            setLoading(false);
        }
    };

    // Fetch outlier analysis
    const fetchOutlierAnalysis = async (testId: number) => {
        setLoading(true);
        try {
            const response = await fetch(`/api/analysis/outliers/${testId}`);
            if (response.ok) {
                const data = await response.json();
                setOutlierAnalysis(data);
                message.success('Outlier analysis loaded');
            } else {
                message.error('Failed to load outlier analysis');
            }
        } catch (error) {
            console.error('Error fetching outlier analysis:', error);
            message.error('Failed to load outlier analysis');
        } finally {
            setLoading(false);
        }
    };

    // Fetch test comparison
    const fetchTestComparison = async () => {
        if (!selectedTest1 || !selectedTest2) {
            message.warning('Please select two tests to compare');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`/api/analysis/compare/${selectedTest1}/${selectedTest2}`);
            if (response.ok) {
                const data = await response.json();
                setComparison(data);
                message.success('Test comparison loaded');
            } else {
                message.error('Failed to compare tests');
            }
        } catch (error) {
            console.error('Error comparing tests:', error);
            message.error('Failed to compare tests');
        } finally {
            setLoading(false);
        }
    };

    // Fetch trend analysis
    const fetchTrendAnalysis = async () => {
        if (selectedTests.length < 2) {
            message.warning('Please select at least 2 tests for trend analysis');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('/api/analysis/trends', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ testIds: selectedTests })
            });
            if (response.ok) {
                const data = await response.json();
                setTrendAnalysis(data);
                message.success('Trend analysis loaded');
            } else {
                message.error('Failed to analyze trends');
            }
        } catch (error) {
            console.error('Error analyzing trends:', error);
            message.error('Failed to analyze trends');
        } finally {
            setLoading(false);
        }
    };

    // Handle test selection
    const handleTestSelect = (testId: number) => {
        setSelectedTest(testId);
        fetchAngularStatistics(testId);
        fetchDetectionProbability(testId);
        fetchOutlierAnalysis(testId);
    };

    // Angular statistics table columns
    const angularColumns = [
        {
            title: 'Angle (°)',
            dataIndex: 'angle',
            key: 'angle',
            sorter: (a: AngularStatistic, b: AngularStatistic) => a.angle - b.angle
        },
        {
            title: 'Avg Distance (m)',
            dataIndex: 'avgDistance',
            key: 'avgDistance',
            render: (value: number) => value.toFixed(3)
        },
        {
            title: 'Std Dev (m)',
            dataIndex: 'stdDev',
            key: 'stdDev',
            render: (value: number) => value.toFixed(3)
        },
        {
            title: 'Min (m)',
            dataIndex: 'minDistance',
            key: 'minDistance',
            render: (value: number) => value.toFixed(3)
        },
        {
            title: 'Max (m)',
            dataIndex: 'maxDistance',
            key: 'maxDistance',
            render: (value: number) => value.toFixed(3)
        },
        {
            title: 'Detection Rate',
            dataIndex: 'detectionRate',
            key: 'detectionRate',
            render: (value: number) => `${(value * 100).toFixed(1)}%`,
            sorter: (a: AngularStatistic, b: AngularStatistic) => a.detectionRate - b.detectionRate
        },
        {
            title: '95% CI',
            key: 'ci',
            render: (_: any, record: AngularStatistic) =>
                `${record.confidenceInterval95.lower.toFixed(3)} - ${record.confidenceInterval95.upper.toFixed(3)}`
        }
    ];

    // Detection probability table columns
    const probColumns = [
        {
            title: 'Distance (m)',
            dataIndex: 'distance',
            key: 'distance',
            render: (value: number) => value.toFixed(2),
            sorter: (a: DetectionProbability, b: DetectionProbability) => a.distance - b.distance
        },
        {
            title: 'Detection Probability',
            dataIndex: 'probability',
            key: 'probability',
            render: (value: number) => `${(value * 100).toFixed(1)}%`,
            sorter: (a: DetectionProbability, b: DetectionProbability) => a.probability - b.probability
        }
    ];

    return (
        <div className="test-analysis-page">
            <Card title="Test Analysis & Comparison" extra={<Button icon={<ReloadOutlined />} onClick={fetchTests}>Refresh</Button>}>
                <Tabs defaultActiveKey="single">
                    <TabPane tab={<span><DotChartOutlined />Single Test Analysis</span>} key="single">
                        <Space direction="vertical" style={{ width: '100%' }} size="large">
                            <Select
                                style={{ width: '100%' }}
                                placeholder="Select a test to analyze"
                                onChange={handleTestSelect}
                                loading={loading}
                            >
                                {tests.map(test => (
                                    <Option key={test.test_id} value={test.test_id}>
                                        {test.test_name} - {new Date(test.start_time).toLocaleString()}
                                    </Option>
                                ))}
                            </Select>

                            {selectedTest && angularStats.length > 0 && (
                                <>
                                    <Row gutter={16}>
                                        <Col span={6}>
                                            <Card>
                                                <Statistic
                                                    title="Angles Analyzed"
                                                    value={angularStats.length}
                                                    suffix="angles"
                                                />
                                            </Card>
                                        </Col>
                                        <Col span={6}>
                                            <Card>
                                                <Statistic
                                                    title="Avg Detection Rate"
                                                    value={(angularStats.reduce((sum, s) => sum + s.detectionRate, 0) / angularStats.length * 100).toFixed(1)}
                                                    suffix="%"
                                                />
                                            </Card>
                                        </Col>
                                        <Col span={6}>
                                            <Card>
                                                <Statistic
                                                    title="Avg Boundary"
                                                    value={(angularStats.reduce((sum, s) => sum + s.avgDistance, 0) / angularStats.length).toFixed(3)}
                                                    suffix="m"
                                                />
                                            </Card>
                                        </Col>
                                        <Col span={6}>
                                            <Card>
                                                <Statistic
                                                    title="Avg Std Dev"
                                                    value={(angularStats.reduce((sum, s) => sum + s.stdDev, 0) / angularStats.length).toFixed(3)}
                                                    suffix="m"
                                                />
                                            </Card>
                                        </Col>
                                    </Row>

                                    <Card title="Angular Statistics">
                                        <Table
                                            dataSource={angularStats}
                                            columns={angularColumns}
                                            rowKey="angle"
                                            pagination={{ pageSize: 10 }}
                                            size="small"
                                        />
                                    </Card>

                                    {detectionProb.length > 0 && (
                                        <Card title="Detection Probability Analysis">
                                            <Table
                                                dataSource={detectionProb}
                                                columns={probColumns}
                                                rowKey="distance"
                                                pagination={{ pageSize: 10 }}
                                                size="small"
                                            />
                                        </Card>
                                    )}

                                    {outlierAnalysis && (
                                        <Card title="Outlier Analysis">
                                            <Row gutter={16}>
                                                <Col span={8}>
                                                    <Statistic
                                                        title="Outlier Count"
                                                        value={outlierAnalysis.outlierCount}
                                                        suffix={`/ ${outlierAnalysis.outlierPercentage.toFixed(1)}%`}
                                                    />
                                                </Col>
                                                <Col span={16}>
                                                    <Alert
                                                        message="Recommendation"
                                                        description={outlierAnalysis.recommendation}
                                                        type={outlierAnalysis.outlierPercentage > 10 ? 'warning' : 'info'}
                                                        showIcon
                                                    />
                                                </Col>
                                            </Row>
                                            {outlierAnalysis.outlierAngles.length > 0 && (
                                                <div style={{ marginTop: 16 }}>
                                                    <strong>Outlier Angles:</strong> {outlierAnalysis.outlierAngles.join('°, ')}°
                                                </div>
                                            )}
                                        </Card>
                                    )}
                                </>
                            )}
                        </Space>
                    </TabPane>

                    <TabPane tab={<span><SwapOutlined />Test Comparison</span>} key="compare">
                        <Space direction="vertical" style={{ width: '100%' }} size="large">
                            <Row gutter={16}>
                                <Col span={11}>
                                    <Select
                                        style={{ width: '100%' }}
                                        placeholder="Select first test"
                                        onChange={setSelectedTest1}
                                    >
                                        {tests.map(test => (
                                            <Option key={test.test_id} value={test.test_id}>
                                                {test.test_name}
                                            </Option>
                                        ))}
                                    </Select>
                                </Col>
                                <Col span={2} style={{ textAlign: 'center' }}>
                                    <Button
                                        type="primary"
                                        icon={<SwapOutlined />}
                                        onClick={fetchTestComparison}
                                        loading={loading}
                                        disabled={!selectedTest1 || !selectedTest2}
                                    >
                                        Compare
                                    </Button>
                                </Col>
                                <Col span={11}>
                                    <Select
                                        style={{ width: '100%' }}
                                        placeholder="Select second test"
                                        onChange={setSelectedTest2}
                                    >
                                        {tests.map(test => (
                                            <Option key={test.test_id} value={test.test_id}>
                                                {test.test_name}
                                            </Option>
                                        ))}
                                    </Select>
                                </Col>
                            </Row>

                            {comparison && (
                                <>
                                    <Card title="Boundary Differences">
                                        <Row gutter={16}>
                                            <Col span={6}>
                                                <Statistic
                                                    title="Average Difference"
                                                    value={comparison.boundaryDifference.avgDifference.toFixed(3)}
                                                    suffix="m"
                                                />
                                            </Col>
                                            <Col span={6}>
                                                <Statistic
                                                    title="Max Difference"
                                                    value={comparison.boundaryDifference.maxDifference.toFixed(3)}
                                                    suffix="m"
                                                />
                                            </Col>
                                            <Col span={6}>
                                                <Statistic
                                                    title="Correlation"
                                                    value={comparison.boundaryDifference.correlationCoefficient.toFixed(3)}
                                                />
                                            </Col>
                                            <Col span={6}>
                                                <Statistic
                                                    title="Significant Differences"
                                                    value={comparison.boundaryDifference.significantDifferences.length}
                                                    suffix="angles"
                                                />
                                            </Col>
                                        </Row>
                                    </Card>

                                    <Card title="Performance Comparison">
                                        <Row gutter={16}>
                                            <Col span={12}>
                                                <Card type="inner" title={comparison.test1.testName}>
                                                    <Statistic
                                                        title="Duration"
                                                        value={comparison.performanceMetrics.test1Duration.toFixed(1)}
                                                        suffix="min"
                                                    />
                                                    <Statistic
                                                        title="Detection Rate"
                                                        value={(comparison.performanceMetrics.test1DetectionRate * 100).toFixed(1)}
                                                        suffix="%"
                                                    />
                                                </Card>
                                            </Col>
                                            <Col span={12}>
                                                <Card type="inner" title={comparison.test2.testName}>
                                                    <Statistic
                                                        title="Duration"
                                                        value={comparison.performanceMetrics.test2Duration.toFixed(1)}
                                                        suffix="min"
                                                    />
                                                    <Statistic
                                                        title="Detection Rate"
                                                        value={(comparison.performanceMetrics.test2DetectionRate * 100).toFixed(1)}
                                                        suffix="%"
                                                    />
                                                </Card>
                                            </Col>
                                        </Row>
                                    </Card>

                                    {comparison.boundaryDifference.significantDifferences.length > 0 && (
                                        <Card title="Significant Differences">
                                            <Table
                                                dataSource={comparison.boundaryDifference.significantDifferences}
                                                columns={[
                                                    {
                                                        title: 'Angle (°)',
                                                        dataIndex: 'angle',
                                                        key: 'angle',
                                                        sorter: (a, b) => a.angle - b.angle
                                                    },
                                                    {
                                                        title: 'Difference (m)',
                                                        dataIndex: 'difference',
                                                        key: 'difference',
                                                        render: (value: number) => value.toFixed(3)
                                                    }
                                                ]}
                                                rowKey="angle"
                                                pagination={false}
                                                size="small"
                                            />
                                        </Card>
                                    )}
                                </>
                            )}
                        </Space>
                    </TabPane>

                    <TabPane tab={<span><LineChartOutlined />Trend Analysis</span>} key="trends">
                        <Space direction="vertical" style={{ width: '100%' }} size="large">
                            <Select
                                mode="multiple"
                                style={{ width: '100%' }}
                                placeholder="Select tests for trend analysis (min 2)"
                                onChange={setSelectedTests}
                            >
                                {tests.map(test => (
                                    <Option key={test.test_id} value={test.test_id}>
                                        {test.test_name} - {new Date(test.start_time).toLocaleDateString()}
                                    </Option>
                                ))}
                            </Select>

                            <Button
                                type="primary"
                                icon={<BarChartOutlined />}
                                onClick={fetchTrendAnalysis}
                                loading={loading}
                                disabled={selectedTests.length < 2}
                            >
                                Analyze Trends
                            </Button>

                            {trendAnalysis && (
                                <>
                                    <Alert
                                        message={`Trend Direction: ${trendAnalysis.trendDirection}`}
                                        description={trendAnalysis.recommendations.join(' ')}
                                        type={
                                            trendAnalysis.trendDirection === 'IMPROVING' ? 'success' :
                                            trendAnalysis.trendDirection === 'DECLINING' ? 'warning' : 'info'
                                        }
                                        showIcon
                                    />

                                    <Card title="Average Boundary Trend">
                                        <Table
                                            dataSource={trendAnalysis.avgBoundaryTrend}
                                            columns={[
                                                {
                                                    title: 'Date',
                                                    dataIndex: 'date',
                                                    key: 'date',
                                                    render: (value: string) => new Date(value).toLocaleDateString()
                                                },
                                                {
                                                    title: 'Avg Boundary (m)',
                                                    dataIndex: 'avgBoundary',
                                                    key: 'avgBoundary',
                                                    render: (value: number) => value.toFixed(3)
                                                }
                                            ]}
                                            pagination={false}
                                            size="small"
                                        />
                                    </Card>

                                    <Card title="Detection Rate Trend">
                                        <Table
                                            dataSource={trendAnalysis.detectionRateTrend}
                                            columns={[
                                                {
                                                    title: 'Date',
                                                    dataIndex: 'date',
                                                    key: 'date',
                                                    render: (value: string) => new Date(value).toLocaleDateString()
                                                },
                                                {
                                                    title: 'Detection Rate',
                                                    dataIndex: 'detectionRate',
                                                    key: 'detectionRate',
                                                    render: (value: number) => `${(value * 100).toFixed(1)}%`
                                                }
                                            ]}
                                            pagination={false}
                                            size="small"
                                        />
                                    </Card>

                                    <Card title="Duration Trend">
                                        <Table
                                            dataSource={trendAnalysis.durationTrend}
                                            columns={[
                                                {
                                                    title: 'Date',
                                                    dataIndex: 'date',
                                                    key: 'date',
                                                    render: (value: string) => new Date(value).toLocaleDateString()
                                                },
                                                {
                                                    title: 'Duration (min)',
                                                    dataIndex: 'durationMinutes',
                                                    key: 'durationMinutes',
                                                    render: (value: number) => value.toFixed(1)
                                                }
                                            ]}
                                            pagination={false}
                                            size="small"
                                        />
                                    </Card>
                                </>
                            )}
                        </Space>
                    </TabPane>
                </Tabs>
            </Card>
        </div>
    );
};

export default TestAnalysis;
