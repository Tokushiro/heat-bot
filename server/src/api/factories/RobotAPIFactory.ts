import { IRobotAPI } from "../interfaces/IRobotAPI";
import { RobotAPI } from "../implementations/real/RealRobotAPI";
import { MockRobotAPI } from "../implementations/mock/MockRobotAPI";

/**
 * Factory for creating Robot API instances
 * Returns either real or mock implementation based on USE_MOCK_ROBOT environment variable
 */
export class RobotAPIFactory {
    private static _instance: IRobotAPI | null = null;

    /**
     * Get singleton instance of Robot API (either real or mock)
     * Controlled by USE_MOCK_ROBOT environment variable
     * - "true" = Use mock implementation (no real hardware)
     * - "false" or undefined = Use real implementation
     */
    static getInstance(): IRobotAPI {
        if (!this._instance) {
            const useMock = process.env.USE_MOCK_ROBOT === "true";

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
        }

        return this._instance;
    }

    /**
     * Reset the singleton instance (useful for testing)
     */
    static reset(): void {
        this._instance = null;
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
