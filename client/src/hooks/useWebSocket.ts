import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

export interface WebSocketEvent {
    event: string;
    payload: any;
    timestamp: string;
}

export interface UseWebSocketOptions {
    url?: string;
    path?: string;
    onEvent?: (message: WebSocketEvent) => void;
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: Error) => void;
    autoReconnect?: boolean;
}

function deriveDefaultUrl(): string {
    const protocol = window.location.protocol === "https:" ? "https" : "http";
    const host = import.meta.env.VITE_SERVER_IP || window.location.hostname;
    const port = import.meta.env.VITE_SERVER_PORT || "3000";
    return `${protocol}://${host}:${port}`;
}

export function useWebSocket(options: UseWebSocketOptions) {
    const {
        url,
        path = "/socket.io",
        onEvent,
        onConnect,
        onDisconnect,
        onError,
        autoReconnect = true,
    } = options;

    const socketRef = useRef<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [lastEvent, setLastEvent] = useState<WebSocketEvent | null>(null);

    const connect = useCallback(() => {
        const targetUrl = url || deriveDefaultUrl();

        const socket = io(targetUrl, {
            path,
            autoConnect: true,
            transports: ["websocket"],
            reconnection: autoReconnect,
        });

        socket.on("connect", () => {
            setIsConnected(true);
            onConnect?.();
        });

        socket.on("disconnect", () => {
            setIsConnected(false);
            onDisconnect?.();
        });

        socket.on("connect_error", (err: Error) => {
            onError?.(err);
        });

        socket.onAny((event: string, payload: unknown) => {
            const message: WebSocketEvent = {
                event,
                payload,
                timestamp: new Date().toISOString(),
            };
            setLastEvent(message);
            onEvent?.(message);
        });

        socketRef.current = socket;
    }, [autoReconnect, onConnect, onDisconnect, onError, onEvent, path, url]);

    const disconnect = useCallback(() => {
        socketRef.current?.disconnect();
        socketRef.current = null;
        setIsConnected(false);
    }, []);

    const emit = useCallback((event: string, payload?: any) => {
        socketRef.current?.emit(event, payload);
    }, []);

    useEffect(() => {
        connect();
        return () => {
            disconnect();
        };
    }, [connect, disconnect]);

    return {
        isConnected,
        lastEvent,
        emit,
        disconnect,
        reconnect: connect,
    };
}

export default useWebSocket;
