import { RobotAPIFactory } from "../../factories/RobotAPIFactory";
import { SensorAPIFactory } from "../../factories/SensorAPIFactory";
import { MockSensorAPI } from "./MockSensorAPI";

export class RobotSensorIntegration {
    private static _instance: RobotSensorIntegration;
    private enabled: boolean = false;

    static get instance() {
        if (!this._instance) this._instance = new RobotSensorIntegration();
        return this._instance;
    }

    private constructor() {}

    /**
     * Initialize integration between robot and sensor
     * Only active in mock mode
     */
    initialize(): void {
        const robotMock = RobotAPIFactory.isMockMode();
        const sensorMock = SensorAPIFactory.isMockMode();

        // Only enable integration if sensor is in mock mode
        if (sensorMock) {
            console.log("[Integration] Enabling Robot-Sensor integration for mock sensor");
            this.setupRobotListener();
            this.enabled = true;
        } else {
            console.log("[Integration] Real sensor mode - no integration needed");
            this.enabled = false;
        }
    }

    /**
     * Setup listener for robot movement events
     */
    private setupRobotListener(): void {
        const robot = RobotAPIFactory.getInstance();
        const sensor = SensorAPIFactory.getInstance();

        // Listen to robot movement completion
        robot.on("movement_completed", async (data: any) => {
            if (!this.enabled) return;

            try {
                // Get robot position
                const position = data.position;
                if (!position) return;

                // Check if sensor would detect at this position
                // Only for MockSensorAPI
                if (sensor instanceof MockSensorAPI) {
                    sensor.checkDetection(position.x, position.y);
                }
            } catch (error) {
                console.error("[Integration] Error checking detection:", error);
            }
        });

        console.log("[Integration] Listening to robot movements for detection simulation");
    }

    /**
     * Enable/disable integration
     */
    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        console.log(`[Integration] ${enabled ? 'Enabled' : 'Disabled'}`);
    }

    /**
     * Check if integration is enabled
     */
    isEnabled(): boolean {
        return this.enabled;
    }
}

export default RobotSensorIntegration;
