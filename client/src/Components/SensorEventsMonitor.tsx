import { useEffect, useState } from "react";
import { Card, List, Tag, Typography, Space, Badge } from "antd";
import { api } from "./apiAxios.ts";

const { Text, Title } = Typography;

interface SensorEvent {
  sensorId: string;
  mac: string;
  event: string;
  raw: string;
  timestamp: string;
}

/**
 * Hook to connect to the sensor events SSE stream
 */
export function useSensorEvents() {
  const [events, setEvents] = useState<SensorEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<SensorEvent | null>(null);

  useEffect(() => {
    // Get the base URL from the axios instance
    const baseURL = api.defaults.baseURL || "";
    const eventSource = new EventSource(
      `${baseURL}/api/sensor-events/stream`
    );

    eventSource.addEventListener("connected", () => {
      setConnected(true);
      console.log("Connected to sensor events stream");
    });

    eventSource.addEventListener("sensor-event", (event) => {
      const data: SensorEvent = JSON.parse(event.data);
      setEvents((prev) => [data, ...prev].slice(0, 100)); // Keep last 100 events
      setLastEvent(data);
    });

    eventSource.onerror = (error) => {
      setConnected(false);
      console.error("Sensor events SSE error:", error);
    };

    return () => {
      eventSource.close();
      setConnected(false);
    };
  }, []);

  return { events, connected, lastEvent };
}

/**
 * Component to display real-time sensor events
 */
export default function SensorEventsMonitor() {
  const { events, connected, lastEvent } = useSensorEvents();

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case "MovementDetected":
        return "red";
      default:
        return "blue";
    }
  };

  return (
    <Card
      title={
        <Space>
          <Title level={5} style={{ margin: 0 }}>
            Sensor Events Monitor
          </Title>
          <Badge
            status={connected ? "success" : "default"}
            text={connected ? "Connected" : "Disconnected"}
          />
        </Space>
      }
      style={{ height: "100%" }}
    >
      {lastEvent && (
        <Card
          size="small"
          style={{
            marginBottom: 16,
            backgroundColor: "#fff7e6",
            borderColor: "#ffa940",
          }}
        >
          <Space direction="vertical" size={4}>
            <Text strong>Latest Event</Text>
            <Space>
              <Tag color={getEventColor(lastEvent.event)}>
                {lastEvent.event}
              </Tag>
              <Text type="secondary">{lastEvent.sensorId}</Text>
            </Space>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {formatTimestamp(lastEvent.timestamp)}
            </Text>
          </Space>
        </Card>
      )}

      <List
        size="small"
        dataSource={events}
        locale={{ emptyText: "No events received yet" }}
        renderItem={(event) => (
          <List.Item>
            <Space direction="vertical" size={2} style={{ width: "100%" }}>
              <Space>
                <Tag color={getEventColor(event.event)}>{event.event}</Tag>
                <Text>{event.sensorId}</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {event.mac}
                </Text>
              </Space>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {formatTimestamp(event.timestamp)}
              </Text>
            </Space>
          </List.Item>
        )}
        style={{ maxHeight: 400, overflowY: "auto" }}
      />

      {events.length > 0 && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          Total events: {events.length}
        </Text>
      )}
    </Card>
  );
}
