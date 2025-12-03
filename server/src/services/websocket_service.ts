import type { Application, Response } from "express";

/**
 * WebSocket Service - Real-time communication with frontend
 * 
 * Features:
 * - Broadcasts test progress updates
 * - Broadcasts sensor detection events
 * - Broadcasts test status changes
 * - Handles client connections/disconnections
 */
class WebSocketService {
    private initialized = false;
    private clients: Set<Response> = new Set();

    /**
     * Initialize WebSocket server
     */
    initialize(app: Application): void {
        if (this.initialized) return;

        app.get("/ws", (req, res) => {
            res.setHeader("Content-Type", "text/event-stream");
            res.setHeader("Cache-Control", "no-cache");
            res.setHeader("Connection", "keep-alive");
            res.flushHeaders?.();

            this.clients.add(res);

            const keepAlive = setInterval(() => {
                res.write(`: heartbeat ${Date.now()}\n\n`);
            }, 15000);

            res.write(`data: ${JSON.stringify({
                event: "connected",
                payload: { message: "ok" },
                timestamp: new Date().toISOString(),
            })}\n\n`);

            req.on("close", () => {
                clearInterval(keepAlive);
                this.clients.delete(res);
            });
        });

        this.initialized = true;
        console.log("🔌 SSE stream initialized at /ws");
    }

    /**
     * Broadcast message to all connected clients
     */
    broadcast(event: string, data: any): void {
        if (!this.initialized) return;

        const body = JSON.stringify({
            event,
            payload: data,
            timestamp: new Date().toISOString(),
        });

        this.clients.forEach((res) => {
            res.write(`data: ${body}\n\n`);
        });
    }

    /**
     * Send message to specific client
     */
    sendToClient(_socketId: string, event: string, data: any): void {
        // SSE is broadcast-only; fall back to broadcast
        this.broadcast(event, data);
    }

    /**
     * Broadcast test progress update
     */
    broadcastTestProgress(testId: number, progress: {
        phase: string;
        currentStep: number;
        totalSteps: number;
        status: string;
        message?: string;
    }): void {
        this.broadcast('test-progress', {
            testId,
            ...progress,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Broadcast test status change
     */
    broadcastTestStatus(testId: number, status: string, details?: any): void {
        this.broadcast('test-status', {
            testId,
            status,
            details,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Broadcast sensor detection
     */
    broadcastSensorDetection(event: any): void {
        this.broadcast('sensor-detection', {
            ...event,
            timestamp: event.timestamp || new Date().toISOString()
        });
    }

    /**
     * Broadcast error
     */
    broadcastError(testId: number | null, error: string): void {
        this.broadcast('test-error', {
            testId,
            error,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Get connection count
     */
    getConnectionCount(): number {
        return this.clients.size;
    }

    /**
     * Check if initialized
     */
    isInitialized(): boolean {
        return this.initialized;
    }
}

// Export singleton
export const websocketService = new WebSocketService();
export default websocketService;
