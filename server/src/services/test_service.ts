import pool from "../db_conn";
import type { Test } from "../models/test";

export async function insertTest(test: Test): Promise<void> {
    const {
        test_name,
        test_choice,
        sensor_id,
        test_date
    } = test;

    const query = `
    INSERT INTO test
      (test_name, test_choice, sensor_id, test_date)
    VALUES
      ($1, $2, $3, $4)
  `;

    const values = [
        test_name,
        test_choice,
        sensor_id,
        test_date
    ];

    await pool.query(query, values);
}


export async function getAllTests(): Promise<Test[]> {
    const query = `
    SELECT
      test_id as test_id,
      test_name AS test_name,
      test_choice AS test_choice,
      sensor_id AS sensor_id,
      test_date AS test_date
    FROM
      test
  `;

    const result = await pool.query(query);
    return result.rows.map((row) => ({
        test_id: row.test_id,
        test_name: row.test_name,
        test_choice: row.test_choice,
        sensor_id: row.sensor_id,
        test_date: row.test_date,
    }));
}