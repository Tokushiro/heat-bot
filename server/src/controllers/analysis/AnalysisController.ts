import { Request, Response } from 'express';
import { StatisticalAnalysisService } from '../../services/analysis/StatisticalAnalysisService';
import pool from '../../db_conn';


export async function getAngularStatistics(req: Request, res: Response) {
    try {
        const testId = parseInt(req.params.testId, 10);

        if (isNaN(testId)) {
            return res.status(400).json({ error: 'Invalid test ID' });
        }

        console.log(`[AnalysisController] Getting angular statistics for test ${testId}`);

        // Fetch boundary measurements
        const query = `
            SELECT angle, distance_to_sensor as distance, detection_occurred as detected,
                   recorded_at as timestamp
            FROM test_step
            WHERE test_id = $1 AND step_type = 'BOUNDARY_DETECTION_RADIAL'
            ORDER BY angle, repeat_number
        `;
        const result = await pool.query(query, [testId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No boundary measurements found for this test' });
        }

        const measurements = result.rows.map((row: any) => ({
            angle: row.angle,
            distance: row.distance,
            detected: row.detected,
            timestamp: new Date(row.timestamp)
        }));

        const statistics = StatisticalAnalysisService.calculateAngularStatistics(measurements);

        return res.status(200).json({
            testId,
            statistics,
            totalAngles: statistics.length,
            avgDetectionRate: statistics.reduce((sum, s) => sum + s.detectionRate, 0) / statistics.length
        });
    } catch (error) {
        console.error('[AnalysisController] Get angular statistics error:', error);
        return res.status(500).json({
            error: 'Failed to calculate angular statistics',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}


export async function getDetectionProbabilityAnalysis(req: Request, res: Response) {
    try {
        const testId = parseInt(req.params.testId, 10);

        if (isNaN(testId)) {
            return res.status(400).json({ error: 'Invalid test ID' });
        }

        console.log(`[AnalysisController] Getting detection probability analysis for test ${testId}`);

        // Fetch all measurements
        const query = `
            SELECT angle, distance_to_sensor as distance, detection_occurred as detected,
                   recorded_at as timestamp
            FROM test_step
            WHERE test_id = $1
            ORDER BY distance_to_sensor
        `;
        const result = await pool.query(query, [testId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No measurements found for this test' });
        }

        const measurements = result.rows.map((row: any) => ({
            angle: row.angle,
            distance: row.distance,
            detected: row.detected,
            timestamp: new Date(row.timestamp)
        }));

        const analysis = StatisticalAnalysisService.analyzeDetectionProbability(measurements);

        return res.status(200).json({
            testId,
            analysis
        });
    } catch (error) {
        console.error('[AnalysisController] Get detection probability error:', error);
        return res.status(500).json({
            error: 'Failed to analyze detection probability',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Compare two tests
 * GET /api/analysis/compare/:testId1/:testId2
 */
export async function compareTests(req: Request, res: Response) {
    try {
        const testId1 = parseInt(req.params.testId1, 10);
        const testId2 = parseInt(req.params.testId2, 10);

        if (isNaN(testId1) || isNaN(testId2)) {
            return res.status(400).json({ error: 'Invalid test IDs' });
        }

        console.log(`[AnalysisController] Comparing tests ${testId1} and ${testId2}`);

        // Fetch test metadata
        const testQuery = `
            SELECT test_id, test_name, test_type, start_time, end_time
            FROM test
            WHERE test_id IN ($1, $2)
        `;
        const testResult = await pool.query(testQuery, [testId1, testId2]);

        if (testResult.rows.length !== 2) {
            return res.status(404).json({ error: 'One or both tests not found' });
        }

        const test1Data = testResult.rows.find((t: any) => t.test_id === testId1);
        const test2Data = testResult.rows.find((t: any) => t.test_id === testId2);

        // Fetch measurements for both tests
        const measurementsQuery = `
            SELECT test_id, angle, distance_to_sensor as distance,
                   detection_occurred as detected, recorded_at as timestamp
            FROM test_step
            WHERE test_id IN ($1, $2) AND step_type = 'BOUNDARY_DETECTION_RADIAL'
            ORDER BY test_id, angle
        `;
        const measurementsResult = await pool.query(measurementsQuery, [testId1, testId2]);

        const measurements1 = measurementsResult.rows
            .filter((row: any) => row.test_id === testId1)
            .map((row: any) => ({
                angle: row.angle,
                distance: row.distance,
                detected: row.detected,
                timestamp: new Date(row.timestamp)
            }));

        const measurements2 = measurementsResult.rows
            .filter((row: any) => row.test_id === testId2)
            .map((row: any) => ({
                angle: row.angle,
                distance: row.distance,
                detected: row.detected,
                timestamp: new Date(row.timestamp)
            }));

        if (measurements1.length === 0 || measurements2.length === 0) {
            return res.status(404).json({ error: 'Insufficient boundary measurements for comparison' });
        }

        const test1 = {
            testId: test1Data.test_id,
            testName: test1Data.test_name,
            testType: test1Data.test_type,
            startTime: new Date(test1Data.start_time),
            endTime: new Date(test1Data.end_time)
        };

        const test2 = {
            testId: test2Data.test_id,
            testName: test2Data.test_name,
            testType: test2Data.test_type,
            startTime: new Date(test2Data.start_time),
            endTime: new Date(test2Data.end_time)
        };

        const comparison = StatisticalAnalysisService.compareTests(
            test1,
            measurements1,
            test2,
            measurements2
        );

        return res.status(200).json(comparison);
    } catch (error) {
        console.error('[AnalysisController] Compare tests error:', error);
        return res.status(500).json({
            error: 'Failed to compare tests',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Get trend analysis across multiple tests
 * POST /api/analysis/trends
 * Body: { testIds: number[] }
 */
export async function getTrendAnalysis(req: Request, res: Response) {
    try {
        const { testIds } = req.body;

        if (!Array.isArray(testIds) || testIds.length < 2) {
            return res.status(400).json({ error: 'At least 2 test IDs required for trend analysis' });
        }

        console.log(`[AnalysisController] Getting trend analysis for ${testIds.length} tests`);

        // Fetch test metadata
        const placeholders = testIds.map((_, i) => `$${i + 1}`).join(',');
        const testQuery = `
            SELECT test_id, test_name, test_type, start_time, end_time
            FROM test
            WHERE test_id IN (${placeholders})
            ORDER BY start_time
        `;
        const testResult = await pool.query(testQuery, testIds);

        if (testResult.rows.length < 2) {
            return res.status(404).json({ error: 'Insufficient tests found' });
        }

        const tests = testResult.rows.map((row: any) => ({
            testId: row.test_id,
            testName: row.test_name,
            testType: row.test_type,
            startTime: new Date(row.start_time),
            endTime: new Date(row.end_time)
        }));

        // Fetch all measurements
        const measurementsQuery = `
            SELECT test_id, angle, distance_to_sensor as distance,
                   detection_occurred as detected, recorded_at as timestamp
            FROM test_step
            WHERE test_id IN (${placeholders}) AND step_type = 'BOUNDARY_DETECTION_RADIAL'
            ORDER BY test_id, angle
        `;
        const measurementsResult = await pool.query(measurementsQuery, testIds);

        // Group measurements by test ID
        const allMeasurements = new Map<number, any[]>();
        measurementsResult.rows.forEach((row: any) => {
            const testId = row.test_id;
            if (!allMeasurements.has(testId)) {
                allMeasurements.set(testId, []);
            }
            allMeasurements.get(testId)!.push({
                angle: row.angle,
                distance: row.distance,
                detected: row.detected,
                timestamp: new Date(row.timestamp)
            });
        });

        const trendAnalysis = StatisticalAnalysisService.analyzeTrends(tests, allMeasurements);

        return res.status(200).json(trendAnalysis);
    } catch (error) {
        console.error('[AnalysisController] Get trend analysis error:', error);
        return res.status(500).json({
            error: 'Failed to analyze trends',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Detect outliers in test data
 * GET /api/analysis/outliers/:testId
 */
export async function detectOutliers(req: Request, res: Response) {
    try {
        const testId = parseInt(req.params.testId, 10);

        if (isNaN(testId)) {
            return res.status(400).json({ error: 'Invalid test ID' });
        }

        console.log(`[AnalysisController] Detecting outliers for test ${testId}`);

        // Fetch boundary measurements
        const query = `
            SELECT angle, distance_to_sensor as distance, detection_occurred as detected,
                   recorded_at as timestamp
            FROM test_step
            WHERE test_id = $1 AND step_type = 'BOUNDARY_DETECTION_RADIAL'
            ORDER BY angle, repeat_number
        `;
        const result = await pool.query(query, [testId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No boundary measurements found for this test' });
        }

        const measurements = result.rows.map((row: any) => ({
            angle: row.angle,
            distance: row.distance,
            detected: row.detected,
            timestamp: new Date(row.timestamp)
        }));

        const outlierAnalysis = StatisticalAnalysisService.detectOutliers(measurements);

        return res.status(200).json({
            testId,
            ...outlierAnalysis,
            recommendation: outlierAnalysis.outlierPercentage > 10
                ? 'High outlier percentage detected. Consider recalibrating sensor or checking test environment.'
                : 'Outlier rate is within acceptable range.'
        });
    } catch (error) {
        console.error('[AnalysisController] Detect outliers error:', error);
        return res.status(500).json({
            error: 'Failed to detect outliers',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
