import { useCallback, useEffect, useRef, useState } from "react";

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
        path = "/ws",
        onEvent,
        onConnect,
        onDisconnect,
        onError,
        autoReconnect = true,
    } = options;

    const socketRef = useRef<EventSource | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [lastEvent, setLastEvent] = useState<WebSocketEvent | null>(null);

    const cleanup = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.close();
            socketRef.current = null;
            onDisconnect?.();
        }
        setIsConnected(false);
    }, [onDisconnect]);

    const connect = useCallback(() => {
        const baseUrl = url || deriveDefaultUrl();
        const targetUrl = `${baseUrl}${path}`;

        cleanup();

        const socket = new EventSource(targetUrl);

        socket.onopen = () => {
            setIsConnected(true);
            onConnect?.();
        };

        socket.onerror = (event) => {
            const error = new Error((event as ErrorEvent).message || "EventSource error");
            setIsConnected(false);
            onError?.(error);
            if (!autoReconnect) {
                socket.close();
            }
        };

        const handleMessage = (event: MessageEvent) => {
            try {
                const parsed = JSON.parse(event.data);
                const message: WebSocketEvent = {
                    event: parsed.event ?? "message",
                    payload: parsed.payload,
                    timestamp: parsed.timestamp ?? new Date().toISOString(),
                };
                setLastEvent(message);
                onEvent?.(message);
            } catch {
                const message: WebSocketEvent = {
                    event: "message",
                    payload: event.data,
                    timestamp: new Date().toISOString(),
                };
                setLastEvent(message);
                onEvent?.(message);
            }
        };

        socket.onmessage = handleMessage;
        socket.addEventListener("message", handleMessage);

        socketRef.current = socket;
    }, [autoReconnect, cleanup, onConnect, onDisconnect, onError, onEvent, path, url]);

    const disconnect = useCallback(() => {
        cleanup();
    }, [cleanup]);

    const emit = useCallback((event: string, payload?: any) => {
        // SSE is one-way; no-op emit to keep API parity
        console.warn("emit is a no-op when using EventSource", { event, payload });
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
