/**
 * Example script to test the Mock Robot API
 *
 * To run this example:
 * 1. Make sure USE_MOCK_ROBOT=true in your .env file
 * 2. Run: npx ts-node src/examples/test_mock_robot.ts
 */

// Load environment variables FIRST
import * as dotenv from "dotenv";
import * as path from "path";

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { RobotAPIFactory } from "../api/factories/RobotAPIFactory";

async function testMockRobot() {
    console.log("\n" + "=".repeat(60));
    console.log("Testing Mock Robot API");
    console.log("=".repeat(60) + "\n");

    // Get robot instance (will be mock if USE_MOCK_ROBOT=true)
    const robot = RobotAPIFactory.getInstance();

    console.log(`Mode: ${RobotAPIFactory.getMode()}\n`);

    // Set up event listeners
    robot.on("initialized", (position) => {
        console.log(`✅ Robot initialized at position:`, position);
    });

    robot.on("movement_started", (data) => {
        console.log(`🚀 Movement started:`, data);
    });

    robot.on("movement_completed", (data) => {
        console.log(`✅ Movement completed:`, data);
    });

    robot.on("movement_failed", (data) => {
        console.log(`❌ Movement failed:`, data);
    });

    try {
        // Initialize robot
        console.log("\n1. Initializing robot...");
        const initialized = await robot.initialize();
        if (!initialized) {
            throw new Error("Failed to initialize");
        }

        // Test Cartesian movement
        console.log("\n2. Testing Cartesian movement to (2.0, 1.5)...");
        const result1 = await robot.moveTo(2.0, 1.5, 50);
        console.log(`   Result: ${result1.success ? "SUCCESS" : "FAILED"}`);
        console.log(`   Duration: ${(result1.duration / 1000).toFixed(2)}s`);

        // Test Polar movement
        console.log("\n3. Testing Polar movement to 45° at 3.0m...");
        const result2 = await robot.movePolar(45, 3.0, 50);
        console.log(`   Result: ${result2.success ? "SUCCESS" : "FAILED"}`);
        console.log(`   Duration: ${(result2.duration / 1000).toFixed(2)}s`);

        // Test Radial movement (simulating boundary detection)
        console.log("\n4. Testing Radial movement (boundary detection simulation)...");
        const result3 = await robot.moveRadial(5.0, 3.0, 90, 50);
        console.log(`   Result: ${result3.success ? "SUCCESS" : "FAILED"}`);
        console.log(`   Duration: ${(result3.duration / 1000).toFixed(2)}s`);

        // Test Tangential movement
        console.log("\n5. Testing Tangential movement...");
        const result4 = await robot.moveTangential(120, 2.5, 50);
        console.log(`   Result: ${result4.success ? "SUCCESS" : "FAILED"}`);
        console.log(`   Duration: ${(result4.duration / 1000).toFixed(2)}s`);

        // Get current position
        console.log("\n6. Getting current position...");
        const position = await robot.getCurrentPosition();
        console.log(`   Position: (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.angle.toFixed(1)}°)`);

        // Test Tangential Boundary Test
        console.log("\n7. Testing Tangential Boundary Test (sweep)...");
        const positions = await robot.performTangentialBoundaryTest(2.0, 0, 90, 30, 50);
        console.log(`   Visited ${positions.length} positions`);

        // Return home
        console.log("\n8. Returning home...");
        const homeResult = await robot.homeRobot();
        console.log(`   Result: ${homeResult.success ? "SUCCESS" : "FAILED"}`);
        console.log(`   Duration: ${(homeResult.duration / 1000).toFixed(2)}s`);

        console.log("\n" + "=".repeat(60));
        console.log("✅ All tests completed successfully!");
        console.log("=".repeat(60) + "\n");

    } catch (error) {
        console.error("\n❌ Error during testing:", error);
        process.exit(1);
    }
}

// Run if executed directly
if (require.main === module) {
    testMockRobot()
        .then(() => {
            console.log("Test completed");
            process.exit(0);
        })
        .catch((error) => {
            console.error("Test failed:", error);
            process.exit(1);
        });
}

export default testMockRobot;
