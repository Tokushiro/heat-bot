import { useNavigate } from "react-router-dom";
import { Layout, Typography, Button, Space, Tag, Empty } from "antd";
import { LeftOutlined } from "@ant-design/icons";
import { useMemo, useState } from "react";
import TestCard, { type TestDB } from "../Components/testCard.tsx"
import type {Test} from "../Types/test.ts"

const { Header, Content } = Layout;
const { Text, Title } = Typography;


export default function HistoryPage() {
    const navigate = useNavigate();

    const baseURL = useMemo(() => "http://localhost:3000", []);

    // Example data; replace with your DB data
    const initialItems: TestDB[] = useMemo(
        () => [
            {
                test_id: 1,
                test_name: "Thermal Drift Characterization",
                test_choice: 2,
                sensor_id: 11,
                test_date: new Date(Date.now() - 1000 * 60 * 60 * 2),
                status: "complete",
            },
            {
                test_id: 2,
                test_name: "Sensor Array Calibration",
                test_choice: 1,
                sensor_id: 14,
                test_date: new Date(Date.now() - 1000 * 60 * 60 * 26),
                status: "incomplete",
            },
            {
                test_id: 3,
                test_name: "Motor PID Sweep",
                test_choice: 1,
                sensor_id: 18,
                test_date: new Date(Date.now() - 1000 * 60 * 8),
                status: "incomplete",
            },
        ],
        []
    );

    const [items, setItems] = useState<TestDB[]>(initialItems);

    const handleDelete = (id: number | null) => {
        setItems(prev => prev.filter(x => x.test_id !== id));
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
                        <Text> RoboControl-X1</Text>
                        <Tag color="green" style={{ borderRadius: 999 }}>Connected</Tag>
                    </Space>
                </div>

                <div style={{ flex: 1 }} />
            </Header>

            {/* Scrollable content area */}
            <Content
                style={{
                    height: "calc(100vh - 56px)",
                    overflow: "auto",
                    background: "#f5f5f5",
                }}
            >
                <Title level={2} style={{ textAlign: "center", marginBottom: 16 }}>
                    Test History
                </Title>
                <div style={{ maxWidth: 960, margin: "0 auto", padding: 16 }}>
                    {items.length === 0 && (
                        <Empty description="No history yet" />
                    )}

                    <Space direction="vertical" size={12} style={{ width: "100%" }}>
                        {items.map(item => (
                            <TestCard
                                key={item.test_id ?? `test-${item.test_name}`}
                                test={item}
                                onContinue={() => navigate(`/tests/${item.test_id ?? "new"}/continue`)}
                                onDelete={() => handleDelete(item.test_id)}
                            />
                        ))}
                    </Space>
                </div>
            </Content>
        </Layout>
    );
}

