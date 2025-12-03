import { EventEmitter } from "events";
import { ISerialManager } from "../SerialManager";

/**
 * Mock SerialManager - Simulates robot behavior for testing
 * 
 * Features:
 * - Simulates connection/disconnection
 * - Simulates movement with realistic timing
 * - Battery simulation with drain
 * - Position tracking
 * - Realistic command responses
 * - Error simulation (connection loss, movement failures, battery low)
 */
export class MockSerialManager extends EventEmitter implements ISerialManager {
    private static _instance: MockSerialManager;
    private _connected: boolean = false;
    private _batteryLevel: number = 100; // 0-100
    private _position: { x: number; y: number; theta: number } = { x: 0, y: 0, theta: 0 };
    private _isMoving: boolean = false;
    
    // Configuration
    private readonly BATTERY_DRAIN_PER_MOVE = 0.5; // % per movement
    private readonly MOVEMENT_DELAY_MS = 1500; // Simulate realistic movement time
    private readonly CONNECTION_DELAY_MS = 500;

    private constructor() {
        super();
    }

    static get instance(): MockSerialManager {
        if (!this._instance) {
            this._instance = new MockSerialManager();
        }
        return this._instance;
    }

    get connected(): boolean {
        return this._connected;
    }

    get batteryLevel(): number {
        return this._batteryLevel;
    }

    get position(): { x: number; y: number; theta: number } {
        return { ...this._position };
    }

    get isMoving(): boolean {
        return this._isMoving;
    }

    /**
     * Simulate connection to robot
     */
    async connect(path: string, baudRate: number = 115200): Promise<void> {
        if (this._connected) {
            throw new Error("Already connected");
        }

        console.log(`🎭 [Mock] Connecting to ${path} at ${baudRate} baud...`);
        
        // Simulate connection delay
        await this.delay(this.CONNECTION_DELAY_MS);
        
        this._connected = true;
        this._batteryLevel = 100;
        this._position = { x: 0, y: 0, theta: 0 };
        
        this.emit("connected");
        console.log(`🎭 [Mock] Connected! Battery: ${this._batteryLevel}%`);
    }

    /**
     * Simulate disconnection
     */
    async disconnect(): Promise<void> {
        if (!this._connected) {
            return;
        }

        console.log("🎭 [Mock] Disconnecting...");
        this._connected = false;
        this._isMoving = false;
        this.emit("disconnected");
    }

    /**
     * Send command to mock robot
     */
    async send(line: string): Promise<void> {
        if (!this._connected) {
            throw new Error("Not connected");
        }

        const command = line.trim();
        console.log(`🎭 [Mock] Received command: ${command}`);

        // Parse and handle command
        try {
            await this.handleCommand(command);
        } catch (error: any) {
            this.emit("error", error);
            throw error;
        }
    }

    /**
     * Handle specific commands
     */
    private async handleCommand(command: string): Promise<void> {
        // Check battery before any movement
        if (this._batteryLevel <= 10 && !command.startsWith("STOP") && !command.startsWith("GET")) {
            this.emit("error", new Error("Battery too low"));
            return;
        }

        if (command.startsWith("MOVE")) {
            await this.handleMove(command);
        } else if (command.startsWith("ROTATE")) {
            await this.handleRotate(command);
        } else if (command === "STOP") {
            await this.handleStop();
        } else if (command === "GET_POSITION") {
            await this.handleGetPosition();
        } else if (command === "GET_BATTERY") {
            await this.handleGetBattery();
        } else {
            console.log(`🎭 [Mock] Unknown command: ${command}`);
            this.emit("data", `ERROR: Unknown command\n`);
        }
    }

