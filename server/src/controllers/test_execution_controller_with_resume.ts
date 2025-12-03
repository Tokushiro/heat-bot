import { Request, Response } from "express";
import TestOrchestrator from "../services/test_orchestrator_with_resume";
import pool from "../db_conn";

/**
 * Enhanced Test Execution Controller with Resume Support
 */

/**
 * Start a new test execution
 */
export const startTestExecution = async (req: Request, res: Response) => {
    try {
        const { testId } = req.body;

        if (!testId) {
            return res.status(400).json({ error: "testId is required" });
        }

        // Start test in background
        TestOrchestrator.instance.startTest(testId).catch((error) => {
            console.error(`Test ${testId} failed:`, error);
        });

        res.status(200).json({
            message: "Test execution started",
            testId,
        });
    } catch (error: any) {
        console.error("Error starting test:", error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Resume an interrupted test from last checkpoint
 */
export const resumeTestExecution = async (req: Request, res: Response) => {
    try {
        const { testId } = req.body;

        if (!testId) {
            return res.status(400).json({ error: "testId is required" });
        }

        // Check if test can be resumed
        const checkQuery = `
            SELECT can_resume, status, interruption_reason, last_checkpoint
            FROM test
            WHERE test_id = $1
        `;
        const checkResult = await pool.query(checkQuery, [testId]);

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: "Test not found" });
        }

        const test = checkResult.rows[0];

        if (!test.can_resume) {
            return res.status(400).json({
                error: "Test cannot be resumed",
                status: test.status,
            });
        }

        // Resume test in background
        TestOrchestrator.instance.resumeTest(testId).catch((error) => {
            console.error(`Test ${testId} resume failed:`, error);
        });

        res.status(200).json({
            message: "Test execution resumed",
            testId,
            resumedFrom: test.last_checkpoint,
            interruptionReason: test.interruption_reason,
        });
    } catch (error: any) {
        console.error("Error resuming test:", error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Stop/abort current test execution
 */
export const stopTestExecution = async (req: Request, res: Response) => {
    try {
        await TestOrchestrator.instance.abortTest();

        res.status(200).json({
            message: "Test execution stopped",
        });
    } catch (error: any) {
        console.error("Error stopping test:", error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get test progress
 */
export const getTestProgress = async (req: Request, res: Response) => {
    try {
        const testId = parseInt(req.params.testId);

        if (isNaN(testId)) {
            return res.status(400).json({ error: "Invalid testId" });
        }

        const progress = await TestOrchestrator.instance.getTestProgress(testId);

        res.status(200).json(progress);
    } catch (error: any) {
        console.error("Error getting test progress:", error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get all resumable tests
 */
export const getResumableTests = async (req: Request, res: Response) => {
    try {
        const query = `SELECT * FROM resumable_tests ORDER BY interrupted_at DESC`;
        const result = await pool.query(query);

        res.status(200).json({
            tests: result.rows,
            count: result.rows.length,
        });
    } catch (error: any) {
        console.error("Error getting resumable tests:", error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get checkpoint details for a test
 */
export const getTestCheckpoint = async (req: Request, res: Response) => {
    try {
        const testId = parseInt(req.params.testId);

        if (isNaN(testId)) {
            return res.status(400).json({ error: "Invalid testId" });
        }

        const query = `SELECT * FROM get_latest_checkpoint($1)`;
        const result = await pool.query(query, [testId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "No checkpoint found for this test" });
        }

        res.status(200).json(result.rows[0]);
    } catch (error: any) {
        console.error("Error getting checkpoint:", error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get all checkpoints for a test (history)
 */
export const getTestCheckpoints = async (req: Request, res: Response) => {
    try {
        const testId = parseInt(req.params.testId);

        if (isNaN(testId)) {
            return res.status(400).json({ error: "Invalid testId" });
        }

        const query = `
            SELECT * FROM test_checkpoint
            WHERE test_id = $1
            ORDER BY created_at DESC
        `;
        const result = await pool.query(query, [testId]);

        res.status(200).json({
            checkpoints: result.rows,
            count: result.rows.length,
        });
    } catch (error: any) {
        console.error("Error getting checkpoints:", error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get test measurements
 */
export const getTestMeasurements = async (req: Request, res: Response) => {
    try {
        const testId = parseInt(req.params.testId);

        if (isNaN(testId)) {
            return res.status(400).json({ error: "Invalid testId" });
        }

        const query = `
            SELECT * FROM test_measurement
            WHERE test_id = $1
            ORDER BY measured_at ASC
        `;
        const result = await pool.query(query, [testId]);

        res.status(200).json({
            measurements: result.rows,
            count: result.rows.length,
        });
    } catch (error: any) {
        console.error("Error getting measurements:", error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get test event log
 */
export const getTestEventLog = async (req: Request, res: Response) => {
    try {
        const testId = parseInt(req.params.testId);

        if (isNaN(testId)) {
            return res.status(400).json({ error: "Invalid testId" });
        }

        const query = `
            SELECT * FROM test_event_log
            WHERE test_id = $1
            ORDER BY event_time DESC
        `;
        const result = await pool.query(query, [testId]);

        res.status(200).json({
            events: result.rows,
            count: result.rows.length,
        });
    } catch (error: any) {
        console.error("Error getting event log:", error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get complete test details with all related data
 */
export const getTestDetails = async (req: Request, res: Response) => {
    try {
        const testId = parseInt(req.params.testId);

        if (isNaN(testId)) {
            return res.status(400).json({ error: "Invalid testId" });
        }

        // Get test info
        const testQuery = `SELECT * FROM test WHERE test_id = $1`;
        const testResult = await pool.query(testQuery, [testId]);

        if (testResult.rows.length === 0) {
            return res.status(404).json({ error: "Test not found" });
        }

        // Get measurements
        const measurementsQuery = `
            SELECT * FROM test_measurement WHERE test_id = $1 ORDER BY measured_at ASC
        `;
        const measurementsResult = await pool.query(measurementsQuery, [testId]);

        // Get radial boundaries
        const radialQuery = `
            SELECT * FROM radial_boundary WHERE test_id = $1 ORDER BY measured_at ASC
        `;
        const radialResult = await pool.query(radialQuery, [testId]);

        // Get tangential boundaries
        const tangentialQuery = `
            SELECT * FROM tangential_boundary WHERE test_id = $1 ORDER BY measurement_time ASC
        `;
        const tangentialResult = await pool.query(tangentialQuery, [testId]);

        // Get statistics
        const statsQuery = `SELECT * FROM test_summary WHERE test_id = $1`;
        const statsResult = await pool.query(statsQuery, [testId]);

        // Get latest checkpoint if resumable
        let checkpoint = null;
        if (testResult.rows[0].can_resume) {
            const checkpointQuery = `SELECT * FROM get_latest_checkpoint($1)`;
            const checkpointResult = await pool.query(checkpointQuery, [testId]);
            if (checkpointResult.rows.length > 0) {
                checkpoint = checkpointResult.rows[0];
            }
        }

        res.status(200).json({
            test: testResult.rows[0],
            measurements: measurementsResult.rows,
            radialBoundaries: radialResult.rows,
            tangentialBoundaries: tangentialResult.rows,
            statistics: statsResult.rows[0] || null,
            checkpoint: checkpoint,
        });
    } catch (error: any) {
        console.error("Error getting test details:", error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Update test configuration
 */
export const updateTestConfiguration = async (req: Request, res: Response) => {
    try {
        const testId = parseInt(req.params.testId);
        const {
            mountingHeight,
            radialDistances,
            tangentialAngles,
            tangentialDistances,
            detectionTimeout,
            retryLimit,
        } = req.body;

        if (isNaN(testId)) {
            return res.status(400).json({ error: "Invalid testId" });
        }

        const query = `
            INSERT INTO test_configuration (
                test_id, mounting_height_m, radial_distances_m,
                tangential_angles, tangential_distances_m,
                detection_timeout_ms, radial_retry_limit
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (test_id) 
            DO UPDATE SET
                mounting_height_m = EXCLUDED.mounting_height_m,
                radial_distances_m = EXCLUDED.radial_distances_m,
                tangential_angles = EXCLUDED.tangential_angles,
                tangential_distances_m = EXCLUDED.tangential_distances_m,
                detection_timeout_ms = EXCLUDED.detection_timeout_ms,
                radial_retry_limit = EXCLUDED.radial_retry_limit
            RETURNING *
        `;

        const result = await pool.query(query, [
            testId,
            mountingHeight || 2.5,
            radialDistances || [2.0, 3.0],
            tangentialAngles || [0, 45, 90, 135, 180, 225, 270, 315],
            tangentialDistances || [2.5, 3.0],
            detectionTimeout || 5000,
            retryLimit || 3,
        ]);

        res.status(200).json({
            message: "Configuration updated",
            configuration: result.rows[0],
        });
    } catch (error: any) {
        console.error("Error updating configuration:", error);
        res.status(500).json({ error: error.message });
    }
};
