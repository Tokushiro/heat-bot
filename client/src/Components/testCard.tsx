import { Card, Row, Col, Typography, Tag, Space, Button, Popconfirm } from "antd";
import type {Test} from "../Types/test.ts"

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
        <Card hoverable size="small" style={{ width: "100%", borderRadius: 12 }} bodyStyle={{ padding: 16 }}>
            <Row align="middle" gutter={[16, 16]}>
                {/* Left: name + meta */}
                <Col xs={24} md={14}>
                    <Space direction="vertical" size={0} style={{ width: "100%" }}>
                        <Typography.Text strong style={{ fontSize: 16 }}>
                            {test.test_name}
                        </Typography.Text>
                        <Typography.Text type="secondary">
                            Created: {formatDate(test.test_date)}
                        </Typography.Text>
                    </Space>
                </Col>


                {/* Middle: status */}
                <Col xs={12} md={4}>
                    <Tag color={isComplete ? "green" : "red"} style={{ borderRadius: 999, textTransform: "capitalize" }}>
                        {test.status}
                    </Tag>
                </Col>


                {/* Right: actions */}
                <Col xs={12} md={6} style={{ display: "flex", justifyContent: "flex-end" }}>
                    <Space>
                        <Button type="primary" onClick={onContinue}>Continue</Button>
                        <Popconfirm title="Delete this test?" description="This action cannot be undone." okText="Delete" okButtonProps={{ danger: true }} onConfirm={onDelete}>
                            <Button danger>Delete</Button>
                        </Popconfirm>
                    </Space>
                </Col>
            </Row>
        </Card>
    );
}