import { Card, Button, Space, Typography, Statistic, Row, Col, message, Switch, Progress, InputNumber } from 'antd';
import { FireOutlined, PoweroffOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { api } from './apiAxios';

const { Text, Title } = Typography;


interface HeatingZoneStatus {
    zone: string;
    enabled: boolean;
    currentTemp: number;
    targetTemp: number;
    targetOffset: number;
    status: 'HEATING' | 'IDLE' | 'AT_TARGET' | 'ERROR';
    powerLevel?: number;
    minTemp?: number;
    maxTemp?: number;
    avgTemp?: number;
    lastUpdateTime: string;
}

interface HeatingSystemStatus {
    connected: boolean;
    initialized: boolean;
    ambientTemp: number;
    zones: HeatingZoneStatus[];
    allZonesEnabled: boolean;
    lastError?: string;
    lastUpdateTime: string;
}

const ZONE_COLORS = {
    HEAD: '#ff4d4f',
    BODY: '#1677ff',
    LEGS: '#52c41a'
};

const ZONE_ICONS = {
    HEAD: '🧠',
    BODY: '🫀',
    LEGS: '🦵'
};

export const HeatingZoneControl = () => {
    const [systemStatus, setSystemStatus] = useState<HeatingSystemStatus | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeTestId, setActiveTestId] = useState<number | undefined>(undefined);

    // Fetch system status
    const fetchStatus = async () => {
        try {
            const response = await api.get('/api/heating/status');
            setSystemStatus(response.data);
        } catch (error) {
            console.error('Failed to fetch heating status:', error);
        }
    };

    // Initialize heating system
    const handleInitialize = async () => {
        setLoading(true);
        try {
            const response = await api.post('/api/heating/initialize');
            message.success('Heating system initialized');
            setSystemStatus(response.data.status);
        } catch (error: any) {
            message.error(error.response?.data?.details || 'Failed to initialize heating system');
        } finally {
            setLoading(false);
        }
    };

    // Toggle zone heating
    const handleToggleZone = async (zone: string, currentlyEnabled: boolean) => {
        setLoading(true);
        try {
            const endpoint = currentlyEnabled ? '/api/heating/disable' : '/api/heating/enable';
            await api.post(endpoint, { zone, test_id: activeTestId });
            message.success(`${zone} heating ${currentlyEnabled ? 'disabled' : 'enabled'}`);
            fetchStatus();
        } catch (error: any) {
            message.error(error.response?.data?.details || 'Failed to toggle zone');
        } finally {
            setLoading(false);
        }
    };

    // Enable/disable all zones
    const handleToggleAll = async (enable: boolean) => {
        setLoading(true);
        try {
            const endpoint = enable ? '/api/heating/enable-all' : '/api/heating/disable-all';
            const response = await api.post(endpoint, { test_id: activeTestId });
            message.success(`All zones ${enable ? 'enabled' : 'disabled'}`);
            setSystemStatus(response.data.status);
        } catch (error: any) {
            message.error(error.response?.data?.details || 'Failed to toggle all zones');
        } finally {
            setLoading(false);
        }
    };

    // Set temperature offset
    const handleSetOffset = async (zone: string, offset: number) => {
        setLoading(true);
        try {
            await api.post('/api/heating/set-offset', { zone, offset, test_id: activeTestId });
            message.success(`${zone} offset set to +${offset}°C`);
            fetchStatus();
        } catch (error: any) {
            message.error(error.response?.data?.details || 'Failed to set offset');
        } finally {
            setLoading(false);
        }
    };

    // Fetch status on mount and set up polling
    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 2000); // Poll every 2 seconds
        return () => clearInterval(interval);
    }, []);

    const isConnected = systemStatus?.connected || false;
    const isInitialized = systemStatus?.initialized || false;
    const ambientTemp = systemStatus?.ambientTemp || 20;
    const zones = systemStatus?.zones || [];

    // Get status color
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'HEATING': return '#fa8c16';
            case 'AT_TARGET': return '#52c41a';
            case 'IDLE': return '#8c8c8c';
            case 'ERROR': return '#ff4d4f';
            default: return '#8c8c8c';
        }
    };

    // Get status text
    const getStatusText = (status: string) => {
        switch (status) {
            case 'HEATING': return '🔥 Heating';
            case 'AT_TARGET': return '✓ At Target';
            case 'IDLE': return '○ Idle';
            case 'ERROR': return '✗ Error';
            default: return status;
        }
    };

    return (
        <Card title="Thermal Manikin Heating Control" style={{ marginBottom: 16 }}>
            {/* System Status */}
            <Card size="small" style={{ marginBottom: 16, background: '#f0f2f5' }}>
                <Row gutter={16}>
                    <Col span={8}>
                        <Space direction="vertical" size={4}>
                            <Text type="secondary">Active Test ID (optional)</Text>
                            <InputNumber
                                min={1}
                                style={{ width: '100%' }}
                                value={activeTestId}
                                onChange={(v) => setActiveTestId(typeof v === 'number' ? v : undefined)}
                                placeholder="Enter test id"
                            />
                        </Space>
                    </Col>
                    <Col span={5}>
                        <Statistic
                            title="System Status"
                            value={isConnected ? (isInitialized ? 'Ready' : 'Not Initialized') : 'Disconnected'}
                            valueStyle={{
                                color: isConnected ? (isInitialized ? '#52c41a' : '#fa8c16') : '#ff4d4f',
                                fontSize: 16
                            }}
                        />
                    </Col>
                    <Col span={4}>
                        <Statistic
                            title="Ambient Temperature"
                            value={ambientTemp.toFixed(1)}
                            suffix="°C"
                            valueStyle={{ fontSize: 16 }}
                        />
                    </Col>
                    <Col span={3}>
                        <Statistic
                            title="Active Zones"
                            value={zones.filter(z => z.enabled).length}
                            suffix={`/ ${zones.length}`}
                            valueStyle={{ fontSize: 16 }}
                        />
                    </Col>
                    <Col span={4}>
                        {!isInitialized ? (
                            <Button
                                type="primary"
                                icon={<FireOutlined />}
                                onClick={handleInitialize}
                                loading={loading}
                                style={{ marginTop: 24 }}
                            >
                                Initialize
                            </Button>
                        ) : (
                            <Button
                                type={systemStatus?.allZonesEnabled ? 'default' : 'primary'}
                                icon={<PoweroffOutlined />}
                                onClick={() => handleToggleAll(!systemStatus?.allZonesEnabled)}
                                loading={loading}
                                style={{ marginTop: 24 }}
                            >
                                {systemStatus?.allZonesEnabled ? 'Disable All' : 'Enable All'}
                            </Button>
                        )}
                    </Col>
                </Row>
            </Card>

            {/* Heating Zones */}
            <Row gutter={16}>
                {zones.map((zone) => {
                    const tempProgress = zone.enabled
                        ? Math.min(100, ((zone.currentTemp - ambientTemp) / (zone.targetTemp - ambientTemp)) * 100)
                        : 0;

                    return (
                        <Col xs={24} md={8} key={zone.zone}>
                            <Card
                                size="small"
                                style={{
                                    marginBottom: 16,
                                    borderLeft: `4px solid ${ZONE_COLORS[zone.zone as keyof typeof ZONE_COLORS] || '#1677ff'}`,
                                    background: zone.enabled ? '#fff7e6' : '#fff'
                                }}
                            >
                                {/* Zone Header */}
                                <div style={{ marginBottom: 16 }}>
                                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                        <Space>
                                            <span style={{ fontSize: 24 }}>{ZONE_ICONS[zone.zone as keyof typeof ZONE_ICONS]}</span>
                                            <Title level={5} style={{ margin: 0 }}>{zone.zone}</Title>
                                        </Space>
                                        <Switch
                                            checked={zone.enabled}
                                            onChange={() => handleToggleZone(zone.zone, zone.enabled)}
                                            checkedChildren="ON"
                                            unCheckedChildren="OFF"
                                            disabled={!isInitialized || loading}
                                        />
                                    </Space>
                                </div>

                                {/* Temperature Display */}
                                <Row gutter={8} style={{ marginBottom: 12 }}>
                                    <Col span={12}>
                                        <Statistic
                                            title="Current"
                                            value={zone.currentTemp.toFixed(1)}
                                            suffix="°C"
                                            valueStyle={{
                                                fontSize: 20,
                                                color: zone.enabled ? '#fa8c16' : '#8c8c8c'
                                            }}
                                        />
                                    </Col>
                                    <Col span={12}>
                                        <Statistic
                                            title="Target"
                                            value={zone.targetTemp.toFixed(1)}
                                            suffix="°C"
                                            valueStyle={{ fontSize: 20 }}
                                        />
                                    </Col>
                                </Row>

                                {/* Progress Bar */}
                                {zone.enabled && (
                                    <Progress
                                        percent={Math.round(tempProgress)}
                                        status={zone.status === 'AT_TARGET' ? 'success' : 'active'}
                                        strokeColor={ZONE_COLORS[zone.zone as keyof typeof ZONE_COLORS]}
                                        size="small"
                                        style={{ marginBottom: 12 }}
                                    />
                                )}

                                {/* Status */}
                                <div style={{ marginBottom: 12 }}>
                                    <Text strong style={{ color: getStatusColor(zone.status) }}>
                                        {getStatusText(zone.status)}
                                    </Text>
                                    {zone.powerLevel !== undefined && zone.powerLevel > 0 && (
                                        <Text type="secondary" style={{ marginLeft: 8 }}>
                                            ({zone.powerLevel}% power)
                                        </Text>
                                    )}
                                </div>

                                {/* Offset Control */}
                                <div style={{ marginBottom: 12 }}>
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                        Offset from ambient: +{zone.targetOffset.toFixed(1)}°C
                                    </Text>
                                    <div style={{ marginTop: 4 }}>
                                        <Space size="small">
                                            {[7, 10, 14].map((offset) => (
                                                <Button
                                                    key={offset}
                                                    size="small"
                                                    onClick={() => handleSetOffset(zone.zone, offset)}
                                                    disabled={!isInitialized || loading}
                                                    type={zone.targetOffset === offset ? 'primary' : 'default'}
                                                >
                                                    +{offset}°C
                                                </Button>
                                            ))}
                                        </Space>
                                    </div>
                                </div>

                                {/* Statistics */}
                                {zone.minTemp !== undefined && zone.maxTemp !== undefined && (
                                    <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
                                        <Row gutter={8}>
                                            <Col span={8}>
                                                <Text type="secondary" style={{ fontSize: 11 }}>
                                                    Min: {zone.minTemp.toFixed(1)}°C
                                                </Text>
                                            </Col>
                                            <Col span={8}>
                                                <Text type="secondary" style={{ fontSize: 11 }}>
                                                    Avg: {zone.avgTemp?.toFixed(1)}°C
                                                </Text>
                                            </Col>
                                            <Col span={8}>
                                                <Text type="secondary" style={{ fontSize: 11 }}>
                                                    Max: {zone.maxTemp.toFixed(1)}°C
                                                </Text>
                                            </Col>
                                        </Row>
                                    </div>
                                )}
                            </Card>
                        </Col>
                    );
                })}
            </Row>

            {/* Information */}
            <Card size="small" style={{ background: '#e6f7ff', borderLeft: '4px solid #1677ff' }}>
                <Text strong>ℹ️ Standard Temperature Offsets (EN 50131):</Text>
                <ul style={{ marginTop: 8, marginBottom: 0 }}>
                    <li>Head: Ambient + 14°C</li>
                    <li>Body: Ambient + 7°C</li>
                    <li>Legs: Ambient + 7°C</li>
                </ul>
            </Card>
        </Card>
    );
};

export default HeatingZoneControl;
