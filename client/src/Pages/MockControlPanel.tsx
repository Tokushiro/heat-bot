import React, { useState, useEffect } from "react";
import { Card, Button, Space, Slider, Switch, Tag, Divider, Row, Col, InputNumber, message } from "antd";
import { 
    ThunderboltOutlined, 
    WifiOutlined, 
    RobotOutlined,
    RadarChartOutlined,
    BugOutlined
} from "@ant-design/icons";
import { api } from "../Components/apiAxios";

/**
 * Mock Control Panel
 * Control simulated robot and sensor for testing without hardware
 * 
 * DELETE THIS FILE when you have real hardware!
 */

const MockControlPanel: React.FC = () => {
    const [robotConnected, setRobotConnected] = useState(false);
    const [sensorConnected, setSensorConnected] = useState(false);
    const [batteryLevel, setBatteryLevel] = useState(100);
    const [detectionRate, setDetectionRate] = useState(85);
    const [detectionDelay, setDetectionDelay] = useState(1500);
    const [autoDetect, setAutoDetect] = useState(true);
    const [robotPosition, setRobotPosition] = useState({ x: 0, y: 0, angle: 0 });

    useEffect(() => {
        // Check if mocks are active
        checkMockStatus();
    }, []);

    const checkMockStatus = async () => {
        try {
            const response = await api.get('/api/mock/status');
            setRobotConnected(response.data.robot.connected);
            setSensorConnected(response.data.sensor.connected);
            setBatteryLevel(response.data.robot.battery);
            setRobotPosition(response.data.robot.position);
        } catch (error) {
            console.log('Mock API not available - mocks may not be running');
        }
    };

    // Robot Controls
    const handleConnectRobot = async () => {
        try {
            await api.post('/api/mock/robot/connect');
            setRobotConnected(true);
            message.success('Robot connected (mock)');
        } catch (error) {
            message.error('Failed to connect robot mock');
        }
    };

    const handleLowBattery = async () => {
        try {
            await api.post('/api/mock/robot/low-battery');
            setBatteryLevel(15);
            message.warning('Battery low simulated!');
        } catch (error) {
            message.error('Failed to simulate low battery');
        }
    };

    const handleRechargeBattery = async () => {
        try {
            await api.post('/api/mock/robot/recharge');
            setBatteryLevel(100);
            message.success('Battery recharged to 100%');
        } catch (error) {
            message.error('Failed to recharge battery');
        }
    };

    const handleSetBattery = async (value: number | null) => {
        if (value === null) return;
        try {
            await api.post('/api/mock/robot/set-battery', { level: value });
            setBatteryLevel(value);
            message.info(`Battery set to ${value}%`);
        } catch (error) {
            message.error('Failed to set battery level');
        }
    };

    const handleConnectionLost = async () => {
        try {
            await api.post('/api/mock/robot/disconnect');
            setRobotConnected(false);
            message.error('Connection lost (simulated)');
        } catch (error) {
            message.error('Failed to simulate connection loss');
        }
    };

    const handleMovementFailed = async () => {
        try {
            await api.post('/api/mock/robot/movement-failed');
            message.warning('Movement failed (simulated)');
        } catch (error) {
            message.error('Failed to simulate movement failure');
        }
    };

    // Sensor Controls
    const handleConnectSensor = async () => {
        try {
            await api.post('/api/mock/sensor/connect');
            setSensorConnected(true);
            message.success('Sensor connected (mock)');
        } catch (error) {
            message.error('Failed to connect sensor mock');
        }
    };

    const handleForceDetect = async () => {
        try {
            await api.post('/api/mock/sensor/force-detect');
            message.success('Detection triggered!');
        } catch (error) {
            message.error('Failed to trigger detection');
        }
    };

    const handleForceNoDetect = async () => {
        try {
            await api.post('/api/mock/sensor/force-no-detect');
            message.warning('No detection triggered');
        } catch (error) {
            message.error('Failed to trigger no detection');
        }
    };

    const handleSetDetectionRate = async (value: number) => {
        try {
            await api.post('/api/mock/sensor/set-detection-rate', {
                probability: value / 100
            });
            setDetectionRate(value);
            message.info(`Detection rate set to ${value}%`);
        } catch (error) {
            message.error('Failed to set detection rate');
        }
    };

    const handleSetDetectionDelay = async (value: number | null) => {
        if (value === null) return;
        try {
            await api.post('/api/mock/sensor/set-detection-delay', {
                delayMs: value
            });
            setDetectionDelay(value);
            message.info(`Detection delay set to ${value}ms`);
        } catch (error) {
            message.error('Failed to set detection delay');
        }
    };

    const handleToggleAutoDetect = async (checked: boolean) => {
        try {
            await api.post('/api/mock/sensor/set-auto-detect', {
                enabled: checked
            });
            setAutoDetect(checked);
            message.info(`Auto-detect ${checked ? 'enabled' : 'disabled'}`);
        } catch (error) {
            message.error('Failed to toggle auto-detect');
        }
    };

    const handleSensorMalfunction = async () => {
        try {
            await api.post('/api/mock/sensor/malfunction');
            setSensorConnected(false);
            message.error('Sensor malfunction (simulated)');
        } catch (error) {
            message.error('Failed to simulate sensor malfunction');
        }
    };

    return (
        <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
            <Card 
                title={
                    <Space>
                        <BugOutlined />
                        <span>Mock Control Panel - Hardware Simulator</span>
                    </Space>
                }
                extra={
                    <Tag color="orange">TESTING MODE - DELETE WHEN HARDWARE READY</Tag>
                }
            >
                <p>
                    This panel simulates robot and sensor hardware for testing. 
                    Use it to test battery failures, sensor detections, and error scenarios.
                </p>

                <Divider />

                <Row gutter={16}>
                    {/* Robot Controls */}
                    <Col span={12}>
                        <Card
                            title={
                                <Space>
                                    <RobotOutlined />
                                    <span>Robot Mock</span>
                                    <Tag color={robotConnected ? "green" : "red"}>
                                        {robotConnected ? "CONNECTED" : "DISCONNECTED"}
                                    </Tag>
                                </Space>
                            }
                            type="inner"
                        >
                            <Space direction="vertical" style={{ width: "100%" }}>
                                {/* Connection */}
                                <Button 
                                    type="primary" 
                                    icon={<WifiOutlined />}
                                    onClick={handleConnectRobot}
                                    disabled={robotConnected}
                                    block
                                >
                                    Connect Robot
                                </Button>

                                <Divider />

                                {/* Battery Controls */}
                                <div>
                                    <strong>Battery Level: {batteryLevel}%</strong>
                                    <Slider 
                                        value={batteryLevel}
                                        onChange={handleSetBattery}
                                        min={0}
                                        max={100}
                                        marks={{
                                            0: '0%',
                                            20: '20% (Low)',
                                            50: '50%',
                                            100: '100%'
                                        }}
                                    />
                                </div>

                                <Space wrap>
                                    <Button 
                                        danger
                                        onClick={handleLowBattery}
                                        disabled={!robotConnected}
                                    >
                                        🔋 Trigger Low Battery
                                    </Button>
                                    <Button 
                                        onClick={handleRechargeBattery}
                                        disabled={!robotConnected}
                                    >
                                        ⚡ Recharge to 100%
                                    </Button>
                                </Space>

                                <Divider />

                                {/* Error Scenarios */}
                                <div>
                                    <strong>Error Scenarios:</strong>
                                </div>
                                <Space direction="vertical" style={{ width: "100%" }}>
                                    <Button 
                                        danger
                                        onClick={handleConnectionLost}
                                        disabled={!robotConnected}
                                        block
                                    >
                                        🔌 Simulate Connection Lost
                                    </Button>
                                    <Button 
                                        onClick={handleMovementFailed}
                                        disabled={!robotConnected}
                                        block
                                    >
                                        ⚠️ Simulate Movement Failed
                                    </Button>
                                </Space>

                                <Divider />

                                {/* Position Display */}
                                <div>
                                    <strong>Current Position:</strong>
                                    <div style={{ fontSize: 12, marginTop: 8, color: "#666" }}>
                                        X: {robotPosition.x.toFixed(2)}m<br/>
                                        Y: {robotPosition.y.toFixed(2)}m<br/>
                                        Angle: {robotPosition.angle.toFixed(0)}°
                                    </div>
                                </div>
                            </Space>
                        </Card>
                    </Col>

                    {/* Sensor Controls */}
                    <Col span={12}>
                        <Card
                            title={
                                <Space>
                                    <RadarChartOutlined />
                                    <span>Sensor Mock (BLE)</span>
                                    <Tag color={sensorConnected ? "green" : "red"}>
                                        {sensorConnected ? "CONNECTED" : "DISCONNECTED"}
                                    </Tag>
                                </Space>
                            }
                            type="inner"
                        >
                            <Space direction="vertical" style={{ width: "100%" }}>
                                {/* Connection */}
                                <Button 
                                    type="primary" 
                                    icon={<WifiOutlined />}
                                    onClick={handleConnectSensor}
                                    disabled={sensorConnected}
                                    block
                                >
                                    Connect Sensor
                                </Button>

                                <Divider />

                                {/* Manual Detection */}
                                <div>
                                    <strong>Manual Detection:</strong>
                                </div>
                                <Space wrap>
                                    <Button 
                                        type="primary"
                                        onClick={handleForceDetect}
                                        disabled={!sensorConnected}
                                    >
                                        ✓ Force Detect
                                    </Button>
                                    <Button 
                                        onClick={handleForceNoDetect}
                                        disabled={!sensorConnected}
                                    >
                                        ✗ Force No Detect
                                    </Button>
                                </Space>

                                <Divider />

                                {/* Auto-Detection Settings */}
                                <div>
                                    <strong>Auto-Detection:</strong>
                                    <div style={{ marginTop: 8 }}>
                                        <Switch 
                                            checked={autoDetect}
                                            onChange={handleToggleAutoDetect}
                                            disabled={!sensorConnected}
                                        />
                                        <span style={{ marginLeft: 8 }}>
                                            {autoDetect ? "Enabled" : "Disabled"}
                                        </span>
                                    </div>
                                </div>

                                {/* Detection Rate */}
                                <div style={{ marginTop: 16 }}>
                                    <strong>Detection Rate: {detectionRate}%</strong>
                                    <Slider 
                                        value={detectionRate}
                                        onChange={handleSetDetectionRate}
                                        min={0}
                                        max={100}
                                        marks={{
                                            0: '0%',
                                            50: '50%',
                                            85: '85%',
                                            100: '100%'
                                        }}
                                        disabled={!sensorConnected}
                                    />
                                </div>

                                {/* Detection Delay */}
                                <div>
                                    <strong>Detection Delay (ms):</strong>
                                    <InputNumber
                                        value={detectionDelay}
                                        onChange={handleSetDetectionDelay}
                                        min={100}
                                        max={5000}
                                        step={100}
                                        disabled={!sensorConnected}
                                        style={{ width: "100%", marginTop: 8 }}
                                    />
                                </div>

                                <Divider />

                                {/* Error Scenarios */}
                                <div>
                                    <strong>Error Scenarios:</strong>
                                </div>
                                <Button 
                                    danger
                                    onClick={handleSensorMalfunction}
                                    disabled={!sensorConnected}
                                    block
                                >
                                    ⚠️ Simulate Sensor Malfunction
                                </Button>
                            </Space>
                        </Card>
                    </Col>
                </Row>

                <Divider />

                <Card type="inner" style={{ backgroundColor: "#fffbe6" }}>
                    <strong>💡 Usage Tips:</strong>
                    <ul style={{ marginTop: 8, marginBottom: 0 }}>
                        <li>Start a test from the Control page</li>
                        <li>Use "Trigger Low Battery" to test resume feature</li>
                        <li>Adjust detection rate to simulate sensor behavior</li>
                        <li>Use manual detection for precise testing</li>
                        <li>Try error scenarios to test error handling</li>
                    </ul>
                </Card>

                <Divider />

                <Card type="inner" style={{ backgroundColor: "#fff1f0" }}>
                    <strong>⚠️ Important:</strong>
                    <p style={{ marginBottom: 0 }}>
                        This is for TESTING ONLY. When your team provides real robot and sensor APIs:
                    </p>
                    <ol style={{ marginTop: 8 }}>
                        <li>Replace <code>mocks/SerialManager.ts</code> with real version</li>
                        <li>Replace <code>mocks/bleEventBus.ts</code> with real version</li>
                        <li>Delete this MockControlPanel page</li>
                        <li>Remove mock routes from server</li>
                    </ol>
                </Card>
            </Card>
        </div>
    );
};

export default MockControlPanel;
