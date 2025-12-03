import {Layout, Button, Space, Tag, Typography, Flex, Card, Divider} from "antd";
import { LeftOutlined } from "@ant-design/icons";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import type {Test} from "../Types/test.ts"
import type {TestDB} from "../Components/testCard.tsx";
import {LogCard} from '../Components/logCard.tsx';

const {Text, Title} = Typography;
const { Header, Content } = Layout;

export default function TestingPattern1() {
    const navigate = useNavigate();
    const { state } = useLocation();
    const data = state as Test | undefined | TestDB;
    if (!data) return <Navigate to="/controlpanel" replace />;

    // FIX: Get status with proper typing
    const status = data.status ?? 'PLANNED';
    const isCompleted = status === 'COMPLETED';
    const isInProgress = status === 'IN_PROGRESS';

    // FIX: Determine tag color based on actual status
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
                }}>
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

                <div
                    style={{
                        position: "absolute",
                        left: "50%",
                        transform: "translateX(-50%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <Space>
                        <div
                            style={{
                                background: "#1677ff",
                                color: "#fff",
                                padding: "4px",
                                height: "20px",
                                width: "20px",
                            }}
                        />
                        <Text> RoboControl-X1</Text>

                        <Tag color={getStatusColor()} style={{ borderRadius: "99px" }}>
                            {getStatusDisplay()}
                        </Tag>
                    </Space>
                </div>

                <div style={{ flex: 1, display: "flex", justifyContent: "right" }}>
                    <Space>
                        <Button
                            color="primary"
                            variant="solid"
                            disabled={isCompleted || isInProgress}
                        >
                            {isInProgress ? 'Running' : isCompleted ? 'Completed' : 'Start'}
                        </Button>
                        <Button
                            color="red"
                            variant="solid"
                            disabled={!isInProgress}
                        >
                            Stop
                        </Button>
                    </Space>
                </div>
            </Header>
            <Content
                style={{
                    height:'100vh'
                }}>
                <div
                    style={{
                        flex: 1 ,
                        textAlign: "center",
                    }}>
                    <Title level={2}>{data.test_name}</Title>
                    <Text>Monitor robot performance and communication logs in real-time</Text>
                </div>
                <br/>
                <Flex gap={"middle"} justify={"center"} align={"center"}>
                    <Card
                        style={{ width: "80vh", height: "80vh", overflow: "hidden" }}
                        bodyStyle={{ height: "100%", display: "flex", flexDirection: "column" }}
                    >
                        <Title level={5} style={{ marginBottom: 0 }}>
                            Robot Communication & Movement Log
                        </Title>
                        <Divider style={{ margin: "12px 0" }} />

                        <div
                            style={{
                                flex: 1,
                                minHeight: 0,
                                overflowY: "auto",
                                paddingRight: 8,
                            }}
                        >
                            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                                <LogCard tag="info" information={`Test ${data.test_name} created`} tagColour="blue" />
                            </Space>
                        </div>
                    </Card>

                    <Card
                        style={{ width: "80vh", height: "80vh", overflow: "hidden" }}
                        bodyStyle={{ height: "100%", display: "flex", flexDirection: "column" }}
                    >
                        <Title level={5} style={{ marginBottom: 0 }}>
                            Real time robot path monitoring on grid
                        </Title>
                        <Divider style={{ margin: "12px 0" }} />


                        <div
                            style={{
                                flex: 1,
                                minHeight: 0,
                                overflow: "hidden",
                                background: "#f0f2f5",
                                borderRadius: 8,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 500,
                                letterSpacing: 0.3,
                                userSelect: "none",
                            }}
                        >
                            Robot Path Monitoring Grid Placeholder
                        </div>

                        <Divider style={{ margin: "12px 0" }} />

                        <Flex>
                            <Text>Battery 15%</Text>
                        </Flex>
                    </Card>
                </Flex>

            </Content>

        </Layout>

    )

}