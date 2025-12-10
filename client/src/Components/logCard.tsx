import { Card, Flex, Typography, Tag } from "antd";

const { Text } = Typography;

type LogCardProps = {
    tag: string;
    information: string;
    tagColour: string;
    timestamp?: string;
};

export function LogCard({ tag, information, tagColour, timestamp }: LogCardProps) {
    const ts = timestamp
        ? new Date(timestamp)
        : new Date();

    const formatted = ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

    return (
        <Card
            hoverable={true}
            style={{
                backgroundColor: "rgb(250, 250, 250)"
            }}>
            <Flex gap="middle">
                <Text>{formatted}</Text>
                <Tag
                    color={tagColour}
                    style={{
                        borderRadius: "99px",
                    }}
                >
                    {tag}
                </Tag>
            </Flex>
            <Text>{information}</Text>
        </Card>
    );
}
