import pool from "../db_conn";

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

    return result.rows[0];
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
