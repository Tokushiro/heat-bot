import { Request, Response, NextFunction } from "express";
import TestOrchestrator from "../services/test_orchestrator_service";
import pool from "../db_conn";

/**
 * Start test execution
 */
export async function startTestExecution(req: Request, res: Response, next: NextFunction) {
    try {
        const { testId } = req.body;

        if (!testId) {
            return res.status(400).json({ error: "testId is required" });
        }

        // Start test asynchronously
        TestOrchestrator.instance.startTest(testId).catch((error) => {
            console.error("[TestExecution] Error:", error);
        });

        return res.status(200).json({
            ok: true,
            message: "Test execution started",
            testId
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Stop/abort test execution
 */
export async function stopTestExecution(req: Request, res: Response, next: NextFunction) {
    try {
        await TestOrchestrator.instance.abortTest();

        return res.status(200).json({
            ok: true,
            message: "Test execution stopped"
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Get test progress
 */
export async function getTestProgress(req: Request, res: Response, next: NextFunction) {
    try {
        const testId = parseInt(req.params.testId);

        if (isNaN(testId)) {
            return res.status(400).json({ error: "Invalid testId" });
        }

        const progress = await TestOrchestrator.instance.getTestProgress(testId);

        return res.status(200).json(progress);
    } catch (error) {
        next(error);
    }
}

/**
 * Get test measurements
 */
export async function getTestMeasurements(req: Request, res: Response, next: NextFunction) {
    try {
        const testId = parseInt(req.params.testId);

        if (isNaN(testId)) {
            return res.status(400).json({ error: "Invalid testId" });
        }

        const query = `
            SELECT 
                measurement_id,
                test_type,
                angle,
                distance_m,
                x_coord,
                y_coord,
                result,
                detected,
                attempt_number,
                measured_at,
                detection_delay_ms,
                notes
            FROM test_measurement
            WHERE test_id = $1
            ORDER BY measured_at ASC
        `;

        const result = await pool.query(query, [testId]);

        return res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
}

/**
 * Get test event log
 */
export async function getTestEventLog(req: Request, res: Response, next: NextFunction) {
    try {
        const testId = parseInt(req.params.testId);

        if (isNaN(testId)) {
            return res.status(400).json({ error: "Invalid testId" });
        }

        const query = `
            SELECT 
                event_id,
                event_type,
                event_data,
                created_at
            FROM test_event_log
            WHERE test_id = $1
            ORDER BY created_at ASC
        `;

        const result = await pool.query(query, [testId]);

        return res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
}

/**
 * Get test details with all related data
 */
export async function getTestDetails(req: Request, res: Response, next: NextFunction) {
    try {
        const testId = parseInt(req.params.testId);

        if (isNaN(testId)) {
            return res.status(400).json({ error: "Invalid testId" });
        }

        // Get test info
        const testQuery = `
            SELECT 
                t.*,
                tc.test_name as test_choice_name,
                tc.test_standard,
                tc.test_method,
                tc.test_lab,
                s.name as sensor_name,
                s.manufacturer,
                s.product_reference,
                s.mounting_height
            FROM test t
            LEFT JOIN test_choice tc ON t.test_choice = tc.test_choice_id
            LEFT JOIN sensor s ON t.sensor_id = s.sensor_id
            WHERE t.test_id = $1
        `;

        const testResult = await pool.query(testQuery, [testId]);

        if (testResult.rows.length === 0) {
            return res.status(404).json({ error: "Test not found" });
        }

        // Get measurements
        const measurementsQuery = `
            SELECT * FROM test_measurement
            WHERE test_id = $1
            ORDER BY measured_at ASC
        `;
        const measurementsResult = await pool.query(measurementsQuery, [testId]);

        // Get radial boundaries
        const radialQuery = `
            SELECT * FROM radial_boundary
            WHERE test_id = $1
            ORDER BY measured_at ASC
        `;
        const radialResult = await pool.query(radialQuery, [testId]);

        // Get tangential boundaries
        const tangentialQuery = `
            SELECT * FROM tangential_boundary
            WHERE test_id = $1
            ORDER BY angle ASC
        `;
        const tangentialResult = await pool.query(tangentialQuery, [testId]);

        return res.status(200).json({
            test: testResult.rows[0],
            measurements: measurementsResult.rows,
            radialBoundaries: radialResult.rows,
            tangentialBoundaries: tangentialResult.rows
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Update test configuration
 */
export async function updateTestConfiguration(req: Request, res: Response, next: NextFunction) {
    try {
        const testId = parseInt(req.params.testId);
        const config = req.body;

        if (isNaN(testId)) {
            return res.status(400).json({ error: "Invalid testId" });
        }

        const query = `
            INSERT INTO test_configuration (
                test_id, mounting_height_m, room_temperature_c,
                radial_distances_m, radial_retry_limit,
                tangential_angles, tangential_distances_m, tangential_retry_limit,
                detection_timeout_ms, movement_speed_m_s
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (test_id) DO UPDATE SET
                mounting_height_m = EXCLUDED.mounting_height_m,
                room_temperature_c = EXCLUDED.room_temperature_c,
                radial_distances_m = EXCLUDED.radial_distances_m,
                radial_retry_limit = EXCLUDED.radial_retry_limit,
                tangential_angles = EXCLUDED.tangential_angles,
                tangential_distances_m = EXCLUDED.tangential_distances_m,
                tangential_retry_limit = EXCLUDED.tangential_retry_limit,
                detection_timeout_ms = EXCLUDED.detection_timeout_ms,
                movement_speed_m_s = EXCLUDED.movement_speed_m_s
        `;

        await pool.query(query, [
            testId,
            config.mountingHeight || 2.5,
            config.roomTemperature || null,
            config.radialDistances || [2.0, 3.0],
            config.radialRetryLimit || 3,
            config.tangentialAngles || [0, 45, 90, 135, 180, 225, 270, 315],
            config.tangentialDistances || [2.5, 3.0],
            config.tangentialRetryLimit || 3,
            config.detectionTimeout || 5000,
            config.movementSpeed || 0.5
        ]);

        return res.status(200).json({
            ok: true,
            message: "Test configuration updated"
        });
    } catch (error) {
        next(error);
    }
}
