import { EventEmitter } from "events";
import { IRobotAPI, Position, MovementResult } from "../../interfaces/IRobotAPI";
import { TimeUtility } from "../../../utils/TimeUtility";

/**
 * Mock implementation of Robot API for testing without real hardware
 * Simulates H.E.A.T. Bot movement including:
 * - Rotating Arm (76mm × 76mm × 380mm, mounted at 750mm height)
 * - Movement speeds (0.5 m/s standard test speed)
 * - Realistic timing delays
 */
export class MockRobotAPI extends EventEmitter implements IRobotAPI {
    private static _instance: MockRobotAPI;
    private currentPosition: Position = { x: 0, y: 0, angle: 0 };
    private isMoving: boolean = false;
    private moveQueue: Array<() => Promise<void>> = [];
    private processing: boolean = false;
    private initialized: boolean = false;

    // Simulation parameters
    private readonly DEFAULT_SPEED = 50; // Robot API speed units (cm/s: 50 => 0.5 m/s)
    private readonly MOVEMENT_DELAY_PER_METER = 2000; // 2 seconds per meter (0.5 m/s)
    private readonly HOME_TIME = 5000; // 5 seconds to home
    private readonly INIT_TIME = 2000; // 2 seconds to initialize

    static get instance() {
        if (!this._instance) this._instance = new MockRobotAPI();
        return this._instance;
    }

    private constructor() {
        super();
        console.log("[MockRobotAPI] Mock Robot API initialized - No real hardware will be used");
    }

    /**
     * Initialize mock robot - simulates connection and homing
     */
    async initialize(): Promise<boolean> {
        try {
            console.log("[MockRobotAPI] Initializing mock robot...");

            // Simulate connection delay
            await this.delay(this.INIT_TIME);

            // Mock home
            await this.homeRobot();

            this.initialized = true;
            this.emit("initialized", this.currentPosition);

            console.log("[MockRobotAPI] Mock robot initialized successfully");
            return true;
        } catch (error) {
            console.error("[MockRobotAPI] Initialization failed:", error);
            this.emit("error", { type: "initialization", error });
            return false;
        }
    }

