import { useEffect, useRef, useState, useCallback } from "react";

export interface WebSocketMessage {
    type: string;
    data: any;
    timestamp: string;
}

export interface UseWebSocketOptions {
    url: string;
    onMessage?: (message: WebSocketMessage) => void;
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: Event) => void;
    autoReconnect?: boolean;
    reconnectInterval?: number;
}

export function useWebSocket(options: UseWebSocketOptions) {
    const {
        url,
        onMessage,
        onConnect,
        onDisconnect,
        onError,
        autoReconnect = true,
        reconnectInterval = 3000
    } = options;

    const wsRef = useRef<WebSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
    const shouldReconnect = useRef(true);

    const connect = useCallback(() => {
        try {
            const ws = new WebSocket(url);

            ws.onopen = () => {
                console.log("[WebSocket] Connected");
                setIsConnected(true);
                if (onConnect) onConnect();
            };

            ws.onmessage = (event) => {
                try {
                    const message: WebSocketMessage = JSON.parse(event.data);
                    setLastMessage(message);
                    if (onMessage) onMessage(message);
                } catch (error) {
                    console.error("[WebSocket] Error parsing message:", error);
                }
            };

            ws.onclose = () => {
                console.log("[WebSocket] Disconnected");
                setIsConnected(false);
                wsRef.current = null;
                if (onDisconnect) onDisconnect();

                // Auto-reconnect if enabled
                if (autoReconnect && shouldReconnect.current) {
                    console.log(`[WebSocket] Reconnecting in ${reconnectInterval}ms...`);
                    reconnectTimeoutRef.current = setTimeout(() => {
                        connect();
                    }, reconnectInterval);
                }
            };

            ws.onerror = (error) => {
                console.error("[WebSocket] Error:", error);
                if (onError) onError(error);
            };

            wsRef.current = ws;
        } catch (error) {
            console.error("[WebSocket] Connection failed:", error);
        }
    }, [url, onConnect, onMessage, onDisconnect, onError, autoReconnect, reconnectInterval]);

    const disconnect = useCallback(() => {
        shouldReconnect.current = false;
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        setIsConnected(false);
    }, []);

    const send = useCallback((data: any) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(data));
        } else {
            console.warn("[WebSocket] Cannot send message - not connected");
        }
    }, []);

    const subscribe = useCallback((channels: string[]) => {
        send({ type: "subscribe", data: { channels } });
    }, [send]);

    const unsubscribe = useCallback((channels: string[]) => {
        send({ type: "unsubscribe", data: { channels } });
    }, [send]);

    // Connect on mount
    useEffect(() => {
        shouldReconnect.current = true;
        connect();

        // Cleanup on unmount
        return () => {
            shouldReconnect.current = false;
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, [connect]);

    return {
        isConnected,
        lastMessage,
        send,
        subscribe,
        unsubscribe,
        disconnect,
        reconnect: connect
    };
}

export default useWebSocket;
