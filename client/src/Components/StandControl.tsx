import { Card, Button, Statistic, Space, InputNumber, Tag, message } from "antd";
import { SyncOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import { useEffect, useState } from "react";
import { api } from "./apiAxios";

type StandStatus = {
    connected?: boolean;
    initialized?: boolean;
    currentAngle?: number;
    isMoving?: boolean;
};

/**
 * StandControl
 *
 * Lightweight stand angle control with status, quick step, and go-to-angle.
 */
const StandControl = () => {
    const [status, setStatus] = useState<StandStatus | null>(null);
    const [targetAngle, setTargetAngle] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(false);

    const fetchStatus = async () => {
        try {
            const res = await api.get("/api/stand/status");
            setStatus(res.data);
            if (res.data?.currentAngle !== undefined) {
                setTargetAngle(res.data.currentAngle);
            }
        } catch (err) {
            console.error("Failed to fetch stand status:", err);
        }
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 2000);
        return () => clearInterval(interval);
    }, []);

    const handleInit = async () => {
        setLoading(true);
        try {
            await api.post("/api/stand/initialize");
            message.success("Stand initialized");
            fetchStatus();
        } catch (err) {
            console.error("Failed to initialize stand:", err);
            message.error("Failed to initialize stand");
        } finally {
            setLoading(false);
        }
    };

    const handleSetAngle = async (angle: number) => {
        setLoading(true);
        try {
            await api.post("/api/stand/set-angle", { angle });
            message.success(`Stand moving to ${angle}°`);
            setTargetAngle(angle);
            fetchStatus();
        } catch (err) {
            console.error("Failed to set angle:", err);
            message.error("Failed to set angle");
        } finally {
            setLoading(false);
        }
    };

    const handleStep = async (delta: number) => {
        setLoading(true);
        try {
            await api.post("/api/stand/step-angle", { delta });
            message.success(`Stand stepped ${delta > 0 ? "+" : ""}${delta}°`);
            fetchStatus();
        } catch (err) {
            console.error("Failed to step angle:", err);
            message.error("Failed to step angle");
        } finally {
            setLoading(false);
        }
    };

    const connected = status?.connected;
    const initialized = status?.initialized;

    return (
        <Card
            title="Stand Control"
            extra={
                <Space>
                    <Button size="small" onClick={() => void handleStep(-5)} disabled={!initialized} loading={loading}>-5°</Button>
                    <Button size="small" onClick={() => void handleStep(5)} disabled={!initialized} loading={loading}>+5°</Button>
                </Space>
            }
        >
            <Space direction="vertical" style={{ width: "100%" }}>
                <Space>
                    {connected ? (
                        initialized ? (
                            <Tag icon={<CheckCircleOutlined />} color="success">Ready</Tag>
                        ) : (
                            <Tag icon={<ExclamationCircleOutlined />} color="warning">Not initialized</Tag>
                        )
                    ) : (
                        <Tag color="error">Disconnected</Tag>
                    )}
                    {status?.isMoving && <Tag icon={<SyncOutlined spin />} color="processing">Moving</Tag>}
                </Space>
                <Statistic
                    title="Current Angle"
                    value={status?.currentAngle ?? "N/A"}
                    suffix={status?.currentAngle !== undefined ? "°" : ""}
                />
                <Space.Compact>
                    <InputNumber
                        min={0}
                        max={359}
                        step={1}
                        value={targetAngle}
                        onChange={(v) => setTargetAngle(v ?? 0)}
                        style={{ width: "100%" }}
                    />
                    <Button type="primary" onClick={() => void handleSetAngle(targetAngle)} disabled={!initialized} loading={loading}>Go</Button>
                </Space.Compact>
                <Button onClick={() => void handleInit()} loading={loading} disabled={initialized}>
                    Initialize Stand
                </Button>
            </Space>
        </Card>
    );
};

export default StandControl;
