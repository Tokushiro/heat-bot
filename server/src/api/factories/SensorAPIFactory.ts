import { ISensorAPI } from "../interfaces/ISensorAPI";
import { RealSensorAPI } from "../implementations/real/RealSensorAPI";
import { MockSensorAPI } from "../implementations/mock/MockSensorAPI";

/**
 * Factory for creating Sensor API instances
 * Returns either real or mock implementation based on USE_MOCK_SENSOR environment variable
 */
export class SensorAPIFactory {
    private static _instance: ISensorAPI | null = null;

    /**
     * Get singleton instance of Sensor API (either real or mock)
     * Controlled by USE_MOCK_SENSOR environment variable
     * - "true" = Use mock implementation (simulated detection zones)
     * - "false" or undefined = Use real implementation (BLE hardware)
     */
    static getInstance(): ISensorAPI {
        if (!this._instance) {
            const useMock = process.env.USE_MOCK_SENSOR === "true";

            if (useMock) {
                console.log("=".repeat(60));
                console.log("📡 MOCK SENSOR MODE ENABLED");
                console.log("Using MockSensorAPI - Simulated detection zones");
                console.log("Set USE_MOCK_SENSOR=false in .env to use real sensor");
                console.log("=".repeat(60));
                this._instance = MockSensorAPI.instance;
            } else {
                console.log("=".repeat(60));
                console.log("📡 REAL SENSOR MODE");
                console.log("Using RealSensorAPI - BLE hardware detection");
                console.log("Set USE_MOCK_SENSOR=true in .env to use mock sensor");
                console.log("=".repeat(60));
                this._instance = RealSensorAPI.instance;
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
        return process.env.USE_MOCK_SENSOR === "true";
    }

    /**
     * Get the mode name as a string
     */
    static getMode(): string {
        return this.isMockMode() ? "MOCK" : "REAL";
    }
}

export default SensorAPIFactory;
