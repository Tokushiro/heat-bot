import { IRobotAPI } from "../interfaces/IRobotAPI";
import { RobotAPI } from "../implementations/real/RealRobotAPI";
import { MockRobotAPI } from "../implementations/mock/MockRobotAPI";
import { emitRobotEvent } from "../../services/telemetry/RobotEventBus";

/**
 * Factory for creating Robot API instances
 * Returns either real or mock implementation based on USE_MOCK_ROBOT environment variable
 */
export class RobotAPIFactory {
    private static _instance: IRobotAPI | null = null;
    private static listenersAttached = false;

    /**
     * Get singleton instance of Robot API (either real or mock)
     * Controlled by USE_MOCK_ROBOT environment variable
     * - "true" = Use mock implementation (no real hardware)
     * - "false" or undefined = Use real implementation
     */
    static getInstance(): IRobotAPI {
        if (!this._instance) {
            // Default to mock unless explicitly disabled
            const useMock = process.env.USE_MOCK_ROBOT !== "false";

            if (useMock) {
                console.log("=".repeat(60));
                console.log("🤖 MOCK MODE ENABLED");
                console.log("Using MockRobotAPI - No real hardware will be accessed");
                console.log("Set USE_MOCK_ROBOT=false in .env to use real robot");
                console.log("=".repeat(60));
                this._instance = MockRobotAPI.instance;
            } else {
                console.log("=".repeat(60));
                console.log("🤖 REAL ROBOT MODE");
                console.log("Using RobotAPI - Real hardware will be accessed");
                console.log("Set USE_MOCK_ROBOT=true in .env to use mock robot");
                console.log("=".repeat(60));
                this._instance = RobotAPI.instance;
            }

            this.attachRobotEventForwarders(this._instance);
        }

        return this._instance;
    }

    /**
     * Forward low-level robot events to the robot event bus once.
     */
    private static attachRobotEventForwarders(api: IRobotAPI) {
        if (this.listenersAttached) return;

        api.on("movement_started", (payload) => emitRobotEvent("movement_started", payload));
        api.on("movement_completed", (payload) => emitRobotEvent("movement_completed", payload));
        api.on("movement_failed", (payload) => emitRobotEvent("movement_failed", payload));
        api.on("movement_stopped", (payload) => emitRobotEvent("movement_stopped", payload));
        api.on("initialized", (payload) => emitRobotEvent("robot_initialized", payload));
        api.on("error", (payload) => emitRobotEvent("robot_error", payload));

        this.listenersAttached = true;
    }

    /**
     * Reset the singleton instance (useful for testing)
     */
    static reset(): void {
        this._instance = null;
        this.listenersAttached = false;
    }

    /**
     * Check if currently using mock mode
     */
    static isMockMode(): boolean {
        return process.env.USE_MOCK_ROBOT === "true";
    }

    /**
     * Get the mode name as a string
     */
    static getMode(): string {
        return this.isMockMode() ? "MOCK" : "REAL";
    }
}

export default RobotAPIFactory;
