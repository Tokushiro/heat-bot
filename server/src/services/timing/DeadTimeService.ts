import pool from '../../db_conn';
import { DeadTimeManager, DeadTimeReason, DeadTimeLog } from './DeadTimeManager';

/**
 * Dead Time Service
 *
 * Integrates DeadTimeManager with database logging for IEC compliance
 * and timing analysis.
 */

export interface DeadTimeSummary {
    testId: number;
    testName: string;
    totalDurationSeconds: number;
    totalDeadTimeMs: number;
    totalDeadTimeSeconds: number;
    deadTimePercentage: number;
    activeTimeSeconds: number;
    deadTimeCount: number;
}

export interface DeadTimeBreakdown {
    testId: number;
    reason: DeadTimeReason;
    occurrenceCount: number;
    totalDurationMs: number;
    avgDurationMs: number;
    minDurationMs: number;
    maxDurationMs: number;
}

export class DeadTimeService {
    /**
     * Log a dead time event to the database
     */
    static async logDeadTime(
        testId: number,
        reason: DeadTimeReason,
        durationMs: number,
        testStepId?: number,
        metadata?: any
    ): Promise<void> {
        try {
            const query = `
                INSERT INTO dead_time_log (test_id, test_step_id, reason, duration_ms, metadata)
                VALUES ($1, $2, $3, $4, $5)
            `;
            await pool.query(query, [
                testId,
                testStepId || null,
                reason,
                durationMs,
                metadata ? JSON.stringify(metadata) : null
            ]);

            console.log(`[DeadTimeService] Logged ${durationMs}ms dead time (${reason}) for test ${testId}`);
        } catch (error) {
            console.error('[DeadTimeService] Error logging dead time:', error);
            // Don't throw - dead time logging failures shouldn't stop tests
        }
    }

    /**
     * Log dead time from DeadTimeManager logs
     */
    static async logBatch(logs: DeadTimeLog[]): Promise<void> {
        if (logs.length === 0) return;

        try {
            const values: any[] = [];
            const placeholders: string[] = [];

            logs.forEach((log, index) => {
                const baseIndex = index * 5;
                placeholders.push(
                    `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5})`
                );
                values.push(
                    log.testId || null,
                    log.testStepId || null,
                    log.reason,
                    log.durationMs,
                    log.metadata ? JSON.stringify(log.metadata) : null
                );
            });

            const query = `
                INSERT INTO dead_time_log (test_id, test_step_id, reason, duration_ms, metadata)
                VALUES ${placeholders.join(', ')}
            `;

            await pool.query(query, values);
            console.log(`[DeadTimeService] Logged ${logs.length} dead time events`);
        } catch (error) {
            console.error('[DeadTimeService] Error logging dead time batch:', error);
        }
    }

    /**
     * Get dead time summary for a test
     */
    static async getSummary(testId: number): Promise<DeadTimeSummary | null> {
        try {
            const query = `
                SELECT
                    test_id,
                    test_name,
                    total_duration_seconds,
                    total_dead_time_ms,
                    total_dead_time_seconds,
                    dead_time_percentage,
                    active_time_seconds,
                    dead_time_count
                FROM v_test_timing_summary
                WHERE test_id = $1
            `;
            const result = await pool.query(query, [testId]);

            if (result.rows.length === 0) {
                return null;
            }

            const row = result.rows[0];
            return {
                testId: row.test_id,
                testName: row.test_name,
                totalDurationSeconds: parseFloat(row.total_duration_seconds),
                totalDeadTimeMs: parseInt(row.total_dead_time_ms),
                totalDeadTimeSeconds: parseFloat(row.total_dead_time_seconds),
                deadTimePercentage: parseFloat(row.dead_time_percentage),
                activeTimeSeconds: parseFloat(row.active_time_seconds),
                deadTimeCount: parseInt(row.dead_time_count)
            };
        } catch (error) {
            console.error('[DeadTimeService] Error getting dead time summary:', error);
            return null;
        }
    }

