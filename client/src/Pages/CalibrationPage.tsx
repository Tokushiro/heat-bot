import React, { useState, useEffect } from 'react';
import { Card, Button, InputNumber, Space, Statistic, Tag, Alert, Row, Col, Divider, message } from 'antd';
import {
    CheckCircleOutlined,
    CloseCircleOutlined,
    WarningOutlined,
    SyncOutlined,
    FireOutlined,
    CompassOutlined,
    EnvironmentOutlined
} from '@ant-design/icons';
import '../Styles/CalibrationPage.css';


interface HeatingStatus {
    connected: boolean;
    initialized: boolean;
    zones: {
        zone1: { targetTemp: number; currentTemp: number; enabled: boolean };
        zone2: { targetTemp: number; currentTemp: number; enabled: boolean };
        zone3: { targetTemp: number; currentTemp: number; enabled: boolean };
    };
}

interface StandStatus {
    connected: boolean;
    initialized: boolean;
    currentAngle: number;
    isMoving: boolean;
}

interface EnvironmentStatus {
    connected: boolean;
    initialized: boolean;
    currentTemperature: number;
    currentHumidity: number;
    temperatureOffset: number;
    humidityOffset: number;
}

const CalibrationPage: React.FC = () => {
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

    // System status
    const [heatingStatus, setHeatingStatus] = useState<HeatingStatus | null>(null);
    const [standStatus, setStandStatus] = useState<StandStatus | null>(null);
    const [environmentStatus, setEnvironmentStatus] = useState<EnvironmentStatus | null>(null);

    // Calibration values
    const [ambientTemp, setAmbientTemp] = useState<number>(20);
    const [zone1Offset, setZone1Offset] = useState<number>(14); // Head: Ambient + 14°C
    const [zone2Offset, setZone2Offset] = useState<number>(7);  // Body: Ambient + 7°C
    const [zone3Offset, setZone3Offset] = useState<number>(7);  // Legs: Ambient + 7°C

    const [tempOffset, setTempOffset] = useState<number>(0);
    const [humidityOffset, setHumidityOffset] = useState<number>(0);

    const [testAngle, setTestAngle] = useState<number>(0);

    /**
     * Fetch all system statuses
     */
    const fetchStatuses = async () => {
        try {
            // Fetch heating status
            const heatingRes = await fetch(`${API_BASE}/api/heating/status`);
            if (heatingRes.ok) {
                setHeatingStatus(await heatingRes.json());
            }

            // Fetch stand status
            const standRes = await fetch(`${API_BASE}/api/stand/status`);
            if (standRes.ok) {
                setStandStatus(await standRes.json());
            }

            // Fetch environment status
            const envRes = await fetch(`${API_BASE}/api/environment/status`);
            if (envRes.ok) {
                setEnvironmentStatus(await envRes.json());
            }
        } catch (error) {
            console.error('Error fetching statuses:', error);
        }
    };

    /**
     * Initialize systems
     */
    const initializeHeating = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/heating/initialize`, { method: 'POST' });
            if (res.ok) {
                message.success('Heating system initialized');
                fetchStatuses();
            } else {
                message.error('Failed to initialize heating system');
            }
        } catch (error) {
            message.error('Error initializing heating system');
        }
    };

    const initializeStand = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/stand/initialize`, { method: 'POST' });
            if (res.ok) {
                message.success('Stand initialized');
                fetchStatuses();
            } else {
                message.error('Failed to initialize stand');
            }
        } catch (error) {
            message.error('Error initializing stand');
        }
    };

    const initializeEnvironment = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/environment/initialize`, { method: 'POST' });
            if (res.ok) {
                message.success('Environment sensor initialized');
                fetchStatuses();
            } else {
                message.error('Failed to initialize environment sensor');
            }
        } catch (error) {
            message.error('Error initializing environment sensor');
        }
    };

    /**
     * Apply heater calibration
     */
    const applyHeaterCalibration = async () => {
        try {
            // Set zone targets based on ambient + offsets
            const zone1Target = ambientTemp + zone1Offset;
            const zone2Target = ambientTemp + zone2Offset;
            const zone3Target = ambientTemp + zone3Offset;

            await Promise.all([
                fetch(`${API_BASE}/api/heating/zone/1/set-temperature`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ targetTemp: zone1Target })
                }),
                fetch(`${API_BASE}/api/heating/zone/2/set-temperature`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ targetTemp: zone2Target })
                }),
                fetch(`${API_BASE}/api/heating/zone/3/set-temperature`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ targetTemp: zone3Target })
                })
            ]);

            message.success('Heater calibration applied');
            fetchStatuses();
        } catch (error) {
            message.error('Error applying heater calibration');
        }
    };

    /**
     * Calibrate stand zero angle
     */
    const calibrateStandZero = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/stand/calibrate-zero`, { method: 'POST' });
            if (res.ok) {
                message.success('Stand zero angle calibrated');
                fetchStatuses();
            } else {
                message.error('Failed to calibrate stand');
            }
        } catch (error) {
            message.error('Error calibrating stand');
        }
    };

    /**
     * Test stand at specific angle
     */
    const testStandAngle = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/stand/set-angle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ angle: testAngle })
            });

            if (res.ok) {
                message.success(`Stand moved to ${testAngle}°`);
                fetchStatuses();
            } else {
                message.error('Failed to move stand');
            }
        } catch (error) {
            message.error('Error moving stand');
        }
    };

    /**
     * Apply environment sensor calibration
     */
    const applyEnvironmentCalibration = async () => {
        try {
            await Promise.all([
                fetch(`${API_BASE}/api/environment/calibrate-temperature`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ offset: tempOffset })
                }),
                fetch(`${API_BASE}/api/environment/calibrate-humidity`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ offset: humidityOffset })
                })
            ]);

            message.success('Environment sensor calibration applied');
            fetchStatuses();
        } catch (error) {
            message.error('Error applying environment calibration');
        }
    };

    /**
     * Get connection status tag
     */
    const getStatusTag = (connected: boolean, initialized: boolean) => {
        if (!connected) {
            return <Tag icon={<CloseCircleOutlined />} color="error">Disconnected</Tag>;
        }
        if (!initialized) {
            return <Tag icon={<WarningOutlined />} color="warning">Not Initialized</Tag>;
        }
        return <Tag icon={<CheckCircleOutlined />} color="success">Ready</Tag>;
    };

    /**
     * Fetch statuses on mount and set up polling
     */
    useEffect(() => {
        fetchStatuses();
        const interval = setInterval(fetchStatuses, 2000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="calibration-page">
            <h1 className="page-title">System Calibration</h1>
            <p className="page-description">
                Configure and calibrate all hardware subsystems for optimal performance
            </p>

            {/* Connection Diagnostics */}
            <Card title={<span><SyncOutlined /> Connection Diagnostics</span>} className="diagnostics-card">
                <Row gutter={[16, 16]}>
                    <Col xs={24} sm={8}>
                        <Card size="small" title="Heating System">
                            {heatingStatus ? (
                                <>
                                    {getStatusTag(heatingStatus.connected, heatingStatus.initialized)}
                                    {!heatingStatus.initialized && (
                                        <Button
                                            size="small"
                                            type="primary"
                                            onClick={initializeHeating}
                                            style={{ marginTop: 10 }}
                                        >
                                            Initialize
                                        </Button>
                                    )}
                                </>
                            ) : (
                                <Tag icon={<WarningOutlined />} color="default">No Data</Tag>
                            )}
                        </Card>
                    </Col>

                    <Col xs={24} sm={8}>
                        <Card size="small" title="Stand Controller">
                            {standStatus ? (
                                <>
                                    {getStatusTag(standStatus.connected, standStatus.initialized)}
                                    {!standStatus.initialized && (
                                        <Button
                                            size="small"
                                            type="primary"
                                            onClick={initializeStand}
                                            style={{ marginTop: 10 }}
                                        >
                                            Initialize
                                        </Button>
                                    )}
                                </>
                            ) : (
                                <Tag icon={<WarningOutlined />} color="default">No Data</Tag>
                            )}
                        </Card>
                    </Col>

                    <Col xs={24} sm={8}>
                        <Card size="small" title="Environment Sensor">
                            {environmentStatus ? (
                                <>
                                    {getStatusTag(environmentStatus.connected, environmentStatus.initialized)}
                                    {!environmentStatus.initialized && (
                                        <Button
                                            size="small"
                                            type="primary"
                                            onClick={initializeEnvironment}
                                            style={{ marginTop: 10 }}
                                        >
                                            Initialize
                                        </Button>
                                    )}
                                </>
                            ) : (
                                <Tag icon={<WarningOutlined />} color="default">No Data</Tag>
                            )}
                        </Card>
                    </Col>
                </Row>
            </Card>

            {/* Heater Calibration */}
            <Card
                title={<span><FireOutlined /> Heater Zone Calibration</span>}
                className="calibration-card"
            >
                <Alert
                    message="Heater Configuration"
                    description="Set target temperature offsets for each heating zone relative to ambient temperature. IEC standard: Head +14°C, Body/Legs +7°C"
                    type="info"
                    showIcon
                    style={{ marginBottom: 20 }}
                />

                <Row gutter={[24, 16]}>
                    <Col xs={24} md={12}>
                        <div className="calibration-item">
                            <label>Ambient Temperature (°C):</label>
                            <InputNumber
                                min={10}
                                max={35}
                                step={0.5}
                                value={ambientTemp}
                                onChange={(value) => setAmbientTemp(value || 20)}
                            />
                            <span className="hint">Current ambient temperature</span>
                        </div>

                        <Divider />

                        <div className="calibration-item">
                            <label>Zone 1 (Head) Offset (°C):</label>
                            <InputNumber
                                min={0}
                                max={20}
                                step={1}
                                value={zone1Offset}
                                onChange={(value) => setZone1Offset(value || 14)}
                            />
                            <span className="hint">Target: Ambient + {zone1Offset}°C = {ambientTemp + zone1Offset}°C</span>
                        </div>

                        <div className="calibration-item">
                            <label>Zone 2 (Body) Offset (°C):</label>
                            <InputNumber
                                min={0}
                                max={20}
                                step={1}
                                value={zone2Offset}
                                onChange={(value) => setZone2Offset(value || 7)}
                            />
                            <span className="hint">Target: Ambient + {zone2Offset}°C = {ambientTemp + zone2Offset}°C</span>
                        </div>

                        <div className="calibration-item">
                            <label>Zone 3 (Legs) Offset (°C):</label>
                            <InputNumber
                                min={0}
                                max={20}
                                step={1}
                                value={zone3Offset}
                                onChange={(value) => setZone3Offset(value || 7)}
                            />
                            <span className="hint">Target: Ambient + {zone3Offset}°C = {ambientTemp + zone3Offset}°C</span>
                        </div>

                        <Button
                            type="primary"
                            onClick={applyHeaterCalibration}
                            disabled={!heatingStatus?.initialized}
                            style={{ marginTop: 20 }}
                        >
                            Apply Heater Calibration
                        </Button>
                    </Col>

                    <Col xs={24} md={12}>
                        {heatingStatus && (
                            <div className="current-status">
                                <h4>Current Zone Status</h4>
                                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                                    <Card size="small">
                                        <Statistic
                                            title="Zone 1 (Head)"
                                            value={heatingStatus.zones.zone1.currentTemp}
                                            suffix="°C"
                                            prefix={heatingStatus.zones.zone1.enabled ? <FireOutlined /> : null}
                                        />
                                        <div style={{ marginTop: 10 }}>
                                            Target: {heatingStatus.zones.zone1.targetTemp}°C
                                        </div>
                                    </Card>

                                    <Card size="small">
                                        <Statistic
                                            title="Zone 2 (Body)"
                                            value={heatingStatus.zones.zone2.currentTemp}
                                            suffix="°C"
                                            prefix={heatingStatus.zones.zone2.enabled ? <FireOutlined /> : null}
                                        />
                                        <div style={{ marginTop: 10 }}>
                                            Target: {heatingStatus.zones.zone2.targetTemp}°C
                                        </div>
                                    </Card>

                                    <Card size="small">
                                        <Statistic
                                            title="Zone 3 (Legs)"
                                            value={heatingStatus.zones.zone3.currentTemp}
                                            suffix="°C"
                                            prefix={heatingStatus.zones.zone3.enabled ? <FireOutlined /> : null}
                                        />
                                        <div style={{ marginTop: 10 }}>
                                            Target: {heatingStatus.zones.zone3.targetTemp}°C
                                        </div>
                                    </Card>
                                </Space>
                            </div>
                        )}
                    </Col>
                </Row>
            </Card>

            {/* Stand Angle Calibration */}
            <Card
                title={<span><CompassOutlined /> Stand Angle Calibration</span>}
                className="calibration-card"
            >
                <Alert
                    message="Stand Configuration"
                    description="Calibrate detector stand zero angle and test rotation at standard angles (0°, 90°, 180°, 270°)"
                    type="info"
                    showIcon
                    style={{ marginBottom: 20 }}
                />

                <Row gutter={[24, 16]}>
                    <Col xs={24} md={12}>
                        <div className="calibration-section">
                            <h4>Zero Angle Calibration</h4>
                            <p>Set current position as 0° reference</p>
                            <Button
                                type="primary"
                                onClick={calibrateStandZero}
                                disabled={!standStatus?.initialized}
                            >
                                Calibrate Zero (0°)
                            </Button>
                        </div>

                        <Divider />

                        <div className="calibration-section">
                            <h4>Quick Angle Test</h4>
                            <p>Test stand rotation at standard angles</p>
                            <Space wrap>
                                <Button onClick={() => { setTestAngle(0); testStandAngle(); }} disabled={!standStatus?.initialized}>
                                    0°
                                </Button>
                                <Button onClick={() => { setTestAngle(90); testStandAngle(); }} disabled={!standStatus?.initialized}>
                                    90°
                                </Button>
                                <Button onClick={() => { setTestAngle(180); testStandAngle(); }} disabled={!standStatus?.initialized}>
                                    180°
                                </Button>
                                <Button onClick={() => { setTestAngle(270); testStandAngle(); }} disabled={!standStatus?.initialized}>
                                    270°
                                </Button>
                            </Space>
                        </div>

                        <Divider />

                        <div className="calibration-section">
                            <h4>Manual Angle Test</h4>
                            <Space>
                                <InputNumber
                                    min={0}
                                    max={359}
                                    step={5}
                                    value={testAngle}
                                    onChange={(value) => setTestAngle(value || 0)}
                                    addonAfter="°"
                                />
                                <Button
                                    type="primary"
                                    onClick={testStandAngle}
                                    disabled={!standStatus?.initialized}
                                >
                                    Go to Angle
                                </Button>
                            </Space>
                        </div>
                    </Col>

                    <Col xs={24} md={12}>
                        {standStatus && (
                            <div className="current-status">
                                <h4>Current Stand Status</h4>
                                <Card size="small">
                                    <div className="angle-display">
                                        <div className="angle-circle">
                                            <div
                                                className="angle-indicator"
                                                style={{ transform: `rotate(${standStatus.currentAngle}deg)` }}
                                            ></div>
                                        </div>
                                        <Statistic
                                            title="Current Angle"
                                            value={standStatus.currentAngle}
                                            suffix="°"
                                            precision={1}
                                        />
                                        {standStatus.isMoving && (
                                            <Tag icon={<SyncOutlined spin />} color="processing">Moving</Tag>
                                        )}
                                    </div>
                                </Card>
                            </div>
                        )}
                    </Col>
                </Row>
            </Card>

            {/* Environment Sensor Calibration */}
            <Card
                title={<span><EnvironmentOutlined /> Environment Sensor Calibration</span>}
                className="calibration-card"
            >
                <Alert
                    message="Sensor Calibration"
                    description="Apply offset corrections for temperature and humidity readings"
                    type="info"
                    showIcon
                    style={{ marginBottom: 20 }}
                />

                <Row gutter={[24, 16]}>
                    <Col xs={24} md={12}>
                        <div className="calibration-item">
                            <label>Temperature Offset (°C):</label>
                            <InputNumber
                                min={-10}
                                max={10}
                                step={0.1}
                                value={tempOffset}
                                onChange={(value) => setTempOffset(value || 0)}
                            />
                            <span className="hint">Add this value to raw readings</span>
                        </div>

                        <div className="calibration-item">
                            <label>Humidity Offset (% RH):</label>
                            <InputNumber
                                min={-20}
                                max={20}
                                step={0.5}
                                value={humidityOffset}
                                onChange={(value) => setHumidityOffset(value || 0)}
                            />
                            <span className="hint">Add this value to raw readings</span>
                        </div>

                        <Button
                            type="primary"
                            onClick={applyEnvironmentCalibration}
                            disabled={!environmentStatus?.initialized}
                            style={{ marginTop: 20 }}
                        >
                            Apply Environment Calibration
                        </Button>
                    </Col>

                    <Col xs={24} md={12}>
                        {environmentStatus && (
                            <div className="current-status">
                                <h4>Current Readings</h4>
                                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                                    <Card size="small">
                                        <Statistic
                                            title="Temperature"
                                            value={environmentStatus.currentTemperature}
                                            suffix="°C"
                                            precision={1}
                                        />
                                        <div style={{ marginTop: 10, fontSize: 12, color: '#999' }}>
                                            Offset: {environmentStatus.temperatureOffset}°C
                                        </div>
                                    </Card>

                                    <Card size="small">
                                        <Statistic
                                            title="Humidity"
                                            value={environmentStatus.currentHumidity}
                                            suffix="% RH"
                                            precision={1}
                                        />
                                        <div style={{ marginTop: 10, fontSize: 12, color: '#999' }}>
                                            Offset: {environmentStatus.humidityOffset}% RH
                                        </div>
                                    </Card>
                                </Space>
                            </div>
                        )}
                    </Col>
                </Row>
            </Card>
        </div>
    );
};

export default CalibrationPage;
