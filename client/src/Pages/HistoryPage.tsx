import { useNavigate } from "react-router-dom";
import { Layout, Typography, Button, Space, Tag, Empty, message } from "antd";
import { LeftOutlined } from "@ant-design/icons";
import TestCard, { type TestDB } from "../Components/testCard.tsx";
import { useEffect, useState } from "react";
import type {Test} from "../Types/test.ts";
import { api } from "../Components/apiAxios.ts";

const { Header, Content } = Layout;
const { Text, Title } = Typography;


export default function HistoryPage() {
    const navigate = useNavigate();

    const [items, setItems] = useState<TestDB[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState<number | null>(null);

    useEffect(() => {
        fetchTests();
    }, []);

    const fetchTests = async () => {
        try {
            setLoading(true);
            const res = await api.get<Test[]>(`/api/test`);
            const opts: TestDB[] = res.data.map((s) => ({
                test_id: s.test_id,
                test_name: s.test_name,
                test_choice: s.test_choice,
                sensor_id: s.sensor_id,
                test_date: new Date(s.test_date),
                status: s.status ?? 'PLANNED',
                started_at: s.started_at,
                finished_at: s.finished_at,
            }));
            setItems(opts);
        } catch (err: unknown) {
            console.error("Error fetching tests:", err);
            message.error("Failed to load test history");
        } finally {
            setLoading(false);
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
            message.error(
                err?.response?.data?.error ?? "Failed to delete test. Please try again."
            );
        } finally {
            setDeleting(null);
        }
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
                    {loading ? (
                        <div style={{ textAlign: "center", padding: "40px 0" }}>
                            <Typography.Text type="secondary">Loading tests...</Typography.Text>
                        </div>
                    ) : items.length === 0 ? (
                        <Empty description="No history yet" />
                    ) : (
                        <Space direction="vertical" size={12} style={{ width: "100%" }}>
                            {items.map(item => (
                                <TestCard
                                    key={item.test_id ?? `test-${item.test_name}`}
                                    test={item}
                                    onContinue={() => navigate("/testingpattern1", { state: item })}
                                    onDelete={() => handleDelete(item.test_id)}
                                    isDeleting={deleting === item.test_id}
                                />
                            ))}
                        </Space>
                    )}
                </div>
            </Content>
        </Layout>
    );
}