    /**
     * Get dead time breakdown by reason for a test
     */
    static async getBreakdown(testId: number): Promise<DeadTimeBreakdown[]> {
        try {
            const query = `
                SELECT
                    test_id,
                    reason,
                    occurrence_count,
                    total_duration_ms,
                    avg_duration_ms,
                    min_duration_ms,
                    max_duration_ms
                FROM v_dead_time_breakdown
                WHERE test_id = $1
                ORDER BY total_duration_ms DESC
            `;
            const result = await pool.query(query, [testId]);

            return result.rows.map((row: any) => ({
                testId: row.test_id,
                reason: row.reason as DeadTimeReason,
                occurrenceCount: parseInt(row.occurrence_count),
                totalDurationMs: parseInt(row.total_duration_ms),
                avgDurationMs: parseFloat(row.avg_duration_ms),
                minDurationMs: parseInt(row.min_duration_ms),
                maxDurationMs: parseInt(row.max_duration_ms)
            }));
        } catch (error) {
            console.error('[DeadTimeService] Error getting dead time breakdown:', error);
            return [];
        }
    }

    /**
     * Get all dead time logs for a test
     */
    static async getLogs(testId: number): Promise<any[]> {
        try {
            const query = `
                SELECT
                    log_id,
                    test_id,
                    test_step_id,
                    timestamp,
                    reason,
                    duration_ms,
                    metadata
                FROM dead_time_log
                WHERE test_id = $1
                ORDER BY timestamp ASC
            `;
            const result = await pool.query(query, [testId]);

            return result.rows.map((row: any) => ({
                logId: row.log_id,
                testId: row.test_id,
                testStepId: row.test_step_id,
                timestamp: row.timestamp,
                reason: row.reason,
                durationMs: row.duration_ms,
                metadata: row.metadata
            }));
        } catch (error) {
            console.error('[DeadTimeService] Error getting dead time logs:', error);
            return [];
        }
    }

    /**
     * Compare dead time across multiple tests
     */
    static async compareTests(testIds: number[]): Promise<DeadTimeSummary[]> {
        try {
            const placeholders = testIds.map((_, i) => `$${i + 1}`).join(',');
            const query = `
                SELECT
                    test_id,
                    test_name,
                    total_duration_seconds,
                    total_dead_time_ms,
                    total_dead_time_seconds,
                    dead_time_percentage,
                    active_time_seconds,
                    dead_time_count
                FROM v_test_timing_summary
                WHERE test_id IN (${placeholders})
                ORDER BY test_id
            `;
            const result = await pool.query(query, testIds);

            return result.rows.map((row: any) => ({
                testId: row.test_id,
                testName: row.test_name,
                totalDurationSeconds: parseFloat(row.total_duration_seconds),
                totalDeadTimeMs: parseInt(row.total_dead_time_ms),
                totalDeadTimeSeconds: parseFloat(row.total_dead_time_seconds),
                deadTimePercentage: parseFloat(row.dead_time_percentage),
                activeTimeSeconds: parseFloat(row.active_time_seconds),
                deadTimeCount: parseInt(row.dead_time_count)
            }));
        } catch (error) {
            console.error('[DeadTimeService] Error comparing dead time:', error);
            return [];
        }
    }

    /**
     * Get average dead time by test type
     */
    static async getAverageByTestType(): Promise<any[]> {
        try {
            const query = `
                SELECT
                    t.test_type,
                    COUNT(DISTINCT t.test_id) AS test_count,
                    AVG(vts.total_dead_time_seconds) AS avg_dead_time_seconds,
                    AVG(vts.dead_time_percentage) AS avg_dead_time_percentage,
                    AVG(vts.active_time_seconds) AS avg_active_time_seconds
                FROM test t
                JOIN v_test_timing_summary vts ON t.test_id = vts.test_id
                WHERE t.test_status = 'COMPLETED'
                GROUP BY t.test_type
                ORDER BY t.test_type
            `;
            const result = await pool.query(query);

            return result.rows.map((row: any) => ({
                testType: row.test_type,
                testCount: parseInt(row.test_count),
                avgDeadTimeSeconds: parseFloat(row.avg_dead_time_seconds),
                avgDeadTimePercentage: parseFloat(row.avg_dead_time_percentage),
                avgActiveTimeSeconds: parseFloat(row.avg_active_time_seconds)
            }));
        } catch (error) {
            console.error('[DeadTimeService] Error getting average by test type:', error);
            return [];
        }
    }

    /**
     * Clear dead time logs for a test (cleanup utility)
     */
    static async clearLogsForTest(testId: number): Promise<void> {
        try {
            const query = 'DELETE FROM dead_time_log WHERE test_id = $1';
            await pool.query(query, [testId]);
            console.log(`[DeadTimeService] Cleared dead time logs for test ${testId}`);
        } catch (error) {
            console.error('[DeadTimeService] Error clearing dead time logs:', error);
        }
    }
}
