import { SerialManager } from "./SerialManager";
import { EventEmitter } from "events";

/**
 * Robot API Service
 * Handles all robot movement commands and position tracking
 */

export interface Position {
    x: number;
    y: number;
    angle: number;
}

export interface MovementResult {
    success: boolean;
    position: Position;
    duration: number;
    error?: string;
}

export class RobotAPI extends EventEmitter {
    private static _instance: RobotAPI;
    private currentPosition: Position = { x: 0, y: 0, angle: 0 };
    private isMoving: boolean = false;
    private moveQueue: Array<() => Promise<void>> = [];
    private processing: boolean = false;

    static get instance() {
        if (!this._instance) this._instance = new RobotAPI();
        return this._instance;
    }

    private constructor() {
        super();
    }

    /**
     * Initialize robot - establish connection and home position
     */
    async initialize(): Promise<boolean> {
        try {
            if (!SerialManager.instance.connected) {
                throw new Error("Serial connection not established");
            }

            // Send connection command
            await SerialManager.instance.send("conn");
            await this.waitForResponse("conn", 2000);

            // Home the robot
            await this.homeRobot();

            this.emit("initialized", this.currentPosition);
            return true;
        } catch (error) {
            console.error("[RobotAPI] Initialization failed:", error);
            this.emit("error", { type: "initialization", error });
            return false;
        }
    }

    /**
     * Home the robot to origin (0, 0, 0)
     */
    async homeRobot(): Promise<MovementResult> {
        const startTime = Date.now();
        
        try {
            this.isMoving = true;
            this.emit("movement_started", { type: "home" });

            await SerialManager.instance.send("home");
            await this.waitForResponse("home_complete", 10000);

            this.currentPosition = { x: 0, y: 0, angle: 0 };
            const duration = Date.now() - startTime;

            this.emit("movement_completed", { 
                type: "home", 
                position: this.currentPosition,
                duration 
            });

            return {
                success: true,
                position: this.currentPosition,
                duration
            };
        } catch (error) {
            const duration = Date.now() - startTime;
            this.emit("movement_failed", { type: "home", error });
            return {
                success: false,
                position: this.currentPosition,
                duration,
                error: String(error)
            };
        } finally {
            this.isMoving = false;
        }
    }

    /**
     * Move to absolute Cartesian position
     */
    async moveTo(x: number, y: number, speed: number = 50): Promise<MovementResult> {
        return this.queueMovement(async () => {
            const startTime = Date.now();
            
            try {
                this.isMoving = true;
                this.emit("movement_started", { type: "move_to", target: { x, y }, speed });

                const command = `moveto ${x.toFixed(2)} ${y.toFixed(2)} ${speed}`;
                await SerialManager.instance.send(command);
                await this.waitForResponse("move_complete", 30000);

                this.currentPosition.x = x;
                this.currentPosition.y = y;
                const duration = Date.now() - startTime;

                this.emit("movement_completed", {
                    type: "move_to",
                    position: this.currentPosition,
                    duration
                });

                return {
                    success: true,
                    position: this.currentPosition,
                    duration
                };
            } catch (error) {
                const duration = Date.now() - startTime;
                this.emit("movement_failed", { type: "move_to", error });
                return {
                    success: false,
                    position: this.currentPosition,
                    duration,
                    error: String(error)
                };
            } finally {
                this.isMoving = false;
            }
        });
    }

    /**
     * Move in polar coordinates (angle and distance from origin)
     */
    async movePolar(angle: number, distance: number, speed: number = 50): Promise<MovementResult> {
        // Convert polar to Cartesian
        const radians = (angle * Math.PI) / 180;
        const x = distance * Math.cos(radians);
        const y = distance * Math.sin(radians);

        const result = await this.moveTo(x, y, speed);
        if (result.success) {
            this.currentPosition.angle = angle;
        }
        return result;
    }

    /**
     * Move tangentially (circular arc around sensor)
     * @param angle - Target angle in degrees (0-360)
     * @param radius - Distance from sensor/origin
     * @param speed - Movement speed
     */
    async moveTangential(angle: number, radius: number, speed: number = 50): Promise<MovementResult> {
        return this.movePolar(angle, radius, speed);
    }

