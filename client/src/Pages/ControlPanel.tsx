import { Layout, Row, Col, Typography, Button, Space, Tag} from "antd";
import {ModeCard} from '../Components/modeCard.tsx';
import TestSelectionModal, {type TestSelectionValues} from "../Components/testSelectionModal.tsx";
import { RobotOutlined, ExperimentOutlined, LeftOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

const { Header, Content } = Layout;
const { Title, Text } = Typography;

export default function ControlPanel() {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);

    return (
        <Layout>

            <TestSelectionModal
                open={open}
                onClose={() => setOpen(false)}
                initialValues={{ testType: "testPattern1"}}
                onSubmit={async (values: TestSelectionValues) => {
                    setOpen(false);
                    navigate("/testingpattern1", { state: values });
                }}
            />

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
                                title="Start Testing"
                                desc="Execute predefined testing sequences with monitoring"
                                customButton={
                                    <Button
                                    type="primary"
                                    block
                                    style={{ marginTop: 8, borderRadius: 8 }}
                                    onClick={() => setOpen(true)}
                                    >
                                        Start Testing
                                    </Button>
                                }
                            />
                        </Col>

                        <Col xs={24} sm={12} md={8} lg={8} xl={7} xxl={6}>
                            <ModeCard
                                icon={<ExperimentOutlined />}
                                title="History"
                                desc="Review past tests and download reports"
                                button="View History"
                                path="/testingpattern2"
                            />
                        </Col>
                    </Row>
                </div>
            </Content>
        </Layout>
    );
}


