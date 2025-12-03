import { Card, Row, Col, Typography, Tag, Space, Button, Popconfirm } from "antd";
import type { Test } from "../Types/test.ts";

export type TestDB = Test;

export type TestCardProps = {
    test: TestDB;
    onContinue: () => void;
    onDelete: () => void;
    isDeleting?: boolean;
};

function formatDate(d: Date) {
    try {
        const date = d instanceof Date ? d : new Date(d);
        return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    } catch {
        return String(d);
    }
}

export default function TestCard({ test, onContinue, onDelete, isDeleting = false }: TestCardProps) {
    const status = test.status ?? 'PLANNED';
    const isComplete = status === 'COMPLETED';
    const isInProgress = status === 'IN_PROGRESS';
    //const isError = status === 'ERROR';
    const isPaused = status === 'PAUSED';

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
            style={{
                width: "100%",
                borderRadius: 16,
                boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
                opacity: isDeleting ? 0.6 : 1,
                transition: "opacity 0.3s"
            }}
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

                {/* Right: status + actions */}
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
                            disabled={isDeleting}
                        >
                            {isComplete ? 'View' : isInProgress || isPaused ? 'Resume' : 'Start'}
                        </Button>

                        <Button
                            onClick={() => console.log("CSV Download", test.test_id)}
                            shape="round"
                            disabled={!isComplete || isDeleting}
                        >
                            CSV
                        </Button>

                        <Popconfirm
                            title="Delete this test?"
                            description="This will permanently delete the test and all associated data. This action cannot be undone."
                            okText="Delete"
                            cancelText="Cancel"
                            okButtonProps={{ danger: true, loading: isDeleting }}
                            onConfirm={onDelete}
                            disabled={isDeleting}
                        >
                            <Button
                                danger
                                shape="round"
                                loading={isDeleting}
                                disabled={isDeleting}
                            >
                                {isDeleting ? 'Deleting...' : 'Delete'}
                            </Button>
                        </Popconfirm>
                    </div>
                </Col>
            </Row>
        </Card>
    );
}