import {Layout, Button, Space, Tag, Typography, Flex, Card} from "antd";
import { LeftOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";

const {Text, Title} = Typography;
const { Header, Content } = Layout;

export default function TestingPattern1() {
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
                        <Tag color="purple"
                        style={{
                            borderRadius: "99px",
                        }}
                        >Testing Pattern 1</Tag>
                    </Space>
                </div>

                <div style={{ flex: 1 }} />
                <div style={{ flex: 1 , display: "flex", justifyContent: "right" }}>
                    <Space>
                        <Button
                        color="primary" variant="solid">
                            Start
                        </Button>
                        <Button
                        color="red" variant="solid">
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
                <Title level={2}>Testing Pattern 1</Title>
                <Text>Monitor robot performance and communication logs in real-time</Text>
                </div>
                <br/>
                <Flex gap={"middle"} justify={"center"} align={"center"}>
                    <Card
                        style={{
                            width: "80vh",
                            height:"80vh"
                    }}>
                        <Title></Title>

                    </Card>
                    <Card
                        style={{
                        width: "80vh",
                        height:"80vh"
                    }}>

                    </Card>
                </Flex>

            </Content>

        </Layout>

    )

}