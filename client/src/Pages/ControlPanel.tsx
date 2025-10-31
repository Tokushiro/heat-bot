import { Layout, Row, Col, Typography, Button, Space, Tag, Dropdown, type MenuProps, Modal} from "antd";
import {ModeCard} from '../Components/modeCard.tsx';
import TestSelectionModal from "../Components/testSelectionModal.tsx";
import type {Test} from "../Types/test.ts"
import { RobotOutlined, ExperimentOutlined, LeftOutlined, HistoryOutlined, PlusOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import SensorInputModal from "../Components/sensorInputModal.tsx";
import TestChoiceInputModal from "../Components/testChoiceImputModal.tsx";
import { api } from "../Components/apiAxios.ts";

const { Header, Content } = Layout;
const { Title, Text } = Typography;

export default function ControlPanel() {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [openSensor, setOpenSensor] = useState(false);
    const [openTestChoice, setOpenTestChoice] = useState(false);
    const [modal2Open, setModal2Open] = useState(false);


    const plusMenuItems: MenuProps["items"] = [
        { key: "create-sensor", label: "Create Sensor" },
        { key: "create-test-details", label: "Create Test Details" },
    ];

    const handlePlusMenuClick: MenuProps["onClick"] = ({ key }) => {
        switch (key) {
            case "create-sensor":
                setOpenSensor(true);
                break;
            case "create-test-details":
                setOpenTestChoice(true);
                break;
        }
    };

    const chekcIfSensorExist = async () => {
        try {
            const response = await api.get('/api/sensors/exists');
            return response.data.exists;
            }
        catch (error) {
            console.error('Error checking sensor existence:', error);
            return false;
        }
    }

    const checkIfTestChoiceExist = async () => {
        try {
            const response = await api.get('/api/testchoice/exists');
            return response.data.exists;
            }
        catch (error) {
            console.error('Error checking test choice existence:', error);
            return false;
        }
    }


    return (
        <Layout>

            <TestSelectionModal
                open={open}
                onClose={() => setOpen(false)}
                onSubmit={async (values: Test) => {
                    setOpen(false);
                    navigate("/testingpattern1", { state: values });
                }}
            />

            <SensorInputModal
                open={openSensor}
                onClose={() => setOpenSensor(false)}
                onSubmit={async () => {
                    setOpenSensor(false);
                }}
            />
            <TestChoiceInputModal
                open={openTestChoice}
                onClose={() => setOpenTestChoice(false)}
                onSubmit={async () => {
                    setOpenTestChoice(false);
                }}
            />

            <Modal
                title="Information"
                centered
                open={modal2Open}
                onOk={() => setModal2Open(false)}
                onCancel={() => setModal2Open(false)}
            >
                <p>Sensor or Test details doesn't exist please create them</p>
                <p>You can do it by clicking plus button in the right top corner</p>

            </Modal>

            <Header
                style={{
                    position: "sticky",
                    top: 0,
                    zIndex: 10,
                    height: 56,
                    background: "#fff",
                    display: "flex",
                    alignItems: "center",
                    paddingInline: 24,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                }}
            >
                <div style={{ width: "33%", display: "flex", alignItems: "center" }}>
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
                        width: "34%",
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
                        <Text>RoboControl-X1</Text>
                        <Tag color="green" style={{ borderRadius: "99px" }}>
                            Connected
                        </Tag>
                    </Space>
                </div>

                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center" }}>
                    <Dropdown
                        trigger={["click"]}
                        placement="bottomRight"
                        menu={{ items: plusMenuItems, onClick: handlePlusMenuClick }}
                        arrow
                    >
                        <Button type="primary" shape="round" icon={<PlusOutlined />} />
                    </Dropdown>
                </div>
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
                                path="/manualcontrol"
                            />
                        </Col>

                        <Col xs={24} sm={12} md={8} lg={8} xl={7} xxl={6}>
                            <ModeCard
                                icon={<ExperimentOutlined />}
                                title="Start an new Test"
                                desc="Execute predefined testing sequences with monitoring"
                                customButton={
                                    <Button
                                        type="primary"
                                        block
                                        style={{ marginTop: 8, borderRadius: 8 }}
                                        onClick={async () => {
                                            const sensorExists = await chekcIfSensorExist();
                                            const testChoiceExists = await checkIfTestChoiceExist();
                                            if (sensorExists && testChoiceExists) {
                                                setOpen(true);
                                            } else {
                                                setModal2Open(true);
                                            }
                                        }}
                                    >
                                        Start Testing
                                    </Button>
                                }
                            />
                        </Col>

                        <Col xs={24} sm={12} md={8} lg={8} xl={7} xxl={6}>
                            <ModeCard
                                icon={<HistoryOutlined />}
                                title="History"
                                desc="Review past tests and download reports"
                                button="View History"
                                path="/history"
                            />
                        </Col>
                    </Row>
                </div>
            </Content>
        </Layout>
    );
}


