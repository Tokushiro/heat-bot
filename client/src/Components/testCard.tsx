import { Card, Row, Col, Typography, Tag, Space, Button, Popconfirm } from "antd";
import type { Test } from "../Types/test.ts";

// Remove the old TestDB type definition since Test now includes status
export type TestDB = Test;

export type TestCardProps = {
    test: TestDB;
    onContinue: () => void;
    onDelete: () => void;
};

function formatDate(d: Date) {
    try {
        const date = d instanceof Date ? d : new Date(d);
        return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    } catch {
        return String(d);
    }
}

export default function TestCard({ test, onContinue, onDelete }: TestCardProps) {
    // FIX: Use the actual status values from the database
    const status = test.status ?? 'PLANNED';
    const isComplete = status === 'COMPLETED';
    const isInProgress = status === 'IN_PROGRESS';
    //const isError = status === 'ERROR';
    const isPaused = status === 'PAUSED';

    // Determine tag color based on status
    const getStatusColor = () => {
        switch (status) {
            case 'COMPLETED':
                return 'green';
            case 'IN_PROGRESS':
                return 'blue';
            case 'ERROR':
                return 'red';
            case 'PAUSED':
                return 'orange';
            case 'PLANNED':
            default:
                return 'default';
        }
    };

    // Format status for display
    const getStatusDisplay = () => {
        switch (status) {
            case 'IN_PROGRESS':
                return 'In Progress';
            case 'COMPLETED':
                return 'Completed';
            case 'ERROR':
                return 'Error';
            case 'PAUSED':
                return 'Paused';
            case 'PLANNED':
            default:
                return 'Planned';
        }
    };

    return (
        <Card
            hoverable
            size="small"
            style={{ width: "100%", borderRadius: 16, boxShadow: "0 8px 24px rgba(0,0,0,0.06)" }}
            bodyStyle={{ padding: 20 }}
        >
            <Row align="middle" gutter={[16, 12]}>
                {/* Left: name + meta */}
                <Col xs={24} md={12}>
                    <Space direction="vertical" size={2} style={{ width: "100%" }}>
                        <Typography.Text strong style={{ fontSize: 18 }} ellipsis>
                            {test.test_name || "Untitled test"}
                        </Typography.Text>
                        <Typography.Text type="secondary">
                            Created: {formatDate(test.test_date)}
                        </Typography.Text>
                        {test.started_at && (
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                Started: {formatDate(new Date(test.started_at))}
                            </Typography.Text>
                        )}
                        {test.finished_at && (
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                Finished: {formatDate(new Date(test.finished_at))}
                            </Typography.Text>
                        )}
                    </Space>
                </Col>


                {/* Right: status + actions (right-aligned, wraps nicely on small screens) */}
                <Col xs={24} md={12}>
                    <div
                        style={{
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            gap: 8,
                            flexWrap: "wrap",
                        }}
                    >
                        <Tag
                            color={getStatusColor()}
                            style={{
                                borderRadius: 999,
                                padding: "2px 10px",
                                textTransform: "capitalize",
                                fontWeight: 500
                            }}
                        >
                            {getStatusDisplay()}
                        </Tag>


                        <Button
                            type="primary"
                            onClick={onContinue}
                            shape="round"
                            disabled={isComplete} // Optionally disable if completed
                        >
                            {isComplete ? 'View' : isInProgress || isPaused ? 'Resume' : 'Start'}
                        </Button>


                        <Button
                            onClick={() => console.log("CSV Download")}
                            shape="round"
                            disabled={!isComplete} // Only enable CSV for completed tests
                        >
                            CSV
                        </Button>


                        <Popconfirm
                            title="Delete this test?"
                            description="This action cannot be undone."
                            okText="Delete"
                            okButtonProps={{ danger: true }}
                            onConfirm={onDelete}
                        >
                            <Button danger shape="round">Delete</Button>
                        </Popconfirm>
                    </div>
                </Col>
            </Row>
        </Card>
    );
}