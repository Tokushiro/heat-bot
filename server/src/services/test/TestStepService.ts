import pool from "../../db_conn";
import type { TestStep } from "../../models/test_step";

export async function insertTestStep(step: TestStep): Promise<number> {
    const query = `
    INSERT INTO test_step
      (test_id, step_type, sequence_no, angle, cell_row, cell_col,
       distance_1, distance_2, distance_avg,
       detection_1, detection_2, detection_final, status)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING test_step_id
  `;

    const values = [
        step.test_id,
        step.step_type,
        step.sequence_no,
        step.angle ?? null,
        step.cell_row ?? null,
        step.cell_col ?? null,
        step.distance_1 ?? null,
        step.distance_2 ?? null,
        step.distance_avg ?? null,
        step.detection_1 ?? null,
        step.detection_2 ?? null,
        step.detection_final ?? null,
        step.status ?? 'PENDING'
    ];

    const result = await pool.query(query, values);
    return result.rows[0].test_step_id;
}

export async function getTestSteps(test_id: number): Promise<TestStep[]> {
    const query = `
    SELECT *
    FROM test_step
    WHERE test_id = $1
    ORDER BY sequence_no
  `;

    const result = await pool.query(query, [test_id]);
    return result.rows;
}

export async function updateTestStep(
    test_step_id: number,
    updates: Partial<TestStep>
): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    Object.entries(updates).forEach(([key, value]) => {
        if (key !== 'test_step_id' && value !== undefined) {
            fields.push(`${key} = $${paramCount}`);
            values.push(value);
            paramCount++;
        }
    });

    if (fields.length === 0) return;

    values.push(test_step_id);
    const query = `
    UPDATE test_step
    SET ${fields.join(', ')}
    WHERE test_step_id = $${paramCount}
  `;

    await pool.query(query, values);
}

export async function getTestProgress(test_id: number) {
    const query = `
    SELECT 
      COUNT(*) as total_steps,
      SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_steps,
      SUM(CASE WHEN status = 'ERROR' THEN 1 ELSE 0 END) as error_steps,
      SUM(CASE WHEN status = 'RUNNING' THEN 1 ELSE 0 END) as running_steps
    FROM test_step
    WHERE test_id = $1
  `;

    const result = await pool.query(query, [test_id]);
    return result.rows[0];
}