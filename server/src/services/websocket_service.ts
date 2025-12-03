import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';

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
    private io: SocketIOServer | null = null;
    private clients: Set<Socket> = new Set();

    /**
     * Initialize WebSocket server
     */
    initialize(httpServer: HttpServer): void {
        this.io = new SocketIOServer(httpServer, {
            cors: {
                origin: "*", // Configure based on your needs
                methods: ["GET", "POST"]
            }
        });

        this.io.on('connection', (socket: Socket) => {
            console.log(`🔌 WebSocket client connected: ${socket.id}`);
            this.clients.add(socket);

            socket.on('disconnect', () => {
                console.log(`🔌 WebSocket client disconnected: ${socket.id}`);
                this.clients.delete(socket);
            });

            // Handle ping/pong for connection health
            socket.on('ping', () => {
                socket.emit('pong');
            });
        });

        console.log('🔌 WebSocket service initialized');
    }

    /**
     * Broadcast message to all connected clients
     */
    broadcast(event: string, data: any): void {
        if (!this.io) {
            return;
        }

        this.io.emit(event, data);
    }

    /**
     * Send message to specific client
     */
    sendToClient(socketId: string, event: string, data: any): void {
        if (!this.io) {
            return;
        }

        this.io.to(socketId).emit(event, data);
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
        return this.io !== null;
    }
}

// Export singleton
export const websocketService = new WebSocketService();
export default websocketService;
