import { Card, Button, Space, InputNumber, Typography, Statistic, Row, Col, message } from 'antd';
import { RotateLeftOutlined, RotateRightOutlined, AimOutlined, SyncOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { api } from './apiAxios';

const { Text, Title } = Typography;

/**
 * Stand Angle Control Component
 *
 * Provides manual control of the rotating stand for detector positioning.
 * Features:
 * - Current angle display with rotating visual indicator
 * - Manual angle input (0-360°)
 * - Step buttons for fine control (±5°, ±10°)
 * - Zero calibration
 * - Connection status
 */

interface StandStatus {
    connected: boolean;
    initialized: boolean;
    currentAngle: number;
    isMoving: boolean;
    lastError?: string;
    lastUpdateTime: string;
}

export const StandAngleControl = () => {
    const [status, setStatus] = useState<StandStatus | null>(null);
    const [targetAngle, setTargetAngle] = useState<number>(0);
    const [loading, setLoading] = useState(false);

    // Fetch current stand status
    const fetchStatus = async () => {
        try {
            const response = await api.get('/api/stand/status');
            setStatus(response.data);
            setTargetAngle(response.data.currentAngle);
        } catch (error) {
            console.error('Failed to fetch stand status:', error);
        }
    };

    // Initialize stand
    const handleInitialize = async () => {
        setLoading(true);
        try {
            const response = await api.post('/api/stand/initialize');
            message.success('Stand initialized successfully');
            setStatus(response.data.status);
        } catch (error: any) {
            message.error(error.response?.data?.details || 'Failed to initialize stand');
        } finally {
            setLoading(false);
        }
    };

    // Set specific angle
    const handleSetAngle = async () => {
        if (targetAngle < 0 || targetAngle >= 360) {
            message.error('Angle must be between 0 and 360');
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/api/stand/set-angle', { angle: targetAngle });
            message.success(`Detector rotated to ${targetAngle.toFixed(1)}°`);
            setStatus(response.data.status);
        } catch (error: any) {
            message.error(error.response?.data?.details || 'Failed to set angle');
        } finally {
            setLoading(false);
        }
    };

    // Step angle by delta
    const handleStepAngle = async (delta: number) => {
        setLoading(true);
        try {
            const response = await api.post('/api/stand/step-angle', { delta });
            message.success(`Detector stepped ${delta > 0 ? '+' : ''}${delta}°`);
            setStatus(response.data.status);
            setTargetAngle(response.data.status.currentAngle);
        } catch (error: any) {
            message.error(error.response?.data?.details || 'Failed to step angle');
        } finally {
            setLoading(false);
        }
    };

    // Calibrate zero angle
    const handleCalibrateZero = async () => {
        setLoading(true);
        try {
            const response = await api.post('/api/stand/calibrate');
            message.success('Zero angle calibrated');
            setStatus(response.data.status);
            setTargetAngle(0);
        } catch (error: any) {
            message.error(error.response?.data?.details || 'Failed to calibrate');
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

    const currentAngle = status?.currentAngle || 0;
    const isConnected = status?.connected || false;
    const isInitialized = status?.initialized || false;
    const isMoving = status?.isMoving || false;

    return (
        <Card title="Detector Angle Control" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
                {/* Current Angle Display */}
                <Col xs={24} md={8}>
                    <Card size="small" style={{ marginBottom: 16, textAlign: 'center' }}>
                        <Title level={4}>Current Angle</Title>

                        {/* Rotating Visual Indicator */}
                        <div
                            style={{
                                width: '120px',
                                height: '120px',
                                margin: '20px auto',
                                borderRadius: '50%',
                                border: '3px solid #1677ff',
                                position: 'relative',
                                background: '#f0f2f5'
                            }}
                        >
                            {/* Angle markers */}
                            <div style={{ position: 'absolute', top: '5px', left: '50%', transform: 'translateX(-50%)', fontSize: '12px', fontWeight: 'bold' }}>
                                0°
                            </div>
                            <div style={{ position: 'absolute', right: '5px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', fontWeight: 'bold' }}>
                                90°
                            </div>
                            <div style={{ position: 'absolute', bottom: '5px', left: '50%', transform: 'translateX(-50%)', fontSize: '12px', fontWeight: 'bold' }}>
                                180°
                            </div>
                            <div style={{ position: 'absolute', left: '5px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', fontWeight: 'bold' }}>
                                270°
                            </div>

                            {/* Rotating indicator */}
                            <div
                                style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    width: '4px',
                                    height: '40px',
                                    background: '#52c41a',
                                    transformOrigin: 'bottom center',
                                    transform: `translate(-50%, -100%) rotate(${currentAngle}deg)`,
                                    transition: 'transform 0.3s ease'
                                }}
                            />

                            {/* Center dot */}
                            <div
                                style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    width: '8px',
                                    height: '8px',
                                    background: '#1677ff',
                                    borderRadius: '50%',
                                    transform: 'translate(-50%, -50%)'
                                }}
                            />
                        </div>

                        <Statistic
                            value={currentAngle.toFixed(1)}
                            suffix="°"
                            valueStyle={{ fontSize: 28, color: '#1677ff' }}
                        />

                        <Space direction="vertical" size="small" style={{ marginTop: 16, width: '100%' }}>
                            <Text type="secondary">
                                Status: {isConnected ? (isInitialized ? '✓ Ready' : '⚠ Not Initialized') : '✗ Disconnected'}
                            </Text>
                            {isMoving && (
                                <Text type="warning">
                                    <SyncOutlined spin /> Moving...
                                </Text>
                            )}
                        </Space>
                    </Card>
                </Col>

                {/* Manual Control */}
                <Col xs={24} md={16}>
                    {/* Initialize Button */}
                    {!isInitialized && (
                        <Card size="small" style={{ marginBottom: 16, background: '#fff7e6' }}>
                            <Text strong>Stand not initialized</Text>
                            <br />
                            <Button
                                type="primary"
                                onClick={handleInitialize}
                                loading={loading}
                                style={{ marginTop: 8 }}
                            >
                                Initialize Stand
                            </Button>
                        </Card>
                    )}

                    {/* Step Control Buttons */}
                    <Card size="small" title="Quick Step Control" style={{ marginBottom: 16 }}>
                        <Space wrap>
                            <Button
                                icon={<RotateLeftOutlined />}
                                onClick={() => handleStepAngle(-10)}
                                disabled={!isInitialized || loading}
                                loading={loading}
                            >
                                -10°
                            </Button>
                            <Button
                                icon={<RotateLeftOutlined />}
                                onClick={() => handleStepAngle(-5)}
                                disabled={!isInitialized || loading}
                                loading={loading}
                            >
                                -5°
                            </Button>
                            <Button
                                icon={<RotateRightOutlined />}
                                onClick={() => handleStepAngle(5)}
                                disabled={!isInitialized || loading}
                                loading={loading}
                            >
                                +5°
                            </Button>
                            <Button
                                icon={<RotateRightOutlined />}
                                onClick={() => handleStepAngle(10)}
                                disabled={!isInitialized || loading}
                                loading={loading}
                            >
                                +10°
                            </Button>
                        </Space>
                    </Card>

                    {/* Set Specific Angle */}
                    <Card size="small" title="Set Specific Angle" style={{ marginBottom: 16 }}>
                        <Space>
                            <InputNumber
                                min={0}
                                max={359.9}
                                step={0.1}
                                value={targetAngle}
                                onChange={(value) => setTargetAngle(value || 0)}
                                addonAfter="°"
                                style={{ width: 120 }}
                                disabled={!isInitialized || loading}
                            />
                            <Button
                                type="primary"
                                icon={<AimOutlined />}
                                onClick={handleSetAngle}
                                disabled={!isInitialized || loading}
                                loading={loading}
                            >
                                Go to Angle
                            </Button>
                        </Space>
                    </Card>

                    {/* Quick Angles */}
                    <Card size="small" title="Quick Angles">
                        <Space wrap>
                            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
                                <Button
                                    key={angle}
                                    size="small"
                                    onClick={() => {
                                        setTargetAngle(angle);
                                        api.post('/api/stand/set-angle', { angle })
                                            .then((response) => {
                                                message.success(`Moved to ${angle}°`);
                                                setStatus(response.data.status);
                                            })
                                            .catch(() => message.error('Failed to move'));
                                    }}
                                    disabled={!isInitialized || loading}
                                >
                                    {angle}°
                                </Button>
                            ))}
                        </Space>

                        <div style={{ marginTop: 16 }}>
                            <Button
                                size="small"
                                onClick={handleCalibrateZero}
                                disabled={!isInitialized || loading}
                                loading={loading}
                            >
                                Calibrate Current as 0°
                            </Button>
                        </div>
                    </Card>
                </Col>
            </Row>
        </Card>
    );
};

export default StandAngleControl;
