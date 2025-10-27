import { Card, Row, Col, Typography, Tag, Space, Button, Popconfirm } from "antd";
import type { Test } from "../Types/test.ts";

export type TestDB = Test & { status: "complete" | "incomplete" };

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
    const isComplete = test.status === "complete";

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
                        <Typography.Text type="secondary">Created: {formatDate(test.test_date)}</Typography.Text>
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
                            color={isComplete ? "green" : "red"}
                            style={{ borderRadius: 999, padding: "2px 10px", textTransform: "capitalize", fontWeight: 500 }}
                        >
                            {test.status}
                        </Tag>


                        <Button type="primary" onClick={onContinue} shape="round">
                            Continue
                        </Button>


                        <Button onClick={() => console.log("CSV Download") } shape="round">
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
