import { Card, Avatar, Typography, Button, Tag, Select, Space, Alert, Spin, Divider, Tooltip, Input, Radio } from "antd";
import { RobotOutlined, ThunderboltOutlined, CheckCircleOutlined, ApiOutlined, ReloadOutlined, EditOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { api as axios } from "../Components/apiAxios";

const { Title, Text } = Typography;

interface PortInfo {
    path: string;
    manufacturer?: string;
    serialNumber?: string;
    pnpId?: string;
    vendorId?: string;
    productId?: string;
}

interface MockModeDetails {
    robot: boolean;
    sensor: boolean;
    stand: boolean;
    heating: boolean;
    environment: boolean;
    gridtest: boolean;
}

export default function RobotControlCard() {
    const navigate = useNavigate();
    const [connected, setConnected] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [ports, setPorts] = useState<PortInfo[]>([]);
    const [selectedPort, setSelectedPort] = useState<string>("");
    const [manualPort, setManualPort] = useState<string>("");
    const [portInputMode, setPortInputMode] = useState<"auto" | "manual">("auto");
    const [mockMode, setMockMode] = useState(false);
    const [mockDetails, setMockDetails] = useState<MockModeDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshingPorts, setRefreshingPorts] = useState(false);
    const [error, setError] = useState<string>("");

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        try {
            setLoading(true);
            setError("");

            // Check mock mode
            const mockRes = await axios.get("/api/serial/mock-mode");
            const isMockMode = mockRes.data.allMock;
            setMockMode(isMockMode);
            setMockDetails(mockRes.data.mockMode);

            // Check current connection status
            const statusRes = await axios.get("/api/serial/status");
            setConnected(statusRes.data.connected);

            // List available ports (only if not in fully mock mode)
            if (!isMockMode) {
                const portsRes = await axios.get("/api/serial/ports");
                setPorts(portsRes.data.ports || []);
                if (portsRes.data.ports?.length > 0) {
                    setSelectedPort(portsRes.data.ports[0].path);
                }
            }
        } catch (err: any) {
            setError(err.message || "Failed to load initial data");
        } finally {
            setLoading(false);
        }
    };

    const handleConnect = async () => {
        if (mockMode) {
            // In mock mode, just navigate to control panel
            navigate("/controlpanel");
            return;
        }

        const portToConnect = portInputMode === "manual" ? manualPort : selectedPort;

        if (!portToConnect) {
            setError("Please " + (portInputMode === "manual" ? "enter" : "select") + " a serial port");
            return;
        }

        try {
            setConnecting(true);
            setError("");
            await axios.post("/api/serial/connect", { path: portToConnect });
            setConnected(true);
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || "Connection failed");
        } finally {
            setConnecting(false);
        }
    };

    const handleDisconnect = async () => {
        try {
            setConnecting(true);
            setError("");
            await axios.post("/api/serial/disconnect");
            setConnected(false);
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || "Disconnection failed");
        } finally {
            setConnecting(false);
        }
    };

    const refreshPorts = async () => {
        try {
            setRefreshingPorts(true);
            setError("");
            const portsRes = await axios.get("/api/serial/ports");
            setPorts(portsRes.data.ports || []);

            // Auto-select first port if none selected or selected port no longer exists
            if (portsRes.data.ports?.length > 0) {
                const portPaths = portsRes.data.ports.map((p: PortInfo) => p.path);
                if (!selectedPort || !portPaths.includes(selectedPort)) {
                    setSelectedPort(portsRes.data.ports[0].path);
                }
            } else {
                setSelectedPort("");
            }
        } catch (err: any) {
            setError(err.message || "Failed to refresh ports");
        } finally {
            setRefreshingPorts(false);
        }
    };

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
                    width: 400,
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

                {mockMode && (
                    <Tag icon={<ThunderboltOutlined />} color="orange" style={{ marginBottom: 16 }}>
                        Full Mock Mode (All Simulated)
                    </Tag>
                )}

                {!mockMode && mockDetails && (
                    <Tag icon={<ApiOutlined />} color="blue" style={{ marginBottom: 16 }}>
                        Hybrid Mode (Mixed Real/Mock)
                    </Tag>
                )}

                {loading ? (
                    <div style={{ padding: "40px 0" }}>
                        <Spin tip="Loading..." />
                    </div>
                ) : (
                    <Space direction="vertical" style={{ width: "100%" }} size="large">
                        {error && <Alert message={error} type="error" closable onClose={() => setError("")} />}

                        {mockDetails && !mockMode && (
                            <div style={{ textAlign: "left", background: "#f5f5f5", padding: "12px", borderRadius: "6px" }}>
                                <Text strong style={{ fontSize: "12px" }}>Component Status:</Text>
                                <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                                    <div>
                                        <Tag color={mockDetails.robot ? "orange" : "green"} style={{ width: "100%" }}>
                                            Robot: {mockDetails.robot ? "Mock" : "Real"}
                                        </Tag>
                                    </div>
                                    <div>
                                        <Tag color={mockDetails.sensor ? "orange" : "green"} style={{ width: "100%" }}>
                                            Sensor: {mockDetails.sensor ? "Mock" : "Real"}
                                        </Tag>
                                    </div>
                                    <div>
                                        <Tag color={mockDetails.stand ? "orange" : "green"} style={{ width: "100%" }}>
                                            Stand: {mockDetails.stand ? "Mock" : "Real"}
                                        </Tag>
                                    </div>
                                    <div>
                                        <Tag color={mockDetails.heating ? "orange" : "green"} style={{ width: "100%" }}>
                                            Heating: {mockDetails.heating ? "Mock" : "Real"}
                                        </Tag>
                                    </div>
                                    <div>
                                        <Tag color={mockDetails.environment ? "orange" : "green"} style={{ width: "100%" }}>
                                            Environment: {mockDetails.environment ? "Mock" : "Real"}
                                        </Tag>
                                    </div>
                                    <div>
                                        <Tag color={mockDetails.gridtest ? "orange" : "green"} style={{ width: "100%" }}>
                                            Grid Test: {mockDetails.gridtest ? "Mock" : "Real"}
                                        </Tag>
                                    </div>
                                </div>
                            </div>
                        )}

                        {!mockMode && !connected && (
                            <>
                                <div style={{ textAlign: "left" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                        <Text>Serial Port:</Text>
                                        <Radio.Group
                                            value={portInputMode}
                                            onChange={(e) => setPortInputMode(e.target.value)}
                                            size="small"
                                        >
                                            <Radio.Button value="auto">Auto-detect</Radio.Button>
                                            <Radio.Button value="manual">Manual</Radio.Button>
                                        </Radio.Group>
                                    </div>

                                    {portInputMode === "auto" && (
                                        <Space.Compact style={{ width: "100%" }}>
                                            <Select
                                                style={{ width: "100%" }}
                                                value={selectedPort}
                                                onChange={setSelectedPort}
                                                placeholder={ports.length === 0 ? "No ports found - try manual input" : "Choose a port"}
                                                options={ports.map(p => ({
                                                    value: p.path,
                                                    label: `${p.path}${p.manufacturer ? ` (${p.manufacturer})` : ""}`
                                                }))}
                                                notFoundContent="No serial ports detected"
                                            />
                                            <Tooltip title="Refresh port list">
                                                <Button
                                                    icon={<ReloadOutlined />}
                                                    loading={refreshingPorts}
                                                    onClick={refreshPorts}
                                                />
                                            </Tooltip>
                                        </Space.Compact>
                                    )}

                                    {portInputMode === "manual" && (
                                        <Input
                                            placeholder="e.g., COM3 or /dev/ttyUSB0"
                                            value={manualPort}
                                            onChange={(e) => setManualPort(e.target.value)}
                                            prefix={<EditOutlined />}
                                        />
                                    )}

                                    {ports.length === 0 && portInputMode === "auto" && (
                                        <Alert
                                            message="No ports detected"
                                            description="Connect your ESP and click refresh, or switch to manual input."
                                            type="warning"
                                            showIcon
                                            style={{ marginTop: 8 }}
                                        />
                                    )}
                                </div>
                                <Button
                                    type="primary"
                                    block
                                    size="large"
                                    loading={connecting}
                                    onClick={handleConnect}
                                    disabled={portInputMode === "auto" ? !selectedPort : !manualPort}
                                >
                                    Connect to Robot
                                </Button>
                            </>
                        )}

                        {!mockMode && connected && (
                            <>
                                <Tag color="green" style={{ marginBottom: 8 }}>
                                    Connected
                                </Tag>
                                <Text>Connected to:</Text>
                                <br />
                                <Text strong style={{ color: "#1677ff" }}>
                                    {portInputMode === "manual" ? manualPort : selectedPort}
                                </Text>
                                <Button
                                    type="default"
                                    block
                                    size="large"
                                    loading={connecting}
                                    onClick={handleDisconnect}
                                    danger
                                >
                                    Disconnect
                                </Button>
                            </>
                        )}

                        {mockMode && (
                            <Alert
                                message="Full Mock Mode Active"
                                description="All hardware components are simulated. No serial connection required. Perfect for testing without hardware!"
                                type="info"
                                showIcon
                            />
                        )}

                        {!mockMode && (
                            <Alert
                                message="Serial Connection Required"
                                description="One or more real hardware components detected. Connect to the robot's serial port to proceed."
                                type="warning"
                                showIcon
                            />
                        )}

                        <Button
                            type="primary"
                            block
                            size="large"
                            style={{ borderRadius: "6px" }}
                            onClick={() => navigate("/controlpanel")}
                            disabled={!mockMode && !connected}
                        >
                            Open Control Panel
                        </Button>
                    </Space>
                )}
            </Card>
        </div>
    );
}
