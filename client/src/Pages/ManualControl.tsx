import {
    Layout,
    Button,
    Space,
    Tag,
    Typography,
    Card,
    Row,
    Col,
    Statistic,
    List,
    message,
} from "antd";
import {
    LeftOutlined,
    UpOutlined,
    DownOutlined,
    LeftCircleOutlined,
    RightCircleOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { api } from "../Components/apiAxios";
import StandControl from "../Components/StandControl";

const { Text } = Typography;
const { Header, Content } = Layout;

type Direction = "up" | "down" | "left" | "right";

type EventLogItem = {
    id: string;
    timestamp: string;
    message: string;
    type: "info" | "warning" | "error" | "success";
};

type TelemetrySample = {
    telemetry_id?: number;
    test_id?: number;
    ambient_temp?: number;
    humidity?: number;
    head_temp_avg?: number;
    body_temp_avg?: number;
    legs_temp_avg?: number;
    detector_angle?: number;
    robot_position_x?: number;
    robot_position_y?: number;
    detection_active?: boolean;
    timestamp?: string;
};

type HeatingZoneStatus = {
    zone: string;
    currentTemp?: number;
    targetTemp?: number;
    enabled?: boolean;
};

export default function ManualControl() {
    const navigate = useNavigate();

    // State
    const [telemetry, setTelemetry] = useState<TelemetrySample | null>(null);
    const [eventLog, setEventLog] = useState<EventLogItem[]>([]);
    const [activeDir, setActiveDir] = useState<Direction | null>(null);
    const [heatingZones, setHeatingZones] = useState<HeatingZoneStatus[]>([]);

    // Add event to log
    const addEvent = useCallback((message: string, type: "info" | "warning" | "error" | "success" = "info") => {
        const event: EventLogItem = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            message,
            type
        };
        setEventLog(prev => [...prev, event]);
    }, []);

    // Subscribe to telemetry updates (SSE)
    useEffect(() => {
        const es = new EventSource("/api/telemetry/stream");

        es.addEventListener("telemetry", (event) => {
            try {
                const payload = JSON.parse((event as MessageEvent).data);
                // Telemetry events can be partial; merge to keep previously-known values.
                setTelemetry(prev => ({
                    ...(prev ?? {}),
                    ...payload
                }));
            } catch (err) {
                console.error("[ManualControl] Failed to parse telemetry:", err);
            }
        });

        es.onerror = () => {
            // Silent fail - SSE connection errors are normal when server is not running
        };

        return () => {
            es.close();
        };
    }, []);

    // Poll for heating zones status (read-only)
    useEffect(() => {
        const fetchHeatingStatus = async () => {
            try {
                const res = await api.get("/api/heating/status");
                if (res.data?.zones && Array.isArray(res.data.zones)) {
                    setHeatingZones(res.data.zones);
                }
            } catch (err) {
                // Silent fail
            }
        };

        fetchHeatingStatus();
        const interval = setInterval(fetchHeatingStatus, 5000);

        return () => clearInterval(interval);
    }, []);

    // Movement handlers - using continuous movement API
    const handleMove = async (direction: Direction) => {
        setActiveDir(direction);
        try {
            // Start continuous movement
            await api.post("/api/robot/move", {
                direction,
                action: "start"
            });
            addEvent(`Moving ${direction}`, "success");
        } catch (error) {
            console.error(`Failed to move ${direction}:`, error);
            addEvent(`Failed to move ${direction}`, "error");
            message.error(`Failed to move ${direction}`);
        }
    };

    const handleMoveStop = async (direction: Direction) => {
        try {
            // Stop continuous movement
            await api.post("/api/robot/move", {
                direction,
                action: "stop"
            });
            setActiveDir(null);
        } catch (error) {
            console.error(`Failed to stop ${direction}:`, error);
            setActiveDir(null);
        }
    };

    const handleStop = async () => {
        try {
            await api.post("/api/robot/stop");
            setActiveDir(null);
            addEvent("Robot stopped", "warning");
            message.success("Robot stopped");
        } catch (error) {
            console.error("Failed to stop:", error);
            addEvent("Failed to stop robot", "error");
            message.error("Failed to stop");
        }
    };

    return (
        <Layout style={{ minHeight: "100vh" }}>
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
                                borderRadius: 4,
                            }}
                        />
                        <Text>Manual Control</Text>
                        <Tag color="green" style={{ borderRadius: 999 }}>
                            Connected
                        </Tag>
                    </Space>
                </div>

                <div style={{ flex: 1 }} />
            </Header>

            <Content style={{ height: "calc(100vh - 56px)", overflow: "auto", padding: "20px", background: "#f5f5f5" }}>
                <Row gutter={16}>
                    {/* LEFT PANEL: Controls */}
                    <Col xs={24} md={8} lg={6}>
                        {/* Drive Controls */}
                        <Card title="Robot Controls" style={{ marginBottom: 16 }}>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                                {/* D-pad */}
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                                    <Button
                                        type={activeDir === "up" ? "primary" : "default"}
                                        icon={<UpOutlined />}
                                        onMouseDown={() => handleMove("up")}
                                        onMouseUp={() => handleMoveStop("up")}
                                        onMouseLeave={() => activeDir === "up" && handleMoveStop("up")}
                                        size="large"
                                    >
                                        Forward
                                    </Button>
                                    <div style={{ display: "flex", gap: 5 }}>
                                        <Button
                                            type={activeDir === "left" ? "primary" : "default"}
                                            icon={<LeftCircleOutlined />}
                                            onMouseDown={() => handleMove("left")}
                                            onMouseUp={() => handleMoveStop("left")}
                                            onMouseLeave={() => activeDir === "left" && handleMoveStop("left")}
                                            size="large"
                                        >
                                            Left
                                        </Button>
                                        <Button
                                            type={activeDir === "right" ? "primary" : "default"}
                                            icon={<RightCircleOutlined />}
                                            onMouseDown={() => handleMove("right")}
                                            onMouseUp={() => handleMoveStop("right")}
                                            onMouseLeave={() => activeDir === "right" && handleMoveStop("right")}
                                            size="large"
                                        >
                                            Right
                                        </Button>
                                    </div>
                                    <Button
                                        type={activeDir === "down" ? "primary" : "default"}
                                        icon={<DownOutlined />}
                                        onMouseDown={() => handleMove("down")}
                                        onMouseUp={() => handleMoveStop("down")}
                                        onMouseLeave={() => activeDir === "down" && handleMoveStop("down")}
                                        size="large"
                                    >
                                        Backward
                                    </Button>
                                </div>

                                {/* Stop Button */}
                                <Button
                                    danger
                                    block
                                    onClick={handleStop}
                                    size="large"
                                    style={{ marginTop: 10 }}
                                >
                                    EMERGENCY STOP
                                </Button>
                            </div>
                        </Card>

                        {/* Heating Status (Read-Only) */}
                        <Card title="Heating Status" style={{ marginBottom: 16 }}>
                            <Space direction="vertical" style={{ width: "100%" }}>
                                {heatingZones.length > 0 ? (
                                    heatingZones.map((zone) => (
                                        <div key={zone.zone}>
                                            <Text strong>{zone.zone}:</Text>{" "}
                                            <Text>
                                                {zone.currentTemp?.toFixed(1) || "-"}°C
                                            </Text>
                                            {zone.targetTemp !== undefined && (
                                                <Text type="secondary">
                                                    {" "}(Target: {zone.targetTemp}°C)
                                                </Text>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <Text type="secondary">No heating data available</Text>
                                )}
                            </Space>
                        </Card>

                        {/* Stand Control */}
                        <Card title="Stand Control">
                            <StandControl />
                        </Card>
                    </Col>

                    {/* CENTER PANEL: Live View & Telemetry */}
                    <Col xs={24} md={16} lg={12}>
                        {/* Position Visual */}
                        <Card title="Robot Position" style={{ marginBottom: 16 }}>
                            <div
                                style={{
                                    width: "100%",
                                    height: 300,
                                    background: "#f0f0f0",
                                    position: "relative",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    border: "1px solid #d9d9d9",
                                    borderRadius: 4
                                }}
                            >
                                {/* Sensor at center */}
                                <div
                                    style={{
                                        position: "absolute",
                                        top: "50%",
                                        left: "50%",
                                        transform: "translate(-50%, -50%)",
                                        width: 20,
                                        height: 20,
                                        background: "#ff4d4f",
                                        borderRadius: "50%",
                                        border: "2px solid #000"
                                    }}
                                    title="Sensor (0, 0)"
                                />

                                {/* Robot position indicator */}
                                {telemetry?.robot_position_x !== undefined && telemetry?.robot_position_y !== undefined && (
                                    <div
                                        style={{
                                            position: "absolute",
                                            top: `${50 - (telemetry.robot_position_y * 20)}%`,
                                            left: `${50 + (telemetry.robot_position_x * 20)}%`,
                                            transform: "translate(-50%, -50%)",
                                            width: 30,
                                            height: 30,
                                            background: "#1890ff",
                                            borderRadius: "50%",
                                            border: "3px solid #000"
                                        }}
                                        title={`Robot (${telemetry.robot_position_x.toFixed(2)}, ${telemetry.robot_position_y.toFixed(2)})`}
                                    />
                                )}

                                {/* Grid lines */}
                                <svg
                                    style={{
                                        position: "absolute",
                                        top: 0,
                                        left: 0,
                                        width: "100%",
                                        height: "100%",
                                        pointerEvents: "none"
                                    }}
                                >
                                    {/* Vertical center line */}
                                    <line x1="50%" y1="0" x2="50%" y2="100%" stroke="#ccc" strokeWidth="1" />
                                    {/* Horizontal center line */}
                                    <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#ccc" strokeWidth="1" />
                                </svg>
                            </div>
                            <div style={{ textAlign: "center", marginTop: 10 }}>
                                <Text strong>Position: </Text>
                                <Text>
                                    ({telemetry?.robot_position_x?.toFixed(2) || "0.00"}m,{" "}
                                    {telemetry?.robot_position_y?.toFixed(2) || "0.00"}m)
                                </Text>
                            </div>
                        </Card>

                        {/* Live Telemetry */}
                        <Card title="Live Telemetry">
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Statistic
                                        title="Ambient Temperature"
                                        value={telemetry?.ambient_temp?.toFixed(1) || "-"}
                                        suffix="°C"
                                    />
                                </Col>
                                <Col span={12}>
                                    <Statistic
                                        title="Humidity"
                                        value={telemetry?.humidity?.toFixed(1) || "-"}
                                        suffix="%"
                                    />
                                </Col>
                                <Col span={12} style={{ marginTop: 16 }}>
                                    <Statistic
                                        title="Head Temperature"
                                        value={telemetry?.head_temp_avg?.toFixed(1) || "-"}
                                        suffix="°C"
                                    />
                                </Col>
                                <Col span={12} style={{ marginTop: 16 }}>
                                    <Statistic
                                        title="Body Temperature"
                                        value={telemetry?.body_temp_avg?.toFixed(1) || "-"}
                                        suffix="°C"
                                    />
                                </Col>
                            </Row>
                        </Card>
                    </Col>

                    {/* RIGHT PANEL: Status & Events */}
                    <Col xs={24} md={24} lg={6}>
                        {/* Robot Status */}
                        <Card title="Robot Status" style={{ marginBottom: 16 }}>
                            <Space direction="vertical" style={{ width: "100%" }}>
                                <div>
                                    <Text type="secondary">Position X:</Text>{" "}
                                    <Text strong>{telemetry?.robot_position_x?.toFixed(2) || "0.00"}m</Text>
                                </div>
                                <div>
                                    <Text type="secondary">Position Y:</Text>{" "}
                                    <Text strong>{telemetry?.robot_position_y?.toFixed(2) || "0.00"}m</Text>
                                </div>
                                <div>
                                    <Text type="secondary">Detection:</Text>{" "}
                                    <Tag color={telemetry?.detection_active ? "green" : "default"}>
                                        {telemetry?.detection_active ? "ACTIVE" : "Inactive"}
                                    </Tag>
                                </div>
                            </Space>
                        </Card>

                        {/* Sensor Status */}
                        <Card title="Sensor Status" style={{ marginBottom: 16 }}>
                            <Space direction="vertical" style={{ width: "100%" }}>
                                <div>
                                    <Text type="secondary">Temperature:</Text>{" "}
                                    <Text strong>{telemetry?.ambient_temp?.toFixed(1) || "-"}°C</Text>
                                </div>
                                <div>
                                    <Text type="secondary">Humidity:</Text>{" "}
                                    <Text strong>{telemetry?.humidity?.toFixed(1) || "-"}%</Text>
                                </div>
                                <div>
                                    <Text type="secondary">Detector Angle:</Text>{" "}
                                    <Text strong>{telemetry?.detector_angle?.toFixed(0) || "-"}°</Text>
                                </div>
                            </Space>
                        </Card>

                        {/* Event Log */}
                        <Card title="Event Log">
                            <div style={{ maxHeight: 300, overflow: "auto" }}>
                                <List
                                    size="small"
                                    dataSource={eventLog.slice(-20).reverse()}
                                    renderItem={event => (
                                        <List.Item>
                                            <div style={{ width: "100%" }}>
                                                <div>
                                                    <Tag
                                                        color={
                                                            event.type === "error" ? "red" :
                                                            event.type === "warning" ? "orange" :
                                                            event.type === "success" ? "green" : "blue"
                                                        }
                                                    >
                                                        {event.type.toUpperCase()}
                                                    </Tag>
                                                </div>
                                                <Text style={{ fontSize: 12 }}>
                                                    {new Date(event.timestamp).toLocaleTimeString()}: {event.message}
                                                </Text>
                                            </div>
                                        </List.Item>
                                    )}
                                />
                            </div>
                        </Card>
                    </Col>
                </Row>
            </Content>
        </Layout>
    );
}
