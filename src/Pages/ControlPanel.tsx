import { Layout, Row, Col, Typography, Button, Space, Tag} from "antd";
import {ModeCard} from '../Components/modeCard.tsx';
import { RobotOutlined, ExperimentOutlined, LeftOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";

const { Header, Content } = Layout;
const { Title, Text } = Typography;

export default function ControlPanel() {
    const navigate = useNavigate();
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
                                width: "20px"
                            }}
                        >
                        </div>
                        <Text> RoboControl-X1</Text>
                        <Tag color="green"
                             style={{
                                 borderRadius: "99px",
                             }}
                        >Connected</Tag>
                    </Space>
                </div>

                <div style={{ flex: 1 }} />
            </Header>

            <Content style={{ background: "#f5f6f7" }}>
                <div
                    style={{
                        maxWidth: 1280,
                        margin: "0 auto",
                        padding: "32px 24px",
                        minHeight: "calc(100vh - 56px)",
                    }}
                >
                    <Title level={2} style={{ textAlign: "center", marginBottom: 4 }}>
                        Robot Control Panel
                    </Title>
                    <Text type="secondary" style={{ display: "block", textAlign: "center", marginBottom: 24 }}>
                        Choose a control mode to operate your robot
                    </Text>

                    <Row gutter={[24, 24]} justify="center">
                        <Col xs={24} sm={12} md={8} lg={8} xl={7} xxl={6}>
                            <ModeCard
                                icon={<RobotOutlined />}
                                title="Manual Control"
                                desc="Direct control of robot movements and actions"
                                button="Start Manual Control"
                                path="/controlpanel"
                            />
                        </Col>

                        <Col xs={24} sm={12} md={8} lg={8} xl={7} xxl={6}>
                            <ModeCard
                                icon={<ExperimentOutlined />}
                                title="Testing Pattern 1"
                                desc="Execute predefined testing sequence with monitoring"
                                button="Start Pattern 1"
                                path="/testingpattern1"
                            />
                        </Col>

                        <Col xs={24} sm={12} md={8} lg={8} xl={7} xxl={6}>
                            <ModeCard
                                icon={<ExperimentOutlined />}
                                title="Testing Pattern 2"
                                desc="Advanced testing sequence with detailed analytics"
                                button="Start Pattern 2"
                                path="/testingpattern2"
                            />
                        </Col>
                    </Row>
                </div>
            </Content>
        </Layout>
    );
}


