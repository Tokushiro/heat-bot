/**
 * Example script to test the Mock Sensor API
 *
 * To run this example:
 * 1. Make sure USE_MOCK_SENSOR=true in your .env file
 * 2. Run: npm run test:mock-sensor
 */

// Load environment variables FIRST
import * as dotenv from "dotenv";
import * as path from "path";

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { SensorAPIFactory } from "../api/factories/SensorAPIFactory";
import { MockSensorAPI } from "../api/implementations/mock/MockSensorAPI";

async function testMockSensor() {
    console.log("\n" + "=".repeat(60));
    console.log("Testing Mock Sensor API");
    console.log("=".repeat(60) + "\n");

    // Get sensor instance (will be mock if USE_MOCK_SENSOR=true)
    const sensor = SensorAPIFactory.getInstance();

    console.log(`Mode: ${SensorAPIFactory.getMode()}\n`);

    // Set up event listeners
    sensor.on("initialized", (data) => {
        console.log(`✅ Sensor initialized:`, data);
    });

    sensor.on("detection_started", (data) => {
        console.log(`🔍 Detection monitoring started:`, data);
    });

    sensor.on("detection", (result) => {
        console.log(`📡 Detection event:`, {
            detected: result.detected,
            timestamp: result.timestamp,
            confidence: result.confidence
        });
    });

    try {
        // 1. Initialize sensor with default detection zone (0-12m, 360°)
        console.log("1. Initializing sensor with default detection zone...");
        const initialized = await sensor.initialize({
            sensorId: "test-sensor-001",
            mac: "10:B9:F7:11:62:CF",
            mountingHeight: 1.7,
            ambientTemp: 20,
            humidity: 70,
            detectionZones: [
                {
                    minDistance: 0,
                    maxDistance: 12,
                    minAngle: 0,
                    maxAngle: 360,
                    detectionProbability: 0.95
                }
            ]
        });

        if (!initialized) {
            throw new Error("Failed to initialize sensor");
        }

        // 2. Start detection
        console.log("\n2. Starting detection monitoring...");
        await sensor.startDetection();

        // 3. Test detection at various positions
        console.log("\n3. Testing detection at various positions...\n");

        if (sensor instanceof MockSensorAPI) {
            // Test positions within detection zone
            const testPositions = [
                { x: 0, y: 5, name: "5m away (0°)" },
                { x: 5, y: 0, name: "5m away (90°)" },
                { x: 0, y: 10, name: "10m away (0°)" },
                { x: 8.485, y: 8.485, name: "12m away (45°)" },
                { x: 0, y: 15, name: "15m away (outside zone)" },
                { x: 0, y: 2, name: "2m away (close)" }
            ];

            for (const pos of testPositions) {
                console.log(`   Testing position: ${pos.name} at (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)})`);
                const result = sensor.checkDetection(pos.x, pos.y);
                console.log(`   → ${result.detected ? '✅ DETECTED' : '❌ NOT DETECTED'} (confidence: ${result.confidence?.toFixed(2)})`);
            }

            // 4. Test multiple detection zones
            console.log("\n4. Testing custom detection zones...");

            await sensor.updateConfig({
                detectionZones: [
                    {
                        minDistance: 2,
                        maxDistance: 8,
                        minAngle: 0,
                        maxAngle: 90,      // Only detect in front-right quadrant
                        detectionProbability: 1.0
                    }
                ]
            });

            console.log("   Zone: 2-8m, 0-90° only\n");

            const zoneTestPositions = [
                { x: 5, y: 5, name: "In zone (45°)" },
                { x: -5, y: 5, name: "Out of zone (135°)" },
                { x: 1, y: 1, name: "Too close (1.4m)" },
                { x: 10, y: 0, name: "Too far (10m)" }
            ];

            for (const pos of zoneTestPositions) {
                console.log(`   Testing: ${pos.name} at (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)})`);
                const result = sensor.checkDetection(pos.x, pos.y);
                console.log(`   → ${result.detected ? '✅ DETECTED' : '❌ NOT DETECTED'}`);
            }

            // 5. Test ambient conditions
            console.log("\n5. Testing ambient conditions...");
            const conditions = await sensor.getAmbientConditions();
            console.log(`   Temperature: ${conditions.temperature}°C`);
            console.log(`   Humidity: ${conditions.humidity}%`);

            console.log("\n   Updating ambient conditions to 25°C, 65% RH...");
            sensor.setAmbientConditions(25, 65);
            const newConditions = await sensor.getAmbientConditions();
            console.log(`   New Temperature: ${newConditions.temperature}°C`);
            console.log(`   New Humidity: ${newConditions.humidity}%`);

            // 6. Test sensor status
            console.log("\n6. Getting sensor status...");
            const status = await sensor.getStatus();
            console.log(`   Connected: ${status.connected}`);
            console.log(`   Detecting: ${status.detecting}`);
            console.log(`   Sensor ID: ${status.sensorId}`);
            console.log(`   MAC: ${status.mac}`);
            console.log(`   Last Detection: ${status.lastDetection || 'None'}`);
        }

        // 7. Stop detection
        console.log("\n7. Stopping detection...");
        await sensor.stopDetection();

        // 8. Disconnect
        console.log("\n8. Disconnecting sensor...");
        await sensor.disconnect();

        console.log("\n" + "=".repeat(60));
        console.log("✅ All sensor tests completed successfully!");
        console.log("=".repeat(60) + "\n");

    } catch (error) {
        console.error("\n❌ Error during testing:", error);
        process.exit(1);
    }
}

// Run if executed directly
if (require.main === module) {
    testMockSensor()
        .then(() => {
            console.log("Test completed");
            process.exit(0);
        })
        .catch((error) => {
            console.error("Test failed:", error);
            process.exit(1);
        });
}

export default testMockSensor;
