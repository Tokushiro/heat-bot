import { Request, Response } from 'express';
import { IECExportService } from '../../services/export/IECExportService';
import pool from '../../db_conn';

/**
 * Export Controller
 *
 * REST API controller for exporting test data in IEC-compliant formats.
 * Provides endpoints for boundary, grid, and radial test exports.
 */

/**
 * Export boundary test in IEC format
 * GET /api/export/boundary/:testId
 */
export async function exportBoundaryTest(req: Request, res: Response) {
    try {
        const testId = parseInt(req.params.testId, 10);

        if (isNaN(testId)) {
            return res.status(400).json({ error: 'Invalid test ID' });
        }

        console.log(`[ExportController] Exporting boundary test ${testId}`);

        // Fetch test metadata
        const testQuery = `
            SELECT test_id, test_name, test_type, detector_id, start_time, end_time
            FROM test
            WHERE test_id = $1
        `;
        const testResult = await pool.query(testQuery, [testId]);

        if (testResult.rows.length === 0) {
            return res.status(404).json({ error: 'Test not found' });
        }

        const test = testResult.rows[0];

        // Fetch test steps (boundary measurements)
        const stepsQuery = `
            SELECT angle, distance_to_sensor, detection_occurred, recorded_at, repeat_number
            FROM test_step
            WHERE test_id = $1 AND step_type = 'BOUNDARY_DETECTION_RADIAL'
            ORDER BY angle, repeat_number
        `;
        const stepsResult = await pool.query(stepsQuery, [testId]);

        // Fetch environment data (average)
        const envQuery = `
            SELECT AVG(ambient_temp) as avg_temp, AVG(humidity) as avg_humidity
            FROM telemetry_sample
            WHERE test_id = $1
        `;
        const envResult = await pool.query(envQuery, [testId]);

        // Transform data
        const measurements = stepsResult.rows.map((row: any) => ({
            angle: row.angle,
            distance: row.distance_to_sensor,
            detected: row.detection_occurred,
            timestamp: new Date(row.recorded_at),
            attempts: row.repeat_number
        }));

        const metadata = {
            testId: test.test_id,
            testName: test.test_name,
            testType: test.test_type,
            startTime: new Date(test.start_time),
            endTime: new Date(test.end_time),
            detectorId: test.detector_id,
            testEnvironment: envResult.rows[0].avg_temp ? {
                temperature: parseFloat(envResult.rows[0].avg_temp),
                humidity: parseFloat(envResult.rows[0].avg_humidity)
            } : undefined
        };

        // Generate CSV
        const csv = IECExportService.exportBoundaryTest(metadata, measurements);

        // Set response headers
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="boundary_test_${testId}.csv"`);

        return res.status(200).send(csv);
    } catch (error) {
        console.error('[ExportController] Export boundary test error:', error);
        return res.status(500).json({
            error: 'Failed to export boundary test',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Export grid test in IEC format
 * GET /api/export/grid/:testId
 */
export async function exportGridTest(req: Request, res: Response) {
    try {
        const testId = parseInt(req.params.testId, 10);

        if (isNaN(testId)) {
            return res.status(400).json({ error: 'Invalid test ID' });
        }

        console.log(`[ExportController] Exporting grid test ${testId}`);

        // Fetch test metadata
        const testQuery = `
            SELECT test_id, test_name, test_type, detector_id, start_time, end_time
            FROM test
            WHERE test_id = $1
        `;
        const testResult = await pool.query(testQuery, [testId]);

        if (testResult.rows.length === 0) {
            return res.status(404).json({ error: 'Test not found' });
        }

        const test = testResult.rows[0];

        // Fetch grid cell results
        const cellsQuery = `
            SELECT cell_row, cell_col, center_x, center_y, detected, attempts
            FROM grid_cell_result
            WHERE test_id = $1
            ORDER BY cell_row, cell_col
        `;
        const cellsResult = await pool.query(cellsQuery, [testId]);

        // Fetch grid configuration from test_state or assume defaults
        const gridConfig = {
            width: 3.0,
            height: 3.0,
            cellSize: 0.5
        };

        // Fetch environment data
        const envQuery = `
            SELECT AVG(ambient_temp) as avg_temp, AVG(humidity) as avg_humidity
            FROM telemetry_sample
            WHERE test_id = $1
        `;
        const envResult = await pool.query(envQuery, [testId]);

        // Transform data
        const cells = cellsResult.rows.map((row: any) => ({
            cellRow: row.cell_row,
            cellCol: row.cell_col,
            centerX: row.center_x,
            centerY: row.center_y,
            detected: row.detected,
            attempts: row.attempts,
            coveragePercent: row.detected ? 100 : 0, // Simplified - could be more complex
            anglesCovered: []
        }));

        const metadata = {
            testId: test.test_id,
            testName: test.test_name,
            testType: test.test_type,
            startTime: new Date(test.start_time),
            endTime: new Date(test.end_time),
            detectorId: test.detector_id,
            testEnvironment: envResult.rows[0].avg_temp ? {
                temperature: parseFloat(envResult.rows[0].avg_temp),
                humidity: parseFloat(envResult.rows[0].avg_humidity)
            } : undefined
        };

        // Generate CSV
        const csv = IECExportService.exportGridTest(metadata, cells, gridConfig);

        // Set response headers
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="grid_test_${testId}.csv"`);

        return res.status(200).send(csv);
    } catch (error) {
        console.error('[ExportController] Export grid test error:', error);
        return res.status(500).json({
            error: 'Failed to export grid test',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Export radial test in IEC format
 * GET /api/export/radial/:testId
 */
export async function exportRadialTest(req: Request, res: Response) {
    try {
        const testId = parseInt(req.params.testId, 10);

        if (isNaN(testId)) {
            return res.status(400).json({ error: 'Invalid test ID' });
        }

        console.log(`[ExportController] Exporting radial test ${testId}`);

        // Fetch test metadata
        const testQuery = `
            SELECT test_id, test_name, test_type, detector_id, start_time, end_time
            FROM test
            WHERE test_id = $1
        `;
        const testResult = await pool.query(testQuery, [testId]);

        if (testResult.rows.length === 0) {
            return res.status(404).json({ error: 'Test not found' });
        }

        const test = testResult.rows[0];

        // Fetch test steps (radial measurements)
        const stepsQuery = `
            SELECT angle, distance_to_sensor, detection_occurred, recorded_at, repeat_number
            FROM test_step
            WHERE test_id = $1 AND (step_type = 'COMPLIANCE_RADIAL' OR step_type = 'RADIAL_TEST')
            ORDER BY angle, distance_to_sensor, repeat_number
        `;
        const stepsResult = await pool.query(stepsQuery, [testId]);

        // Fetch environment data
        const envQuery = `
            SELECT AVG(ambient_temp) as avg_temp, AVG(humidity) as avg_humidity
            FROM telemetry_sample
            WHERE test_id = $1
        `;
        const envResult = await pool.query(envQuery, [testId]);

        // Transform data
        const measurements = stepsResult.rows.map((row: any) => ({
            angle: row.angle,
            distance: row.distance_to_sensor,
            detected: row.detection_occurred,
            timestamp: new Date(row.recorded_at),
            repeatNumber: row.repeat_number
        }));

        const metadata = {
            testId: test.test_id,
            testName: test.test_name,
            testType: test.test_type,
            startTime: new Date(test.start_time),
            endTime: new Date(test.end_time),
            detectorId: test.detector_id,
            testEnvironment: envResult.rows[0].avg_temp ? {
                temperature: parseFloat(envResult.rows[0].avg_temp),
                humidity: parseFloat(envResult.rows[0].avg_humidity)
            } : undefined
        };

        // Generate CSV
        const csv = IECExportService.exportRadialTest(metadata, measurements);

        // Set response headers
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="radial_test_${testId}.csv"`);

        return res.status(200).send(csv);
    } catch (error) {
        console.error('[ExportController] Export radial test error:', error);
        return res.status(500).json({
            error: 'Failed to export radial test',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
