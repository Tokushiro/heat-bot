import { useEffect, useMemo, useRef, useState } from "react";
import {
    Badge,
    Button,
    Card,
    Col,
    Divider,
    Form,
    Input,
    InputNumber,
    List,
    Row,
    Space,
    Tag,
    Typography,
    message,
} from "antd";
import {
    LinkOutlined,
    PoweroffOutlined,
    SendOutlined,
    ClearOutlined,
    ThunderboltOutlined,
    SyncOutlined,
} from "@ant-design/icons";
import { api } from "../Components/apiAxios.ts";

const { Title, Text } = Typography;

type StatusEvent = { connected: boolean; reason?: string; error?: string };
type DataEvent = { line: string };

type LogItem = {
    id: string;
    kind: "in" | "out" | "status";
    text: string;
    ts: string;
};

function nowHHMMSS() {
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function SerialTestPage() {
    const [form] = Form.useForm<{ path: string; baudRate: number }>();
    const [connected, setConnected] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [sending, setSending] = useState(false);
    const [cmd, setCmd] = useState("conn");
    const [logs, setLogs] = useState<LogItem[]>([]);
    const logEndRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const savedPath = localStorage.getItem("serial.path") ?? "/dev/ttyACM0";
        const savedBaud = Number(localStorage.getItem("serial.baud") ?? "115200");
        form.setFieldsValue({ path: savedPath, baudRate: savedBaud });
    }, [form]);

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs.length]);

    // 🔄 SSE Stream
    useEffect(() => {
        const es = new EventSource("/api/serial/stream");

        const onStatus = (e: MessageEvent) => {
            const payload = JSON.parse(e.data) as StatusEvent;
            setConnected(payload.connected);
            setLogs((prev) => [
                ...prev,
                {
                    id: crypto.randomUUID(),
                    kind: "status",
                    text:
                        payload.connected
                            ? "Connected"
                            : `Disconnected${payload.reason ? ` (${payload.reason})` : ""}${
                                payload.error ? ` — ${payload.error}` : ""
                            }`,
                    ts: nowHHMMSS(),
                },
            ]);
        };

        const onData = (e: MessageEvent) => {
            const { line } = JSON.parse(e.data) as DataEvent;
            setLogs((prev) => [
                ...prev,
                { id: crypto.randomUUID(), kind: "in", text: line, ts: nowHHMMSS() },
            ]);
        };

        es.addEventListener("status", onStatus as EventListener);
        es.addEventListener("data", onData as EventListener);

        return () => {
            es.removeEventListener("status", onStatus as EventListener);
            es.removeEventListener("data", onData as EventListener);
            es.close();
        };
    }, []);

    const connect = async () => {
        try {
            const { path, baudRate } = await form.validateFields();
            localStorage.setItem("serial.path", path);
            localStorage.setItem("serial.baud", String(baudRate));

            setConnecting(true);
            const { data } = await api.post("/api/serial/connect", { path, baudRate });
            if (data?.ok === false) throw new Error(data?.error || "Connection failed");

            message.success("Connected successfully");
        } catch (err: any) {
            message.error(err?.message ?? "Failed to connect");
            setLogs((prev) => [
                ...prev,
                {
                    id: crypto.randomUUID(),
                    kind: "status",
                    text: `Connect error: ${String(err?.message ?? err)}`,
                    ts: nowHHMMSS(),
                },
            ]);
        } finally {
            setConnecting(false);
        }
    };

    const disconnect = async () => {
        try {
            const { data } = await api.post("/api/serial/disconnect");
            if (data?.ok === false) throw new Error(data?.error || "Disconnect failed");
            message.success("Disconnected successfully");
        } catch (err: any) {
            message.error(err?.message ?? "Failed to disconnect");
        }
    };

    const send = async () => {
        if (!cmd.trim()) return;
        setSending(true);
        try {
            const { data } = await api.post("/api/serial/send", { cmd });
            if (data?.ok === false) throw new Error(data?.error || "Send failed");
            setLogs((prev) => [
                ...prev,
                { id: crypto.randomUUID(), kind: "out", text: cmd, ts: nowHHMMSS() },
            ]);
            setCmd("");
        } catch (err: any) {
            message.error(err?.message ?? "Failed to send command");
        } finally {
            setSending(false);
        }
    };

    const clearLogs = () => setLogs([]);

    const statusBadge = useMemo(
        () => (
            <Space align="center">
                <Badge
                    status={connected ? "success" : "default"}
                    text={<Text strong>{connected ? "Connected" : "Disconnected"}</Text>}
                />
                {connecting && <SyncOutlined spin />}
            </Space>
        ),
        [connected, connecting]
    );

    return (
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <Title level={3} style={{ marginBottom: 0 }}>
                Serial Connection Test
            </Title>
            <Text type="secondary">
                Test robot serial connection via API bridge (USB through server).
            </Text>

            <Row gutter={[16, 16]}>
                {/* Connection settings */}
                <Col xs={24} md={12}>
                    <Card title="Connection" extra={statusBadge} bodyStyle={{ paddingBottom: 16 }}>
                        <Form
                            form={form}
                            layout="vertical"
                            initialValues={{ path: "/dev/ttyACM0", baudRate: 115200 }}
                        >
                            <Form.Item
                                label="Port Path"
                                name="path"
                                rules={[{ required: true, message: "Please enter serial port path" }]}
                            >
                                <Input placeholder="/dev/ttyACM0 or COM3" allowClear />
                            </Form.Item>
                            <Form.Item
                                label="Baud Rate"
                                name="baudRate"
                                rules={[{ required: true, message: "Please enter baud rate" }]}
                            >
                                <InputNumber style={{ width: "100%" }} min={1200} max={1000000} step={100} />
                            </Form.Item>
                            <Space wrap>
                                <Button
                                    type="primary"
                                    icon={<LinkOutlined />}
                                    onClick={connect}
                                    loading={connecting}
                                    disabled={connected}
                                >
                                    Connect
                                </Button>
                                <Button
                                    danger
                                    icon={<PoweroffOutlined />}
                                    onClick={disconnect}
                                    disabled={!connected}
                                >
                                    Disconnect
                                </Button>
                            </Space>
                        </Form>
                    </Card>
                </Col>

                {/* Command sender */}
                <Col xs={24} md={12}>
                    <Card title="Send Command" bodyStyle={{ paddingBottom: 16 }}>
                        <Space.Compact style={{ width: "100%" }}>
                            <Input
                                placeholder='Type a command (e.g., "conn" or "forward 100")'
                                value={cmd}
                                onChange={(e) => setCmd(e.target.value)}
                                onPressEnter={send}
                                disabled={!connected}
                            />
                            <Button
                                type="primary"
                                icon={<SendOutlined />}
                                onClick={send}
                                loading={sending}
                                disabled={!connected || !cmd.trim()}
                            >
                                Send
                            </Button>
                        </Space.Compact>

                        <Divider style={{ margin: "16px 0" }} />

                        <Space wrap>
                            <Button icon={<ThunderboltOutlined />} onClick={() => setCmd("conn")}>
                                conn
                            </Button>
                            <Button onClick={() => setCmd("forward 100")}>forward 100</Button>
                            <Button onClick={() => setCmd("back 100")}>back 100</Button>
                            <Button onClick={() => setCmd("stop")}>stop</Button>
                        </Space>
                    </Card>
                </Col>
            </Row>

            {/* Logs */}
            <Card
                title="Live Log"
                extra={
                    <Space>
                        <Tag color={connected ? "green" : "default"}>
                            {connected ? "Connected" : "Idle"}
                        </Tag>
                        <Button icon={<ClearOutlined />} onClick={clearLogs}>
                            Clear
                        </Button>
                    </Space>
                }
                bodyStyle={{ paddingTop: 8 }}
            >
                <List
                    size="small"
                    dataSource={logs}
                    renderItem={(item) => (
                        <List.Item style={{ padding: "6px 0" }}>
                            <Space size="small">
                                <Text type="secondary" style={{ width: 66 }}>
                                    {item.ts}
                                </Text>
                                {item.kind === "in" && <Tag color="blue">IN</Tag>}
                                {item.kind === "out" && <Tag color="gold">OUT</Tag>}
                                {item.kind === "status" && <Tag>STATUS</Tag>}
                                <Text style={{ whiteSpace: "pre-wrap" }}>{item.text}</Text>
                            </Space>
                        </List.Item>
                    )}
                />
                <div ref={logEndRef} />
            </Card>
        </Space>
    );
}
