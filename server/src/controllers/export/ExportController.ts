import { Request, Response } from 'express';
import { IECExportService } from '../../services/export/IECExportService';
import { ExcelTemplateService } from '../../services/export/ExcelTemplateService';
import pool from '../../db_conn';


export async function exportBoundaryTest(req: Request, res: Response) {
    try {
        const testId = parseInt(req.params.testId, 10);

        if (isNaN(testId)) {
            return res.status(400).json({ error: 'Invalid test ID' });
        }

        console.log(`[ExportController] Exporting boundary test ${testId}`);

        // Fetch test metadata
        const testQuery = `
            SELECT test_id, test_name, sensor_id, started_at, finished_at
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
            SELECT angle, distance_1 as distance_to_sensor, detection_final as detection_occurred,
                   finished_at as recorded_at, sequence_no as repeat_number
            FROM test_step
            WHERE test_id = $1 AND step_type = 'BOUNDARY_DETECTION_RADIAL'
            ORDER BY angle, sequence_no
        `;
        const stepsResult = await pool.query(stepsQuery, [testId]);

        if (stepsResult.rows.length === 0) {
            return res.status(404).json({ error: 'No radial measurements found for this test' });
        }

        if (stepsResult.rows.length === 0) {
            return res.status(404).json({ error: 'No boundary measurements found for this test' });
        }

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
            detected: row.detection_occurred === true || row.detection_occurred === 'true',
            timestamp: new Date(row.recorded_at),
            attempts: row.repeat_number
        }));

        const metadata = {
            testId: test.test_id,
            testName: test.test_name,
            testType: 'BOUNDARY_DETECTION',
            startTime: new Date(test.started_at),
            endTime: new Date(test.finished_at),
            detectorId: test.sensor_id,
            testLab: test.test_lab,
            testStandard: test.test_standard,
            testMethod: test.test_method,
            testChoiceName: test.choice_name,
            testEnvironment: (envResult.rows[0].avg_temp !== null && envResult.rows[0].avg_temp !== undefined) ? {
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


export async function exportGridTest(req: Request, res: Response) {
    try {
        const testId = parseInt(req.params.testId, 10);

        if (isNaN(testId)) {
            return res.status(400).json({ error: 'Invalid test ID' });
        }

        console.log(`[ExportController] Exporting grid test ${testId}`);

        // Fetch test metadata
        const testQuery = `
            SELECT test_id, test_name, sensor_id, started_at, finished_at
            FROM test
            WHERE test_id = $1
        `;
        const testResult = await pool.query(testQuery, [testId]);

        if (testResult.rows.length === 0) {
            return res.status(404).json({ error: 'Test not found' });
        }

        const test = testResult.rows[0];

        // Fetch grid test steps (using test_step table)
        // Prefer explicit grid cell rows/cols when present
        const cellsQuery = `
            SELECT cell_row, cell_col, detection_final as detected, distance_1, angle
            FROM test_step
            WHERE test_id = $1 AND step_type IN ('COMPLIANCE_TANGENTIAL', 'TANGENTIAL_SWEEP', 'GRID_TANGENTIAL')
            ORDER BY cell_row NULLS LAST, cell_col NULLS LAST, angle, sequence_no
        `;
        const cellsResult = await pool.query(cellsQuery, [testId]);

        if (cellsResult.rows.length === 0) {
            return res.status(404).json({ error: 'No tangential compliance measurements found for this test' });
        }

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

        // Transform data - map test_step results to grid cell format
        const cells = cellsResult.rows.map((row: any, index: number) => {
            const detected = row.detected === true || row.detected === 'true';
            const cellRow = row.cell_row !== null && row.cell_row !== undefined
                ? parseInt(row.cell_row, 10)
                : Math.floor(index / 6); // fallback layout
            const cellCol = row.cell_col !== null && row.cell_col !== undefined
                ? parseInt(row.cell_col, 10)
                : index % 6;

            return {
                cellRow,
                cellCol,
                centerX: row.distance_1 ? row.distance_1 * Math.cos((row.angle || 0) * Math.PI / 180) : 0,
                centerY: row.distance_1 ? row.distance_1 * Math.sin((row.angle || 0) * Math.PI / 180) : 0,
                detected,
                attempts: 1,
                coveragePercent: detected ? 100 : 0,
                anglesCovered: row.angle !== undefined ? [row.angle] : []
            };
        });

        const metadata = {
            testId: test.test_id,
            testName: test.test_name,
            testType: 'TANGENTIAL_TEST',
            startTime: new Date(test.started_at),
            endTime: new Date(test.finished_at),
            detectorId: test.sensor_id,
            testLab: test.test_lab,
            testStandard: test.test_standard,
            testMethod: test.test_method,
            testChoiceName: test.choice_name,
            testEnvironment: (envResult.rows[0].avg_temp !== null && envResult.rows[0].avg_temp !== undefined) ? {
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
            SELECT test_id, test_name, sensor_id, started_at, finished_at
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
            SELECT angle, distance_1 as distance_to_sensor, detection_final as detection_occurred,
                   finished_at as recorded_at, sequence_no as repeat_number
            FROM test_step
            WHERE test_id = $1 AND step_type IN ('COMPLIANCE_RADIAL', 'RADIAL_COMPLIANCE', 'RADIAL_TEST')
            ORDER BY angle, distance_1, sequence_no
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
            detected: row.detection_occurred === true || row.detection_occurred === 'true',
            timestamp: new Date(row.recorded_at),
            repeatNumber: row.repeat_number
        }));

        // Attach averaged ranges from radial_boundary if present
        const avgQuery = `
            SELECT angle, radial_detection1_avg AS avg_range
            FROM radial_boundary
            WHERE test_id = $1
        `;
        const avgResult = await pool.query(avgQuery, [testId]);
        const avgMap = new Map<number, number>();
        avgResult.rows.forEach((r: any) => avgMap.set(r.angle, parseFloat(r.avg_range)));

        const metadata = {
            testId: test.test_id,
            testName: test.test_name,
            testType: 'RADIAL_TEST',
            startTime: new Date(test.started_at),
            endTime: new Date(test.finished_at),
            detectorId: test.sensor_id,
            testLab: test.test_lab,
            testStandard: test.test_standard,
            testMethod: test.test_method,
            testChoiceName: test.choice_name,
            testEnvironment: (envResult.rows[0].avg_temp !== null && envResult.rows[0].avg_temp !== undefined) ? {
                temperature: parseFloat(envResult.rows[0].avg_temp),
                humidity: parseFloat(envResult.rows[0].avg_humidity)
            } : undefined,
            // Provide averaged ranges per angle when available
            radialAverages: avgMap
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

/**
 * Export comprehensive IEC 63180 test report (all test types combined)
 * GET /api/export/comprehensive/:testId
 */
export async function exportComprehensiveTest(req: Request, res: Response) {
    try {
        const testId = parseInt(req.params.testId, 10);

        if (isNaN(testId)) {
            return res.status(400).json({ error: 'Invalid test ID' });
        }

        console.log(`[ExportController] Exporting comprehensive test ${testId}`);

        // Fetch test metadata with sensor information
        const testQuery = `
            SELECT t.test_id,
                   t.test_name,
                   t.sensor_id,
                   t.started_at,
                   t.finished_at,
                   t.status,
                   s.hw_version,
                   s.sw_version,
                   s.mounting_height,
                   tc.test_name    AS choice_name,
                   tc.test_standard,
                   tc.test_method,
                   tc.test_lab
            FROM test t
            LEFT JOIN sensor s ON t.sensor_id = s.sensor_id
            LEFT JOIN test_choice tc ON t.test_choice = tc.test_choice_id
            WHERE t.test_id = $1
        `;
        const testResult = await pool.query(testQuery, [testId]);

        if (testResult.rows.length === 0) {
            return res.status(404).json({ error: 'Test not found' });
        }

        const test = testResult.rows[0];

        // Ensure all phases are completed before exporting
        const stateResult = await pool.query(
            `SELECT state_data, boundary_results FROM test_state WHERE test_id = $1`,
            [testId]
        );

        let stateData: any = {};
        let boundaryResultsFromState: any[] = [];

        if (stateResult.rows.length > 0) {
            const row = stateResult.rows[0];
            try {
                stateData = typeof row.state_data === 'string' ? JSON.parse(row.state_data) : (row.state_data || {});
            } catch {
                stateData = {};
            }
            try {
                boundaryResultsFromState = typeof row.boundary_results === 'string'
                    ? JSON.parse(row.boundary_results)
                    : (row.boundary_results || []);
            } catch {
                boundaryResultsFromState = [];
            }
        }

        const [boundaryCountRes, tangentialCountRes, radialCountRes] = await Promise.all([
            pool.query(`SELECT COUNT(*) FROM test_step WHERE test_id = $1 AND step_type = 'BOUNDARY_DETECTION_RADIAL'`, [testId]),
            pool.query(`SELECT COUNT(*) FROM test_step WHERE test_id = $1 AND step_type IN ('COMPLIANCE_TANGENTIAL', 'TANGENTIAL_SWEEP')`, [testId]),
            pool.query(`SELECT COUNT(*) FROM test_step WHERE test_id = $1 AND step_type IN ('COMPLIANCE_RADIAL', 'RADIAL_COMPLIANCE', 'RADIAL_TEST')`, [testId])
        ]);

        const boundaryComplete = !!stateData.boundary_detection_completed || boundaryResultsFromState.length > 0 || parseInt(boundaryCountRes.rows[0]?.count || '0', 10) > 0;
        const tangentialComplete = !!stateData.tangential_test_completed || parseInt(tangentialCountRes.rows[0]?.count || '0', 10) > 0;
        const radialComplete = !!stateData.radial_test_completed || parseInt(radialCountRes.rows[0]?.count || '0', 10) > 0;
        const statusComplete = test.status === 'COMPLETED';
        const allPhasesComplete = boundaryComplete && tangentialComplete && radialComplete;

        if (!allPhasesComplete || !statusComplete) {
            return res.status(400).json({
                error: 'All phases must be completed before exporting the comprehensive CSV',
                boundaryComplete,
                tangentialComplete,
                radialComplete,
                statusComplete
            });
        }

        // Fetch boundary detection test steps
        const boundaryQuery = `
            SELECT angle, distance_1 as distance_to_sensor, detection_final as detection_occurred,
                   finished_at as recorded_at, sequence_no as repeat_number
            FROM test_step
            WHERE test_id = $1 AND step_type = 'BOUNDARY_DETECTION_RADIAL'
            ORDER BY angle, sequence_no
        `;
        const boundaryResult = await pool.query(boundaryQuery, [testId]);

        // Fetch radial test steps
        const radialQuery = `
            SELECT angle, distance_1 as distance_to_sensor, detection_final as detection_occurred,
                   finished_at as recorded_at, sequence_no as repeat_number
            FROM test_step
            WHERE test_id = $1 AND step_type IN ('COMPLIANCE_RADIAL', 'RADIAL_COMPLIANCE', 'RADIAL_TEST')
            ORDER BY angle, distance_1, sequence_no
        `;
        const radialResult = await pool.query(radialQuery, [testId]);

        if (boundaryResult.rows.length === 0) {
            return res.status(404).json({ error: 'No boundary measurements found for this test' });
        }

        if (radialResult.rows.length === 0) {
            return res.status(404).json({ error: 'No radial measurements found for this test' });
        }

        // Fetch environment data (average)
        const envQuery = `
            SELECT AVG(ambient_temp) as avg_temp, AVG(humidity) as avg_humidity
            FROM telemetry_sample
            WHERE test_id = $1
        `;
        const envResult = await pool.query(envQuery, [testId]);

        // Transform boundary data
        const boundaryData = boundaryResult.rows.map((row: any) => ({
            angle: row.angle,
            distance: row.distance_to_sensor || 0,
            detected: row.detection_occurred === true || row.detection_occurred === 'true',
            timestamp: row.recorded_at ? new Date(row.recorded_at) : new Date(),
            attempts: row.repeat_number
        }));

        // Transform radial data
        const radialData = radialResult.rows.length > 0 ? radialResult.rows.map((row: any) => ({
            angle: row.angle,
            distance: row.distance_to_sensor || 0,
            detected: row.detection_occurred === true || row.detection_occurred === 'true',
            timestamp: row.recorded_at ? new Date(row.recorded_at) : new Date(),
            repeatNumber: row.repeat_number
        })) : undefined;

        const metadata = {
            testId: test.test_id,
            testName: test.test_name,
            testType: 'COMPREHENSIVE_IEC_63180',
            startTime: test.started_at ? new Date(test.started_at) : new Date(),
            endTime: test.finished_at ? new Date(test.finished_at) : new Date(),
            detectorId: test.sensor_id,
            sensorId: test.sensor_id,
            mountingHeight: test.mounting_height || '2.5 m - 3 m',
            hwVersion: test.hw_version,
            swVersion: test.sw_version,
            testPerson: 'H.E.A.T. Bot System',
            testLab: test.test_lab,
            testStandard: test.test_standard,
            testMethod: test.test_method,
            testChoiceName: test.choice_name,
            testEnvironment: (envResult.rows[0].avg_temp !== null && envResult.rows[0].avg_temp !== undefined) ? {
                temperature: parseFloat(envResult.rows[0].avg_temp),
                humidity: parseFloat(envResult.rows[0].avg_humidity)
            } : undefined
        };

        // Generate comprehensive CSV
        const csv = IECExportService.exportComprehensiveTest(metadata, boundaryData, radialData);

        // Set response headers
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="IEC63180_Test_${testId}_${test.test_name.replace(/\s+/g, '_')}.csv"`);

        return res.status(200).send(csv);
    } catch (error) {
        console.error('[ExportController] Export comprehensive test error:', error);
        return res.status(500).json({
            error: 'Failed to export comprehensive test',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Export comprehensive IEC 63180 test report as Excel workbook (multi-tab)
 * GET /api/export/excel/:testId
 */
export async function exportExcelReport(req: Request, res: Response) {
    try {
        const testId = parseInt(req.params.testId, 10);

        if (isNaN(testId)) {
            return res.status(400).json({ error: 'Invalid test ID' });
        }

        console.log(`[ExportController] Exporting Excel report for test ${testId}`);

        // Fetch test metadata with sensor information
        const testQuery = `
            SELECT t.test_id,
                   t.test_name,
                   t.sensor_id,
                   t.started_at,
                   t.finished_at,
                   t.status,
                   s.hw_version,
                   s.sw_version,
                   s.mounting_height,
                   tc.test_name    AS choice_name,
                   tc.test_standard,
                   tc.test_method,
                   tc.test_lab
            FROM test t
            LEFT JOIN sensor s ON t.sensor_id = s.sensor_id
            LEFT JOIN test_choice tc ON t.test_choice = tc.test_choice_id
            WHERE t.test_id = $1
        `;
        const testResult = await pool.query(testQuery, [testId]);

        if (testResult.rows.length === 0) {
            return res.status(404).json({ error: 'Test not found' });
        }

        const test = testResult.rows[0];

        // Fetch boundary measurements
        const boundaryQuery = `
            SELECT angle, distance_1 as distance_to_sensor, detection_final as detection_occurred
            FROM test_step
            WHERE test_id = $1 AND step_type = 'BOUNDARY_DETECTION_RADIAL'
            ORDER BY angle
        `;
        const boundaryResult = await pool.query(boundaryQuery, [testId]);

        // Fetch tangential measurements
        const tangentialQuery = `
            SELECT angle, distance_1 as distance, detection_final as detected
            FROM test_step
            WHERE test_id = $1 AND step_type IN ('GRID_TANGENTIAL', 'COMPLIANCE_TANGENTIAL')
            ORDER BY angle, distance_1
        `;
        const tangentialResult = await pool.query(tangentialQuery, [testId]);

        // Fetch radial measurements
        const radialQuery = `
            SELECT angle, distance_1 as distance, distance_2 as offset_from_boundary, detection_final as detected
            FROM test_step
            WHERE test_id = $1 AND step_type IN ('COMPLIANCE_RADIAL', 'RADIAL_SWEEP')
            ORDER BY angle
        `;
        const radialResult = await pool.query(radialQuery, [testId]);

        // Fetch environment data (average)
        const envQuery = `
            SELECT AVG(ambient_temp) as avg_temp, AVG(humidity) as avg_humidity
            FROM telemetry_sample
            WHERE test_id = $1
        `;
        const envResult = await pool.query(envQuery, [testId]);

        // Transform data
        const boundaryData = boundaryResult.rows.map((row: any) => ({
            angle: row.angle,
            distance: row.distance_to_sensor,
            detected: row.detection_occurred === true || row.detection_occurred === 'true'
        }));

        const tangentialData = tangentialResult.rows.map((row: any) => ({
            angle: row.angle,
            distance: row.distance,
            detected: row.detected === true || row.detected === 'true'
        }));

        const radialData = radialResult.rows.map((row: any) => ({
            angle: row.angle,
            distance: row.distance,
            detected: row.detected === true || row.detected === 'true',
            offsetFromBoundary: row.offset_from_boundary
        }));

        const metadata = {
            testId: test.test_id,
            testName: test.test_name,
            sensorId: test.sensor_id,
            hwVersion: test.hw_version,
            swVersion: test.sw_version,
            mountingHeight: test.mounting_height,
            testLab: test.test_lab,
            testStandard: test.test_standard,
            testMethod: test.test_method,
            testChoiceName: test.choice_name,
            startTime: new Date(test.started_at),
            endTime: test.finished_at ? new Date(test.finished_at) : undefined,
            operator: 'H.E.A.T. Bot System',
            temperature: envResult.rows[0].avg_temp ? parseFloat(envResult.rows[0].avg_temp) : undefined,
            humidity: envResult.rows[0].avg_humidity ? parseFloat(envResult.rows[0].avg_humidity) : undefined
        };

        // Generate Excel workbook
        const workbook = await ExcelTemplateService.generateIEC63180Report(
            metadata,
            boundaryData,
            tangentialData,
            radialData
        );

        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="IEC63180_Test_${testId}_${test.test_name.replace(/\s+/g, '_')}.xlsx"`);

        // Write to response
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('[ExportController] Export Excel report error:', error);
        return res.status(500).json({
            error: 'Failed to export Excel report',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
