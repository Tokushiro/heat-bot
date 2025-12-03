import {
    Layout,
    Button,
    Space,
    Tag,
    Typography,
    Flex,
    Card,
    Divider,
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
import { LogCard } from "../Components/logCard";
import { api } from "../Components/apiAxios";

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

const two = (n: number) => String(n).padStart(2, "0");
const nowHHMMSS = () => {
    const d = new Date();
    return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
};

export default function ManualControl() {
    const navigate = useNavigate();

    // ---------------- Logs ----------------
    const [logs, setLogs] = useState<LogItem[]>([
        {
            id: crypto.randomUUID(),
            tag: "info",
            information: "Manual override initialized",
            tagColour: "blue",
            timestamp: nowHHMMSS(),
        },
        {
            id: crypto.randomUUID(),
            tag: "info",
            information: "Waiting for start",
            tagColour: "blue",
            timestamp: nowHHMMSS(),
        },
    ]);

    const pushLog = useCallback(
        (
            information: string,
            tag: LogItem["tag"] = "info",
            tagColour: LogItem["tagColour"] = "geekblue"
        ) => {
            setLogs((prev) => [
                ...prev,
                {
                    id: crypto.randomUUID(),
                    tag,
                    information,
                    tagColour,
                    timestamp: nowHHMMSS(),
                },
            ]);
        },
        []
    );

    // Auto-scroll logs to bottom when new log appears
    const logListRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        const el = logListRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    }, [logs]);

    // --------------- Movement ---------------
    const [activeDir, setActiveDir] = useState<Direction | null>(null);

    // Placeholder API call – adjust URL/body to your backend
    async function sendMoveCommand(
        direction: Direction,
        action: "start" | "stop"
    ) {
        try {
            await api.post("/api/robot/move", {
                command: "move",
                direction,
                action,
            });
        } catch (err) {
            console.error("sendMoveCommand error:", err);
        }
    }

    const startMove = useCallback(
        (dir: Direction) => {
            if (activeDir === dir) return; // ignore repeats
            setActiveDir(dir);
            pushLog(`Robot moving ${dir}`, "info", "geekblue");
            void sendMoveCommand(dir, "start");
        },
        [activeDir, pushLog]
    );

    const stopMove = useCallback(() => {
        if (!activeDir) return;
        const stoppedDir = activeDir;
        setActiveDir(null);
        pushLog(`Robot movement stopping (${stoppedDir})`, "warning", "red");
        void sendMoveCommand(stoppedDir, "stop");
    }, [activeDir, pushLog]);

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
            const dir = keyToDir(e.key);
            if (!dir) return;
            if (e.repeat) return; // start only on first keydown
            startMove(dir);
        };

        const onKeyUp = (e: KeyboardEvent) => {
            const dir = keyToDir(e.key);
            if (!dir) return;
            stopMove();
        };

        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
        };
    }, [startMove, stopMove]);

    // --------------- Touch helpers (prevent scroll) ---------------
    const onTouchStartDir =
        (dir: Direction) => (e: React.TouchEvent<HTMLButtonElement>) => {
            e.preventDefault();
            startMove(dir);
        };
    const onTouchEndStop = (e: React.TouchEvent<HTMLButtonElement>) => {
        e.preventDefault();
        stopMove();
    };

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
                            onClick={() => pushLog("Manual control armed", "success", "green")}
                        >
                            Start
                        </Button>
                        <Button color="red" variant="solid" onClick={stopMove}>
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

                <Flex gap={"middle"} justify={"center"} align={"center"}>
                    {/* LOGS CARD */}
                    <Card
                        style={{ width: "80vh", height: "80vh", overflow: "hidden" }}
                        bodyStyle={{
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
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
                                        tag={l.tag}
                                        information={l.information}
                                        tagColour={l.tagColour}
                                    />
                                ))}
                            </Space>
                        </div>
                    </Card>

                    {/* D-PAD CARD */}
                    <Card
                        style={{ width: "80vh", height: "80vh", overflow: "hidden" }}
                        bodyStyle={{
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
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
                                onMouseDown={() => startMove("up")}
                                onMouseUp={stopMove}
                                onMouseLeave={stopMove}
                                onTouchStart={onTouchStartDir("up")}
                                onTouchEnd={onTouchEndStop}
                                aria-label="Move up"
                            >
                                <UpOutlined />
                            </Button>
                            <div />

                            {/* Row 2 */}
                            <Button
                                shape="circle"
                                size="large"
                                onMouseDown={() => startMove("left")}
                                onMouseUp={stopMove}
                                onMouseLeave={stopMove}
                                onTouchStart={onTouchStartDir("left")}
                                onTouchEnd={onTouchEndStop}
                                aria-label="Move left"
                            >
                                <LeftCircleOutlined />
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
                                {activeDir ? `Moving: ${activeDir}` : "Idle"}
                            </div>

                            <Button
                                shape="circle"
                                size="large"
                                onMouseDown={() => startMove("right")}
                                onMouseUp={stopMove}
                                onMouseLeave={stopMove}
                                onTouchStart={onTouchStartDir("right")}
                                onTouchEnd={onTouchEndStop}
                                aria-label="Move right"
                            >
                                <RightCircleOutlined />
                            </Button>

                            {/* Row 3 */}
                            <div />
                            <Button
                                shape="circle"
                                size="large"
                                onMouseDown={() => startMove("down")}
                                onMouseUp={stopMove}
                                onMouseLeave={stopMove}
                                onTouchStart={onTouchStartDir("down")}
                                onTouchEnd={onTouchEndStop}
                                aria-label="Move down"
                            >
                                <DownOutlined />
                            </Button>
                            <div />
                        </div>

                        <Divider style={{ margin: "12px 0" }} />
                        <Flex justify="space-between" align="center">
                            <Text>Battery 15%</Text>
                            <Text type="secondary">Tip: Use ↑ ↓ ← → keys</Text>
                        </Flex>
                    </Card>
                </Flex>
            </Content>
        </Layout>
    );
}
