import {
    Layout,
    Button,
    Space,
    Tag,
    Typography,
    Flex,
    Card,
    Divider,
    Row,
    Col,
    Statistic,
    Tabs,
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
import { useEffect, useState, useCallback, useRef } from "react";
import type React from "react";
import { LogCard } from "../Components/logCard";
import { api } from "../Components/apiAxios";
import HeatingZoneControl from "../Components/HeatingZoneControl";
import StandControl from "../Components/StandControl";

const { Text, Title } = Typography;
const { Header, Content } = Layout;

type Direction = "up" | "down" | "left" | "right";

type LogItem = {
    id: string;
    tag: "info" | "warning" | "error" | "success";
    information: string;
    tagColour:
        | "blue"
        | "geekblue"
        | "green"
        | "red"
        | "orange"
        | "purple"
        | "cyan"
        | "gold";
    timestamp: string;
};

type TelemetrySample = {
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

type StandStatus = {
    connected?: boolean;
    initialized?: boolean;
    currentAngle?: number;
    isMoving?: boolean;
};

type HeatingZoneStatus = {
    zone: string;
    currentTemp?: number;
    targetTemp?: number;
    enabled?: boolean;
};

const robotEventTypes = [
    "connected",
    "manual_control_started",
    "manual_control_stopped",
    "manual_move_command",
    "manual_move_result",
    "movement_started",
    "movement_completed",
    "movement_failed",
    "movement_stopped",
    "robot_initialized",
    "robot_error",
];

const tagToColour: Record<LogItem["tag"], LogItem["tagColour"]> = {
    info: "geekblue",
    warning: "orange",
    error: "red",
    success: "green",
};

const mapRobotEventToLog = (type: string, data: any): LogItem | null => {
    const timestamp =
        typeof data?.timestamp === "string"
            ? data.timestamp
            : new Date().toISOString();

    const direction = data?.direction ? ` (${data.direction})` : "";

    // Suppress noisy duplicates: commands and movement_stopped are covered by move_result
    if (type === "manual_move_command" || type === "movement_stopped") {
        return null;
    }

    switch (type) {
        case "connected":
            return {
                id: crypto.randomUUID(),
                tag: "info",
                tagColour: tagToColour.info,
                information: "Robot event stream connected",
                timestamp,
            };
        case "manual_control_started":
            return {
                id: crypto.randomUUID(),
                tag: "success",
                tagColour: tagToColour.success,
                information: "Manual control armed",
                timestamp,
            };
        case "manual_control_stopped":
            return {
                id: crypto.randomUUID(),
                tag: "warning",
                tagColour: tagToColour.warning,
                information: "Manual control disarmed",
                timestamp,
            };
        case "manual_move_command":
            return {
                id: crypto.randomUUID(),
                tag: "info",
                tagColour: tagToColour.info,
                information: `Manual move command${direction}`,
                timestamp,
            };
        case "manual_move_result": {
            if (data?.action === "start") return null; // rely on movement_started/completed instead
            const success = data?.success !== false;
            const pos =
                data?.position && data.position.x !== undefined && data.position.y !== undefined
                    ? ` @ (${data.position.x.toFixed(2)}, ${data.position.y.toFixed(2)})`
                    : "";
            return {
                id: crypto.randomUUID(),
                tag: success ? "success" : "error",
                tagColour: success ? tagToColour.success : tagToColour.error,
                information: `${data?.action === "stop" ? "Manual stop" : "Manual move"}${direction}${success ? "" : " failed"}${pos}`,
                timestamp,
            };
        }
        case "movement_started": {
            const target =
                data?.target && data.target.x !== undefined && data.target.y !== undefined
                    ? ` -> (${Number(data.target.x).toFixed(2)}, ${Number(data.target.y).toFixed(2)})`
                    : "";
            return {
                id: crypto.randomUUID(),
                tag: "info",
                tagColour: tagToColour.info,
                information: `Robot movement started${target}`,
                timestamp,
            };
        }
        case "movement_completed": {
            const pos =
                data?.position && data.position.x !== undefined && data.position.y !== undefined
                    ? ` at (${Number(data.position.x).toFixed(2)}, ${Number(data.position.y).toFixed(2)})`
                    : "";
            return {
                id: crypto.randomUUID(),
                tag: "success",
                tagColour: tagToColour.success,
                information: `Movement completed${pos}`,
                timestamp,
            };
        }
        case "movement_failed":
            return {
                id: crypto.randomUUID(),
                tag: "error",
                tagColour: tagToColour.error,
                information: `Movement failed${direction}`,
                timestamp,
            };
        case "movement_stopped": {
            const pos =
                data?.position && data.position.x !== undefined && data.position.y !== undefined
                    ? ` at (${Number(data.position.x).toFixed(2)}, ${Number(data.position.y).toFixed(2)})`
                    : "";
            return {
                id: crypto.randomUUID(),
                tag: "warning",
                tagColour: tagToColour.warning,
                information: `Movement stopped${pos}`,
                timestamp,
            };
        }
        case "robot_initialized":
            return {
                id: crypto.randomUUID(),
                tag: "success",
                tagColour: tagToColour.success,
                information: "Robot initialized",
                timestamp,
            };
        case "robot_error":
            return {
                id: crypto.randomUUID(),
                tag: "error",
                tagColour: tagToColour.error,
                information: data?.error ? String(data.error) : "Robot error",
                timestamp,
            };
        default:
            return null;
    }
};

export default function ManualControl() {
    const navigate = useNavigate();

    // ---------------- Logs ----------------
    const [logs, setLogs] = useState<LogItem[]>([]);

    const appendLog = useCallback((item: LogItem) => {
        setLogs((prev) => [...prev, item]);
    }, []);

    // Auto-scroll logs to bottom when new log appears
    const logListRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        const el = logListRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    }, [logs]);

    // --------------- Telemetry (live SSE) ---------------
    const [latestTelemetry, setLatestTelemetry] = useState<TelemetrySample | null>(null);
    const [polling, setPolling] = useState<boolean>(false);
    const [armed, setArmed] = useState<boolean>(false);
    const [homing, setHoming] = useState<boolean>(false);
    // Reserved for future stand control feature
    const [_standStatus, setStandStatus] = useState<StandStatus | null>(null);
    // Reserved for future heating control feature
    const [_heatingZones, setHeatingZones] = useState<HeatingZoneStatus[]>([]);
    // Reserved for future stand control feature
    const [_targetAngle, setTargetAngle] = useState<number>(0);

    useEffect(() => {
        const es = new EventSource("/api/telemetry/stream");

        es.addEventListener("telemetry", (event) => {
            try {
                const data = JSON.parse((event as MessageEvent).data);
                setLatestTelemetry(data);
            } catch (err) {
                console.error("Failed to parse telemetry event", err);
            }
        });

        es.onerror = (err) => {
            console.error("Telemetry SSE error", err);
        };

        return () => {
            es.close();
        };
    }, []);

    // Fallback polling for manual control (no test_id) to populate telemetry cards
    useEffect(() => {
        if (polling) return;
        setPolling(true);

        const fetchSnapshots = async () => {
            try {
                // Position
                const posRes = await api.get("/api/robot/position");
                const pos = posRes.data?.position;

                // Environment
                const envRes = await api.get("/api/environment/reading").catch(() => null);
                const env = envRes?.data;

                // Heating zones
                const heatRes = await api.get("/api/heating/status").catch(() => null);
                const heat = heatRes?.data;
                const zones = Array.isArray(heat?.zones) ? heat.zones : [];
                const head = zones.find((z: any) => z.zone === "HEAD");
                const body = zones.find((z: any) => z.zone === "BODY");
                const legs = zones.find((z: any) => z.zone === "LEGS");
                setHeatingZones(zones);

                // Stand status
                const standRes = await api.get("/api/stand/status").catch(() => null);
                const stand = standRes?.data;
                if (stand) {
                    setStandStatus(stand);
                    if (stand.currentAngle !== undefined) {
                        setTargetAngle(stand.currentAngle);
                    }
                }

                setLatestTelemetry(prev => ({
                    ...prev,
                    robot_position_x: pos?.x ?? prev?.robot_position_x ?? 0,
                    robot_position_y: pos?.y ?? prev?.robot_position_y ?? 0,
                    ambient_temp: env?.temperature ?? prev?.ambient_temp ?? 0,
                    humidity: env?.humidity ?? prev?.humidity ?? 0,
                    head_temp_avg: head?.currentTemp ?? prev?.head_temp_avg,
                    body_temp_avg: body?.currentTemp ?? prev?.body_temp_avg,
                    legs_temp_avg: legs?.currentTemp ?? prev?.legs_temp_avg,
                    detector_angle: stand?.currentAngle ?? prev?.detector_angle ?? undefined,
                    detection_active: prev?.detection_active ?? false,
                    timestamp: new Date().toISOString()
                }));
            } catch (err) {
                console.error("ManualControl polling error:", err);
            }
        };

        const interval = setInterval(fetchSnapshots, 2000);
        fetchSnapshots();

        return () => {
            clearInterval(interval);
            setPolling(false);
        };
    }, [polling]);

    // SSE stream for robot/manual events to populate logs
    useEffect(() => {
        const es = new EventSource("/api/robot/stream");

        const handler = (type: string) => (event: MessageEvent) => {
            let data: any = {};
            try {
                data = JSON.parse(event.data);
            } catch {
                // ignore parse errors
            }

            if (data?.position && data.position.x !== undefined && data.position.y !== undefined) {
                setLatestTelemetry(prev => ({
                    ...prev,
                    robot_position_x: data.position.x,
                    robot_position_y: data.position.y,
                    timestamp: data.timestamp ?? new Date().toISOString()
                }));
            }

            const log = mapRobotEventToLog(type, data);
            if (log) {
                appendLog(log);
            }
        };

        const listeners = new Map<string, (event: MessageEvent) => void>();
        robotEventTypes.forEach((evt) => {
            const fn = handler(evt);
            listeners.set(evt, fn);
            es.addEventListener(evt, fn);
        });

        es.onerror = () => {
            es.close();
        };

        return () => {
            listeners.forEach((fn, evt) => {
                es.removeEventListener(evt, fn);
            });
            es.close();
        };
    }, [appendLog]);

    // --------------- Movement ---------------
    const [activeDir, setActiveDir] = useState<Direction | null>(null);

    // Placeholder API call - adjust URL/body to your backend
    async function sendMoveCommand(
        direction: Direction,
        action: "start" | "stop"
    ) {
        try {
            await api.post("/api/robot/move", {
                direction,
                action,
            });
        } catch (err) {
            console.error("sendMoveCommand error:", err);
        }
    }

    const startMove = useCallback(
        async (dir: Direction) => {
            if (!armed) return;
            if (activeDir === dir) return; // ignore repeats while held
            setActiveDir(dir);
            await sendMoveCommand(dir, "start");
        },
        [activeDir, armed]
    );

    const stopMove = useCallback(async () => {
        if (!armed) return;
        if (!activeDir) return;
        const stoppedDir = activeDir;
        setActiveDir(null);
        await sendMoveCommand(stoppedDir, "stop");
    }, [activeDir, armed]);

    const handleStartManual = useCallback(async () => {
        if (armed) return;
        try {
            await api.post("/api/robot/manual/start");
            setArmed(true);
        } catch (err) {
            console.error("Failed to arm manual control:", err);
        }
    }, [armed]);

    const handleStopManual = useCallback(async () => {
        if (armed) {
            await stopMove();
        }
        try {
            await api.post("/api/robot/manual/stop");
        } catch (err) {
            console.error("Failed to disarm manual control:", err);
        }
        setArmed(false);
        setActiveDir(null);
    }, [armed, stopMove]);

    const handleHome = useCallback(async () => {
        if (!armed || homing) return;
        setHoming(true);
        try {
            await stopMove();
            await api.post("/api/robot/home");
            message.success("Homing command sent");
        } catch (err) {
            console.error("Failed to home robot:", err);
            message.error("Failed to home robot");
        } finally {
            setHoming(false);
        }
    }, [armed, homing, stopMove]);

    // Stand control handlers (for future UI features)
    // Reserved for future stand control feature
    const _handleSetAngle = useCallback(async (angle: number) => {
        try {
            await api.post("/api/stand/set-angle", { angle });
            setTargetAngle(angle);
            message.success(`Stand moving to ${angle}°`);
        } catch (err) {
            console.error("Failed to set angle:", err);
            message.error("Failed to set angle");
        }
    }, []);

    // Reserved for future stand control feature
    const _handleStepAngle = useCallback(async (delta: number) => {
        try {
            await api.post("/api/stand/step-angle", { delta });
            message.success(`Stand stepped ${delta > 0 ? "+" : ""}${delta}°`);
        } catch (err) {
            console.error("Failed to step angle:", err);
            message.error("Failed to step angle");
        }
    }, []);

    // Heating control handlers (for future UI features)
    // Reserved for future heating control feature
    const _handleInitHeating = useCallback(async () => {
        try {
            await api.post("/api/heating/initialize");
            message.success("Heating initialized");
        } catch (err) {
            console.error("Failed to initialize heating:", err);
            message.error("Failed to initialize heating");
        }
    }, []);

    // Reserved for future heating control feature
    const _handleEnableHeating = useCallback(async () => {
        try {
            await api.post("/api/heating/enable-all");
            message.success("Heating enabled");
        } catch (err) {
            console.error("Failed to enable heating:", err);
            message.error("Failed to enable heating");
        }
    }, []);

    // Reserved for future heating control feature
    const _handleDisableHeating = useCallback(async () => {
        try {
            await api.post("/api/heating/disable-all");
            message.success("Heating disabled");
        } catch (err) {
            console.error("Failed to disable heating:", err);
            message.error("Failed to disable heating");
        }
    }, []);

    // Mark future handlers as intentionally unused
    void _handleSetAngle;
    void _handleStepAngle;
    void _handleInitHeating;
    void _handleEnableHeating;
    void _handleDisableHeating;

    // --------------- Keyboard support ---------------
    useEffect(() => {
        const keyToDir = (key: string): Direction | null => {
            switch (key) {
                case "ArrowUp":
                    return "up";
                case "ArrowDown":
                    return "down";
                case "ArrowLeft":
                    return "left";
                case "ArrowRight":
                    return "right";
                default:
                    return null;
            }
        };

        const onKeyDown = (e: KeyboardEvent) => {
            if (!armed) return;
            const dir = keyToDir(e.key);
            if (!dir) return;
            if (e.repeat) return; // start only on first keydown
            void startMove(dir);
        };

        const onKeyUp = (e: KeyboardEvent) => {
            if (!armed) return;
            const dir = keyToDir(e.key);
            if (!dir) return;
            void stopMove();
        };

        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
        };
    }, [startMove, stopMove, armed]);

    // --------------- Touch helpers (prevent scroll) ---------------
    const onTouchStartDir =
        (dir: Direction) => (e: React.TouchEvent<HTMLButtonElement>) => {
            e.preventDefault();
            void startMove(dir);
        };
    const onTouchEndStop = (e: React.TouchEvent<HTMLButtonElement>) => {
        e.preventDefault();
        void stopMove();
    };

    // Prevent accidental tab close while armed
    useEffect(() => {
        const handler = (event: BeforeUnloadEvent) => {
            if (!armed) return;
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, [armed]);

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
                            }}
                        />
                        <Text> RoboControl-X1</Text>
                        <Tag color="green" style={{ borderRadius: "99px" }}>
                            Connected
                        </Tag>
                    </Space>
                </div>

                <div style={{ flex: 1, display: "flex", justifyContent: "right" }}>
                    <Space>
                        <Button
                            color="primary"
                            variant="solid"
                            disabled={armed}
                            onClick={() => void handleStartManual()}
                        >
                            Start
                        </Button>
                        <Button
                            variant="solid"
                            disabled={!armed}
                            loading={homing}
                            onClick={() => void handleHome()}
                        >
                            Return Home
                        </Button>
                        <Button
                            color="red"
                            variant="solid"
                            onClick={() => void handleStopManual()}
                        >
                            Stop
                        </Button>
                    </Space>
                </div>
            </Header>

            <Content style={{ height: "100vh" }}>
                <div style={{ flex: 1, textAlign: "center" }}>
                    <Title level={2}>Manual Control</Title>
                    <Text>Control robot movements manually</Text>
                </div>

                <br />

                {/* Live telemetry snapshot */}
                <Row gutter={[16, 16]} style={{ paddingInline: 24, marginBottom: 12 }}>
                    <Col xs={24} md={12} lg={6}>
                        <Card>
                            <Statistic
                                title="Ambient Temp"
                                value={latestTelemetry?.ambient_temp ?? "N/A"}
                                suffix={latestTelemetry?.ambient_temp ? "°C" : ""}
                            />
                            <Statistic
                                title="Humidity"
                                value={latestTelemetry?.humidity ?? "N/A"}
                                suffix={latestTelemetry?.humidity ? "%" : ""}
                            />
                        </Card>
                    </Col>
                    <Col xs={24} md={12} lg={6}>
                        <Card>
                            <Statistic
                                title="Head Temp"
                                value={latestTelemetry?.head_temp_avg ?? "N/A"}
                                suffix={latestTelemetry?.head_temp_avg ? "°C" : ""}
                            />
                            <Statistic
                                title="Body Temp"
                                value={latestTelemetry?.body_temp_avg ?? "N/A"}
                                suffix={latestTelemetry?.body_temp_avg ? "°C" : ""}
                            />
                            <Statistic
                                title="Legs Temp"
                                value={latestTelemetry?.legs_temp_avg ?? "N/A"}
                                suffix={latestTelemetry?.legs_temp_avg ? "°C" : ""}
                            />
                        </Card>
                    </Col>
                    <Col xs={24} md={12} lg={6}>
                        <Card>
                            <Statistic
                                title="Detector Angle"
                                value={latestTelemetry?.detector_angle ?? "N/A"}
                                suffix={latestTelemetry?.detector_angle ? "°" : ""}
                            />
                            <Statistic
                                title="Detection"
                                value={latestTelemetry?.detection_active ? "Active" : "Idle"}
                                valueStyle={{ color: latestTelemetry?.detection_active ? "#52c41a" : undefined }}
                            />
                        </Card>
                    </Col>
                    <Col xs={24} md={12} lg={6}>
                        <Card>
                            <Statistic
                                title="Robot Position X"
                                value={
                                    latestTelemetry?.robot_position_x !== undefined
                                        ? latestTelemetry.robot_position_x
                                        : "N/A"
                                }
                                suffix={latestTelemetry?.robot_position_x !== undefined ? "m" : ""}
                            />
                            <Statistic
                                title="Robot Position Y"
                                value={
                                    latestTelemetry?.robot_position_y !== undefined
                                        ? latestTelemetry.robot_position_y
                                        : "N/A"
                                }
                                suffix={latestTelemetry?.robot_position_y !== undefined ? "m" : ""}
                            />
                            <Text type="secondary" style={{ fontSize: 12 }}>
                                {latestTelemetry?.timestamp
                                    ? `Updated ${new Date(latestTelemetry.timestamp).toLocaleTimeString()}`
                                    : "Waiting for telemetry..."}
                            </Text>
                        </Card>
                    </Col>
                </Row>

                <Tabs
                    defaultActiveKey="drive"
                    items={[
                        {
                            key: "drive",
                            label: "Drive",
                            children: (
                                <Flex gap={"middle"} justify={"center"} align={"center"}>
                                    {/* LOGS CARD */}
                                    <Card
                                        style={{ width: "80vh", height: "80vh", overflow: "hidden" }}
                                        styles={{
                                            body: {
                                                height: "100%",
                                                display: "flex",
                                                flexDirection: "column",
                                            }
                                        }}
                                    >
                                        <Title level={5} style={{ marginBottom: 0 }}>
                                            Robot Communication &amp; Movement Log
                                        </Title>
                                        <Divider style={{ margin: "12px 0" }} />

                                        <div
                                            ref={logListRef}
                                            style={{
                                                flex: 1,
                                                minHeight: 0,
                                                overflowY: "auto",
                                                paddingRight: 8,
                                            }}
                                        >
                                            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                                                {logs.map((l) => (
                                                    <LogCard
                                                        key={l.id}
                                                        tag={l.tag}
                                                        information={l.information}
                                                        tagColour={l.tagColour}
                                                        timestamp={l.timestamp}
                                                    />
                                                ))}
                                            </Space>
                                        </div>
                                    </Card>

                                    {/* D-PAD CARD */}
                                    <Card
                                        style={{ width: "80vh", height: "80vh", overflow: "hidden" }}
                                        styles={{
                                            body: {
                                                height: "100%",
                                                display: "flex",
                                                flexDirection: "column",
                                            }
                                        }}
                                    >
                                        <Title level={5} style={{ marginBottom: 0 }}>
                                            Real-time manual drive (D-pad &amp; keyboard)
                                        </Title>
                                        <Divider style={{ margin: "12px 0" }} />

                                        {/* D-PAD */}
                                        <div
                                            style={{
                                                flex: 1,
                                                minHeight: 0,
                                                display: "grid",
                                                gridTemplateRows: "1fr 1fr 1fr",
                                                gridTemplateColumns: "1fr 1fr 1fr",
                                                gap: 12,
                                                placeItems: "center",
                                                userSelect: "none",
                                            }}
                                        >
                                            {/* Row 1 */}
                                            <div />
                                            <Button
                                                shape="circle"
                                                size="large"
                                                type={activeDir === "up" ? "primary" : "default"}
                                                disabled={!armed}
                                                onMouseDown={() => void startMove("up")}
                                                onMouseUp={() => void stopMove()}
                                                onMouseLeave={() => void stopMove()}
                                                onTouchStart={onTouchStartDir("up")}
                                                onTouchEnd={onTouchEndStop}
                                                aria-label="Move up"
                                            >
                                                <UpOutlined /> {activeDir === "up" && "⚡"}
                                            </Button>
                                            <div />

                                            {/* Row 2 */}
                                            <Button
                                                shape="circle"
                                                size="large"
                                                type={activeDir === "left" ? "primary" : "default"}
                                                disabled={!armed}
                                                onMouseDown={() => void startMove("left")}
                                                onMouseUp={() => void stopMove()}
                                                onMouseLeave={() => void stopMove()}
                                                onTouchStart={onTouchStartDir("left")}
                                                onTouchEnd={onTouchEndStop}
                                                aria-label="Move left"
                                            >
                                                <LeftCircleOutlined /> {activeDir === "left" && "⚡"}
                                            </Button>

                                            <div
                                                style={{
                                                    width: 90,
                                                    height: 90,
                                                    borderRadius: 12,
                                                    border: "1px solid #e5e6eb",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    fontWeight: 500,
                                                }}
                                            >
                                                {activeDir ? `Moving: ${activeDir}` : armed ? "Idle" : "Disarmed"}
                                            </div>

                                            <Button
                                                shape="circle"
                                                size="large"
                                                type={activeDir === "right" ? "primary" : "default"}
                                                disabled={!armed}
                                                onMouseDown={() => void startMove("right")}
                                                onMouseUp={() => void stopMove()}
                                                onMouseLeave={() => void stopMove()}
                                                onTouchStart={onTouchStartDir("right")}
                                                onTouchEnd={onTouchEndStop}
                                                aria-label="Move right"
                                            >
                                                <RightCircleOutlined /> {activeDir === "right" && "⚡"}
                                            </Button>

                                            {/* Row 3 */}
                                            <div />
                                            <Button
                                                shape="circle"
                                                size="large"
                                                type={activeDir === "down" ? "primary" : "default"}
                                                disabled={!armed}
                                                onMouseDown={() => void startMove("down")}
                                                onMouseUp={() => void stopMove()}
                                                onMouseLeave={() => void stopMove()}
                                                onTouchStart={onTouchStartDir("down")}
                                                onTouchEnd={onTouchEndStop}
                                                aria-label="Move down"
                                            >
                                                <DownOutlined /> {activeDir === "down" && "⚡"}
                                            </Button>
                                            <div />
                                        </div>

                                        <Divider style={{ margin: "12px 0" }} />
                                        <Flex justify="space-between" align="center">
                                            <Text>Battery 15%</Text>
                                            <Text type="secondary">Tip: Use arrow keys</Text>
                                        </Flex>
                                    </Card>
                                </Flex>
                            ),
                        },
                        {
                            key: "systems",
                            label: "Heating & Stand",
                            children: (
                                <Row gutter={[16, 16]} style={{ paddingInline: 24 }}>
                                    <Col xs={24} md={14}>
                                        <HeatingZoneControl />
                                    </Col>
                                    <Col xs={24} md={10}>
                                        <StandControl />
                                    </Col>
                                </Row>
                            ),
                        },
                    ]}
                />
            </Content>
        </Layout>
    );
}