    /**
     * Simulate MOVE command (forward/backward in cm)
     */
    private async handleMove(command: string): Promise<void> {
        const match = command.match(/MOVE\s+(-?\d+\.?\d*)/);
        if (!match) {
            this.emit("data", "ERROR: Invalid MOVE syntax\n");
            return;
        }

        const distance = parseFloat(match[1]);
        console.log(`🎭 [Mock] Moving ${distance} cm`);

        this._isMoving = true;
        
        // Simulate movement delay
        await this.delay(this.MOVEMENT_DELAY_MS);

        // Update position (assuming forward is +x direction)
        const radians = (this._position.theta * Math.PI) / 180;
        this._position.x += distance * Math.cos(radians);
        this._position.y += distance * Math.sin(radians);

        // Drain battery
        this._batteryLevel = Math.max(0, this._batteryLevel - this.BATTERY_DRAIN_PER_MOVE);

        this._isMoving = false;

        console.log(`🎭 [Mock] Move complete. Position: (${this._position.x.toFixed(1)}, ${this._position.y.toFixed(1)}), Battery: ${this._batteryLevel.toFixed(1)}%`);
        
        this.emit("data", `OK: Moved ${distance} cm\n`);

        // Check if battery is critically low
        if (this._batteryLevel <= 10) {
            console.log("🎭 [Mock] ⚠️ Battery critically low!");
            this.emit("error", new Error("Battery low"));
        }
    }

    /**
     * Simulate ROTATE command (in degrees)
     */
    private async handleRotate(command: string): Promise<void> {
        const match = command.match(/ROTATE\s+(-?\d+\.?\d*)/);
        if (!match) {
            this.emit("data", "ERROR: Invalid ROTATE syntax\n");
            return;
        }

        const angle = parseFloat(match[1]);
        console.log(`🎭 [Mock] Rotating ${angle} degrees`);

        this._isMoving = true;
        
        // Simulate rotation delay (proportional to angle)
        const rotationTime = Math.abs(angle) * 10; // 10ms per degree
        await this.delay(rotationTime);

        // Update orientation
        this._position.theta = (this._position.theta + angle) % 360;
        if (this._position.theta < 0) this._position.theta += 360;

        // Drain battery (less than movement)
        this._batteryLevel = Math.max(0, this._batteryLevel - this.BATTERY_DRAIN_PER_MOVE * 0.3);

        this._isMoving = false;

        console.log(`🎭 [Mock] Rotation complete. Orientation: ${this._position.theta.toFixed(1)}°, Battery: ${this._batteryLevel.toFixed(1)}%`);
        
        this.emit("data", `OK: Rotated ${angle} degrees\n`);
    }

    /**
     * Simulate STOP command
     */
    private async handleStop(): Promise<void> {
        console.log("🎭 [Mock] Stopping...");
        this._isMoving = false;
        this.emit("data", "OK: Stopped\n");
    }

    /**
     * Simulate GET_POSITION command
     */
    private async handleGetPosition(): Promise<void> {
        const response = `POSITION: x=${this._position.x.toFixed(2)} y=${this._position.y.toFixed(2)} theta=${this._position.theta.toFixed(2)}\n`;
        this.emit("data", response);
    }

    /**
     * Simulate GET_BATTERY command
     */
    private async handleGetBattery(): Promise<void> {
        const response = `BATTERY: ${this._batteryLevel.toFixed(1)}%\n`;
        this.emit("data", response);
    }

    /**
     * Mock control methods (for testing)
     */

    /**
     * Set battery level (for testing scenarios)
     */
    setBatteryLevel(level: number): void {
        this._batteryLevel = Math.max(0, Math.min(100, level));
        console.log(`🎭 [Mock] Battery set to ${this._batteryLevel}%`);
    }

    /**
     * Trigger low battery event (for testing)
     */
    triggerLowBattery(): void {
        this._batteryLevel = 5;
        console.log("🎭 [Mock] Low battery triggered!");
        this.emit("error", new Error("Battery low"));
    }

    /**
     * Simulate connection loss (for testing)
     */
    simulateConnectionLoss(): void {
        if (this._connected) {
            console.log("🎭 [Mock] Simulating connection loss...");
            this._connected = false;
            this._isMoving = false;
            this.emit("error", new Error("Connection lost"));
            this.emit("disconnected");
        }
    }

    /**
     * Recharge battery (for testing)
     */
    recharge(): void {
        this._batteryLevel = 100;
        console.log("🎭 [Mock] Battery recharged to 100%");
    }

    /**
     * Reset position to origin (for testing)
     */
    resetPosition(): void {
        this._position = { x: 0, y: 0, theta: 0 };
        console.log("🎭 [Mock] Position reset to origin");
    }

    /**
     * Utility: Delay function
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get mock status (for monitoring)
     */
    getStatus() {
        return {
            connected: this._connected,
            batteryLevel: this._batteryLevel,
            position: { ...this._position },
            isMoving: this._isMoving,
        };
    }
}

export default MockSerialManager;