    /**
     * Move radially (toward or away from sensor)
     * @param startDistance - Starting distance from origin
     * @param endDistance - Ending distance
     * @param angle - Angle to maintain
     * @param speed - Movement speed
     */
    async moveRadial(
        startDistance: number,
        endDistance: number,
        angle: number,
        speed: number = 50
    ): Promise<MovementResult> {
        // Move to start position first
        const startResult = await this.movePolar(angle, startDistance, speed);
        if (!startResult.success) {
            return startResult;
        }

        // Small delay
        await this.delay(500);

        // Move to end position
        return this.movePolar(angle, endDistance, speed);
    }

    /**
     * Perform tangential boundary test
     * Moves in an arc at specified radius and angle range
     */
    async performTangentialBoundaryTest(
        radius: number,
        startAngle: number,
        endAngle: number,
        angleStep: number = 15,
        speed: number = 50
    ): Promise<Position[]> {
        const positions: Position[] = [];

        for (let angle = startAngle; angle <= endAngle; angle += angleStep) {
            const result = await this.moveTangential(angle, radius, speed);
            if (result.success) {
                positions.push({ ...result.position });
                await this.delay(1000); // Wait for potential detection
            }
        }

        return positions;
    }

    /**
     * Perform radial boundary test
     * Moves toward and away from sensor at various distances
     */
    async performRadialBoundaryTest(
        angle: number,
        distances: number[],
        speed: number = 50
    ): Promise<Position[]> {
        const positions: Position[] = [];

        for (const distance of distances) {
            // Move to each distance point
            const result = await this.movePolar(angle, distance, speed);
            if (result.success) {
                positions.push({ ...result.position });
                await this.delay(1000); // Wait for potential detection
            }
        }

        return positions;
    }

    /**
     * Stop all movement immediately
     */
    async stopMovement(): Promise<void> {
        try {
            await SerialManager.instance.send("stop");
            this.isMoving = false;
            this.emit("movement_stopped", { position: this.currentPosition });
        } catch (error) {
            this.emit("error", { type: "stop_failed", error });
            throw error;
        }
    }

    /**
     * Get current robot position
     */
    getCurrentPosition(): Position {
        return { ...this.currentPosition };
    }

    /**
     * Check if robot is currently moving
     */
    isRobotMoving(): boolean {
        return this.isMoving;
    }

    /**
     * Queue a movement to ensure sequential execution
     */
    private async queueMovement<T>(movementFn: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.moveQueue.push(async () => {
                try {
                    const result = await movementFn();
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });

            if (!this.processing) {
                this.processQueue();
            }
        });
    }

    /**
     * Process movement queue
     */
    private async processQueue(): Promise<void> {
        if (this.processing || this.moveQueue.length === 0) {
            return;
        }

        this.processing = true;

        while (this.moveQueue.length > 0) {
            const movement = this.moveQueue.shift();
            if (movement) {
                await movement();
            }
        }

        this.processing = false;
    }

    /**
     * Wait for specific response from robot
     */
    private waitForResponse(expected: string, timeout: number): Promise<void> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                SerialManager.instance.off("data", handler);
                reject(new Error(`Timeout waiting for response: ${expected}`));
            }, timeout);

            const handler = (line: string) => {
                if (line.includes(expected)) {
                    clearTimeout(timer);
                    SerialManager.instance.off("data", handler);
                    resolve();
                }
            };

            SerialManager.instance.on("data", handler);
        });
    }

    /**
     * Utility delay function
     */
    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Calculate distance between two points
     */
    static calculateDistance(p1: Position, p2: Position): number {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Convert Cartesian to Polar coordinates
     */
    static cartesianToPolar(x: number, y: number): { angle: number; distance: number } {
        const distance = Math.sqrt(x * x + y * y);
        let angle = (Math.atan2(y, x) * 180) / Math.PI;
        if (angle < 0) angle += 360;
        return { angle, distance };
    }

    /**
     * Convert Polar to Cartesian coordinates
     */
    static polarToCartesian(angle: number, distance: number): { x: number; y: number } {
        const radians = (angle * Math.PI) / 180;
        return {
            x: distance * Math.cos(radians),
            y: distance * Math.sin(radians)
        };
    }
}

export default RobotAPI;