    /**
     * Home the mock robot to origin (0, 0, 0)
     */
    async homeRobot(): Promise<MovementResult> {
        const startTime = Date.now();

        try {
            this.isMoving = true;
            this.emit("movement_started", { type: "home" });

            console.log("[MockRobotAPI] Homing robot...");

            // Simulate homing time
            await this.delay(this.HOME_TIME);

            this.currentPosition = { x: 0, y: 0, angle: 0 };
            const duration = Date.now() - startTime;

            this.emit("movement_completed", {
                type: "home",
                position: this.currentPosition,
                duration
            });

            console.log("[MockRobotAPI] Robot homed to (0, 0, 0°)");

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
     * Move to absolute Cartesian position (alias for moveTo)
     */
    async moveCartesian(x: number, y: number, speed: number = 50): Promise<MovementResult> {
        return this.moveTo(x, y, speed);
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

                // Calculate distance and simulate movement time
                const distance = this.calculateDistance(this.currentPosition.x, this.currentPosition.y, x, y);
                const movementTime = this.calculateMovementTime(distance, speed);

                console.log(`[MockRobotAPI] Moving from (${this.currentPosition.x.toFixed(2)}, ${this.currentPosition.y.toFixed(2)}) to (${x.toFixed(2)}, ${y.toFixed(2)}) - Distance: ${distance.toFixed(2)}m, Time: ${(movementTime/1000).toFixed(1)}s`);

                // Simulate movement
                await this.delay(movementTime);

                this.currentPosition.x = x;
                this.currentPosition.y = y;
                const duration = Date.now() - startTime;

                this.emit("movement_completed", {
                    type: "move_to",
                    position: this.currentPosition,
                    duration
                });

                console.log(`[MockRobotAPI] Arrived at (${x.toFixed(2)}, ${y.toFixed(2)})`);

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

        console.log(`[MockRobotAPI] Moving to polar coordinates: ${angle.toFixed(1)}° at ${distance.toFixed(2)}m`);

        const result = await this.moveTo(x, y, speed);
        if (result.success) {
            this.currentPosition.angle = angle;
        }
        return result;
    }

    /**
     * Move tangentially (circular arc around sensor)
     * Simulates walking parallel to detector
     */
    async moveTangential(angle: number, radius: number, speed: number = 50): Promise<MovementResult> {
        console.log(`[MockRobotAPI] Tangential movement at radius ${radius.toFixed(2)}m, angle ${angle.toFixed(1)}°`);
        return this.movePolar(angle, radius, speed);
    }

    /**
     * Move radially (toward or away from sensor)
     * Simulates walking head-on toward detector
     */
    async moveRadial(
        startDistance: number,
        endDistance: number,
        angle: number,
        speed: number = 50
    ): Promise<MovementResult> {
        console.log(`[MockRobotAPI] Radial movement from ${startDistance.toFixed(2)}m to ${endDistance.toFixed(2)}m at ${angle.toFixed(1)}°`);

        // Move to start position first
        const startResult = await this.movePolar(angle, startDistance, speed);
        if (!startResult.success) {
            return startResult;
        }

        // Small delay (pause for 1 second as per spec)
        await this.delay(1000);

        // Move to end position
        return this.movePolar(angle, endDistance, speed);
    }

    /**
     * Perform tangential boundary test
     */
    async performTangentialBoundaryTest(
        radius: number,
        startAngle: number,
        endAngle: number,
        angleStep: number = 15,
        speed: number = 50
    ): Promise<Position[]> {
        console.log(`[MockRobotAPI] Tangential boundary test: ${startAngle}° to ${endAngle}° at ${radius.toFixed(2)}m`);
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
     */
    async performRadialBoundaryTest(
        angle: number,
        distances: number[],
        speed: number = 50
    ): Promise<Position[]> {
        console.log(`[MockRobotAPI] Radial boundary test at ${angle.toFixed(1)}° for ${distances.length} distances`);
        const positions: Position[] = [];

        for (const distance of distances) {
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
            console.log("[MockRobotAPI] Stopping movement");
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
    async getCurrentPosition(): Promise<Position> {
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
     * Calculate distance between two points
     */
    private calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Calculate realistic movement time based on distance and speed
     * Standard test speed is 0.5 m/s
     */
    private calculateMovementTime(distance: number, speed: number): number {
        // Robot API speed argument is in cm/s (same as the real bot controller)
        const metersPerSecond = Math.max(speed / 100, 0.01);

        // Base time from provided speed plus a floor that matches the spec 0.5 m/s target
        const speedBasedTime = (distance / metersPerSecond) * 1000;
        const specBasedTime = distance * this.MOVEMENT_DELAY_PER_METER;

        // Small variance so timings don't look identical
        const variance = Math.random() * 400 - 200;
        const baseTime = Math.max(speedBasedTime, specBasedTime);

        return Math.max(250, baseTime + variance); // Never faster than 250ms
    }



    /**
     * Utility delay function with simulation speed adjustment
     */
    private delay(ms: number): Promise<void> {
        return TimeUtility.delay(ms);
    }

    /**
     * Static utility methods (matching real RobotAPI)
     */
    static calculateDistance(p1: Position, p2: Position): number {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    static cartesianToPolar(x: number, y: number): { angle: number; distance: number } {
        const distance = Math.sqrt(x * x + y * y);
        let angle = (Math.atan2(y, x) * 180) / Math.PI;
        if (angle < 0) angle += 360;
        return { angle, distance };
    }

    static polarToCartesian(angle: number, distance: number): { x: number; y: number } {
        const radians = (angle * Math.PI) / 180;
        return {
            x: distance * Math.cos(radians),
            y: distance * Math.sin(radians)
        };
    }
}

export default MockRobotAPI;
