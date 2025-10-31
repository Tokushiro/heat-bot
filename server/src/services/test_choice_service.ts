import pool from "../db_conn";
import type { TestChoice } from "../models/test_choice";

export async function insertTestChoice(testChoice: TestChoice): Promise<void> {
    const {
        test_name,
        test_standard,
        test_method,
        test_lab,
    } = testChoice;

    const query = `
    INSERT INTO test_choice
      (test_name, test_standard, test_method, test_lab)
    VALUES
      ($1, $2, $3, $4)
  `;

    const values = [
        test_name,
        test_standard,
        test_method,
        test_lab,
    ];

    await pool.query(query, values);
}

export async function getAllTestChoices(): Promise<TestChoice[]> {
    const query = `
    SELECT
      test_choice_id as test_id,
      test_name AS test_name,
      test_standard AS test_standard,
      test_method AS test_method,
      test_lab AS test_lab
    FROM
      test_choice
  `;

    const result = await pool.query(query);
    return result.rows.map((row) => ({
        test_id: row.test_id,
        test_name: row.test_name,
        test_standard: row.test_standard,
        test_method: row.test_method,
        test_lab: row.test_lab,
    }));
}

export async function checkTestChoiceExists(): Promise<boolean> {
    const query = `SELECT COUNT(*) FROM test_choice`;
    const result = await pool.query(query);
    const count = parseInt(result.rows[0].count, 10);
    return count > 0;
}