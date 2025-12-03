import pool from "../db_conn";
import type { Test } from "../models/test";

export async function insertTest(test: Test): Promise<void> {
    const {
        test_name,
        test_choice,
        sensor_id,
        test_date,
        status = 'PLANNED', // default value
    } = test;

    const query = `
        INSERT INTO test
            (test_name, test_choice, sensor_id, test_date, status)
        VALUES
            ($1, $2, $3, $4, $5)
    `;

    const values = [
        test_name,
        test_choice,
        sensor_id,
        test_date,
        status
    ];

    await pool.query(query, values);
}

export async function getAllTests(): Promise<Test[]> {
    const query = `
        SELECT
            test_id,
            test_name,
            test_choice,
            sensor_id,
            test_date,
            status,
            started_at,
            finished_at
        FROM
            test
        ORDER BY test_date DESC
    `;

    const result = await pool.query(query);
    return result.rows.map((row) => ({
        test_id: row.test_id,
        test_name: row.test_name,
        test_choice: row.test_choice,
        sensor_id: row.sensor_id,
        test_date: row.test_date,
        status: row.status,
        started_at: row.started_at,
        finished_at: row.finished_at,
    }));
}

export async function updateTestStatus(
    test_id: number,
    status: string,
    started_at?: Date,
    finished_at?: Date
): Promise<void> {
    const query = `
    UPDATE test
    SET status = $1,
        started_at = COALESCE($2, started_at),
        finished_at = COALESCE($3, finished_at)
    WHERE test_id = $4
  `;

    await pool.query(query, [status, started_at, finished_at, test_id]);
}