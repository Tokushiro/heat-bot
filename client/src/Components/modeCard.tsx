import {Card, Space, Avatar, Typography, Button} from "antd";
import {useNavigate} from "react-router-dom";

const { Title, Text } = Typography;

export function ModeCard({
                      icon,
                      title,
                      desc,
                      button,
                      path, customButton,
                  }: {
    icon: React.ReactNode;
    title: string;
    desc: string;
    button?: string;
    path?: string;
    customButton?: React.ReactNode;
}) {

    const navigate = useNavigate();
    return (
        <Card
            hoverable
            style={{ height: "100%", borderRadius: 12, boxShadow: "0 6px 18px rgba(0,0,0,0.06)" }}
            styles={{ body: { padding: 24 } }}
        >
            <Space direction="vertical" size="middle" style={{ width: "100%" }} align="center">
                <Avatar size={48} icon={icon} style={{ background: "#e6f4ff" }} />
                <Title level={4} style={{ marginBottom: 4 }}>{title}</Title>
                <Text type="secondary" style={{ textAlign: "center" }}>{desc}</Text>

                {customButton ? (
                    customButton
                ) : (
                    <Button
                        type="primary"
                        block
                        style={{ marginTop: 8, borderRadius: 8 }}
                        onClick={() => navigate(path ?? "/")}
                    >
                        {button}
                    </Button>
                )}
            </Space>
        </Card>
    );
}

