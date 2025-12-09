import pool from "../../db_conn";

/**
 * Get test step summary (counts by status)
 */
export async function getTestStepSummary(testId: number) {
    const result = await pool.query(
        `SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed,
            COUNT(*) FILTER (WHERE status = 'RUNNING') as running,
            COUNT(*) FILTER (WHERE status = 'PENDING') as pending,
            COUNT(*) FILTER (WHERE status = 'ERROR') as error
         FROM test_step
         WHERE test_id = $1`,
        [testId]
    );

    if (result.rows.length === 0) {
        return {
            total: 0,
            completed: 0,
            running: 0,
            pending: 0,
            error: 0
        };
    }

    return {
        total: parseInt(result.rows[0].total) || 0,
        completed: parseInt(result.rows[0].completed) || 0,
        running: parseInt(result.rows[0].running) || 0,
        pending: parseInt(result.rows[0].pending) || 0,
        error: parseInt(result.rows[0].error) || 0
    };
}

/**
 * Get test state (phase, boundary results, position)
 */
export async function getTestState(testId: number) {
    const result = await pool.query(
        `SELECT * FROM test_state WHERE test_id = $1`,
        [testId]
    );

    if (result.rows.length === 0) {
        return null;
    }

    const row = result.rows[0];

    // Parse state_data if it's a string
    let stateData: any = {};
    if (row.state_data) {
        stateData = typeof row.state_data === 'string'
            ? JSON.parse(row.state_data)
            : row.state_data;
    }

    // Return state with parsed fields and phase completion info
    return {
        ...row,
        state_data: stateData,
        boundary_detection_completed: stateData.boundary_detection_completed || false,
        tangential_test_completed: stateData.tangential_test_completed || false,
        radial_test_completed: stateData.radial_test_completed || false,
        awaiting_test_selection: stateData.awaiting_test_selection || false
    };
}

/**
 * Get detailed test steps with optional filters
 */
export async function getTestSteps(
    testId: number,
    stepType?: string,
    status?: string
) {
    let query = `SELECT * FROM test_step WHERE test_id = $1`;
    const params: any[] = [testId];

    if (stepType) {
        query += ` AND step_type = $${params.length + 1}`;
        params.push(stepType);
    }

    if (status) {
        query += ` AND status = $${params.length + 1}`;
        params.push(status);
    }

    query += ` ORDER BY sequence_no`;

    const result = await pool.query(query, params);
    return result.rows;
}

/**
 * Get compliance test results (tangential or radial)
 * Returns array of measurement results with angle, distance, offset, and detected status
 */
export async function getComplianceResults(testId: number, testType: 'TANGENTIAL' | 'RADIAL') {
    // Map test type to step_type in database
    const stepType = testType === 'TANGENTIAL' ? 'TANGENTIAL_SWEEP' : 'RADIAL_COMPLIANCE';

    const result = await pool.query(
        `SELECT
            angle,
            distance_1 as distance,
            distance_2 as offset_from_boundary,
            detection_final,
            sequence_no
         FROM test_step
         WHERE test_id = $1 AND step_type = $2
         ORDER BY sequence_no ASC`,
        [testId, stepType]
    );

    return result.rows.map(row => ({
        angle: parseFloat(row.angle),
        distance: parseFloat(row.distance),
        offset_from_boundary: row.offset_from_boundary ? parseFloat(row.offset_from_boundary) : undefined,
        detected: row.detection_final === true || row.detection_final === 'true' // Handle both boolean and string
    }));
}
