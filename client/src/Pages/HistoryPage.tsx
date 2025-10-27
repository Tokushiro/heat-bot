import { useNavigate} from "react-router-dom";
import { Layout, Typography, Button, Space, Tag} from "antd";
import { LeftOutlined } from "@ant-design/icons";

const { Header, Content } = Layout;
const { Text, Title } = Typography;

export default function HistoryPage(){
    const navigate = useNavigate()


    return(
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
            <Content>
            <Title level={2} style={{ textAlign: "center", marginBottom: 4 }}>
                Look over all tests performed
            </Title>
            </Content>

        </Layout>
        )

}