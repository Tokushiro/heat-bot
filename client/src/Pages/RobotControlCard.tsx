import { Card, Avatar, Typography, Button, Tag } from "antd";
import { RobotOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";


const { Title, Text } = Typography;

export default function RobotControlCard() {
    const navigate = useNavigate();
    return (
        <div
            style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100vh",
                background: "#f5f6f7",
            }}
        >
            <Card
                style={{
                    width: 320,
                    textAlign: "center",
                    borderRadius: "12px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                }}
            >
                <Avatar
                    size={48}
                    icon={<RobotOutlined />}
                    style={{ backgroundColor: "#e6f4ff", marginBottom: 16 }}
                />
                <Title level={4}>Robot Control Interface</Title>

                <Tag color="green" style={{ marginBottom: 8 }}>
                    Connected
                </Tag>

                <Text>Connected to robot:</Text>
                <br />
                <Text strong style={{ color: "#1677ff" }}>
                    RoboControl-X1
                </Text>

                <Button
                    type="primary"
                    block
                    style={{ marginTop: 16, borderRadius: "6px" }}
                    onClick={() => navigate("/controlpanel")}
                >
                    Open Control Panel
                </Button>
            </Card>
        </div>
    );
}
