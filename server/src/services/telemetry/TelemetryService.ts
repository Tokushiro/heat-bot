import pool from "../../db_conn";
import { HeatingZoneStatus } from "../../api/interfaces/IHeatingAPI";

/**
 * Telemetry Service
 *
 * Manages telemetry data storage and retrieval.
 * Records real-time environmental conditions, heating status,
 * and robot position during test execution.
 */

export interface TelemetrySample {
    telemetry_id?: number;
    test_id: number;
    test_step_id?: number;
    timestamp?: Date;

    // Environmental conditions
    ambient_temp?: number;
    humidity?: number;

    // Head zone
    head_temp_avg?: number;
    head_temp_min?: number;
    head_temp_max?: number;
    head_enabled?: boolean;
    head_power_level?: number;
    head_target_temp?: number;

    // Body zone
    body_temp_avg?: number;
    body_temp_min?: number;
    body_temp_max?: number;
    body_enabled?: boolean;
    body_power_level?: number;
    body_target_temp?: number;

    // Legs zone
    legs_temp_avg?: number;
    legs_temp_min?: number;
    legs_temp_max?: number;
    legs_enabled?: boolean;
    legs_power_level?: number;
    legs_target_temp?: number;

    // Robot state
    detector_angle?: number;
    robot_position_x?: number;
    robot_position_y?: number;

    // Detection state
    detection_active?: boolean;
}

export interface TelemetrySummary {
    test_id: number;
    sample_count: number;
    first_sample: Date;
    last_sample: Date;
    duration_seconds: number;

    avg_ambient_temp?: number;
    min_ambient_temp?: number;
    max_ambient_temp?: number;
    avg_humidity?: number;

    avg_head_temp?: number;
    min_head_temp?: number;
    max_head_temp?: number;

    avg_body_temp?: number;
    min_body_temp?: number;
    max_body_temp?: number;

    avg_legs_temp?: number;
    min_legs_temp?: number;
    max_legs_temp?: number;

    detection_count: number;
    detection_rate_percent: number;
}

export class TelemetryService {
    /**
     * Record a telemetry sample
     */
    static async recordSample(sample: TelemetrySample): Promise<number> {
        const query = `
            INSERT INTO telemetry_sample (
                test_id, test_step_id, timestamp,
                ambient_temp, humidity,
                head_temp_avg, head_temp_min, head_temp_max, head_enabled, head_power_level, head_target_temp,
                body_temp_avg, body_temp_min, body_temp_max, body_enabled, body_power_level, body_target_temp,
                legs_temp_avg, legs_temp_min, legs_temp_max, legs_enabled, legs_power_level, legs_target_temp,
                detector_angle, robot_position_x, robot_position_y,
                detection_active
            ) VALUES (
                $1, $2, COALESCE($3, NOW()),
                $4, $5,
                $6, $7, $8, $9, $10, $11,
                $12, $13, $14, $15, $16, $17,
                $18, $19, $20, $21, $22, $23,
                $24, $25, $26,
                $27
            ) RETURNING telemetry_id
        `;

        const values = [
            sample.test_id,
            sample.test_step_id,
            sample.timestamp,
            sample.ambient_temp,
            sample.humidity,
            sample.head_temp_avg,
            sample.head_temp_min,
            sample.head_temp_max,
            sample.head_enabled,
            sample.head_power_level,
            sample.head_target_temp,
            sample.body_temp_avg,
            sample.body_temp_min,
            sample.body_temp_max,
            sample.body_enabled,
            sample.body_power_level,
            sample.body_target_temp,
            sample.legs_temp_avg,
            sample.legs_temp_min,
            sample.legs_temp_max,
            sample.legs_enabled,
            sample.legs_power_level,
            sample.legs_target_temp,
            sample.detector_angle,
            sample.robot_position_x,
            sample.robot_position_y,
            sample.detection_active
        ];

        const result = await pool.query(query, values);
        return result.rows[0].telemetry_id;
    }

    /**
     * Record telemetry from heating zones
     */
    static async recordFromHeatingZones(
        testId: number,
        ambientTemp: number,
        zones: HeatingZoneStatus[],
        detectorAngle?: number,
        robotX?: number,
        robotY?: number,
        testStepId?: number
    ): Promise<number> {
        const headZone = zones.find(z => z.zone === 'HEAD');
        const bodyZone = zones.find(z => z.zone === 'BODY');
        const legsZone = zones.find(z => z.zone === 'LEGS');

        const sample: TelemetrySample = {
            test_id: testId,
            test_step_id: testStepId,
            ambient_temp: ambientTemp,

            head_temp_avg: headZone?.avgTemp,
            head_temp_min: headZone?.minTemp,
            head_temp_max: headZone?.maxTemp,
            head_enabled: headZone?.enabled,
            head_power_level: headZone?.powerLevel,
            head_target_temp: headZone?.targetTemp,

            body_temp_avg: bodyZone?.avgTemp,
            body_temp_min: bodyZone?.minTemp,
            body_temp_max: bodyZone?.maxTemp,
            body_enabled: bodyZone?.enabled,
            body_power_level: bodyZone?.powerLevel,
            body_target_temp: bodyZone?.targetTemp,

            legs_temp_avg: legsZone?.avgTemp,
            legs_temp_min: legsZone?.minTemp,
            legs_temp_max: legsZone?.maxTemp,
            legs_enabled: legsZone?.enabled,
            legs_power_level: legsZone?.powerLevel,
            legs_target_temp: legsZone?.targetTemp,

            detector_angle: detectorAngle,
            robot_position_x: robotX,
            robot_position_y: robotY
        };

        return this.recordSample(sample);
    }

    /**
     * Get telemetry samples for a test
     */
    static async getSamplesForTest(
        testId: number,
        limit?: number,
        offset?: number
    ): Promise<TelemetrySample[]> {
        const query = `
            SELECT * FROM telemetry_sample
            WHERE test_id = $1
            ORDER BY timestamp DESC
            LIMIT $2 OFFSET $3
        `;

        const result = await pool.query(query, [
            testId,
            limit || 1000,
            offset || 0
        ]);

        return result.rows;
    }

    /**
     * Get latest telemetry sample for a test
     */
    static async getLatestSample(testId: number): Promise<TelemetrySample | null> {
        const query = `
            SELECT * FROM v_latest_telemetry
            WHERE test_id = $1
        `;

        const result = await pool.query(query, [testId]);
        return result.rows[0] || null;
    }

    /**
     * Get telemetry summary for a test
     */
    static async getSummary(testId: number): Promise<TelemetrySummary | null> {
        const query = `
            SELECT * FROM v_telemetry_summary
            WHERE test_id = $1
        `;

        const result = await pool.query(query, [testId]);
        return result.rows[0] || null;
    }

    /**
     * Get telemetry samples within a time range
     */
    static async getSamplesByTimeRange(
        testId: number,
        startTime: Date,
        endTime: Date
    ): Promise<TelemetrySample[]> {
        const query = `
            SELECT * FROM telemetry_sample
            WHERE test_id = $1
                AND timestamp >= $2
                AND timestamp <= $3
            ORDER BY timestamp ASC
        `;

        const result = await pool.query(query, [testId, startTime, endTime]);
        return result.rows;
    }

    /**
     * Get telemetry samples for a specific test step
     */
    static async getSamplesForStep(testStepId: number): Promise<TelemetrySample[]> {
        const query = `
            SELECT * FROM telemetry_sample
            WHERE test_step_id = $1
            ORDER BY timestamp ASC
        `;

        const result = await pool.query(query, [testStepId]);
        return result.rows;
    }

    /**
     * Delete telemetry samples for a test
     */
    static async deleteSamplesForTest(testId: number): Promise<number> {
        const query = `
            DELETE FROM telemetry_sample
            WHERE test_id = $1
        `;

        const result = await pool.query(query, [testId]);
        return result.rowCount || 0;
    }

    /**
     * Get sample count for a test
     */
    static async getSampleCount(testId: number): Promise<number> {
        const query = `
            SELECT COUNT(*) as count
            FROM telemetry_sample
            WHERE test_id = $1
        `;

        const result = await pool.query(query, [testId]);
        return parseInt(result.rows[0].count, 10);
    }

    /**
     * Export telemetry to CSV format
     */
    static async exportToCSV(testId: number): Promise<string> {
        const samples = await this.getSamplesForTest(testId, 100000);

        const headers = [
            'Timestamp',
            'Ambient Temp (°C)',
            'Humidity (%)',
            'Head Temp Avg (°C)',
            'Head Temp Min (°C)',
            'Head Temp Max (°C)',
            'Head Enabled',
            'Head Power (%)',
            'Body Temp Avg (°C)',
            'Body Temp Min (°C)',
            'Body Temp Max (°C)',
            'Body Enabled',
            'Body Power (%)',
            'Legs Temp Avg (°C)',
            'Legs Temp Min (°C)',
            'Legs Temp Max (°C)',
            'Legs Enabled',
            'Legs Power (%)',
            'Detector Angle (°)',
            'Robot X (m)',
            'Robot Y (m)',
            'Detection Active'
        ];

        const rows = samples.map(s => [
            s.timestamp,
            s.ambient_temp,
            s.humidity,
            s.head_temp_avg,
            s.head_temp_min,
            s.head_temp_max,
            s.head_enabled,
            s.head_power_level,
            s.body_temp_avg,
            s.body_temp_min,
            s.body_temp_max,
            s.body_enabled,
            s.body_power_level,
            s.legs_temp_avg,
            s.legs_temp_min,
            s.legs_temp_max,
            s.legs_enabled,
            s.legs_power_level,
            s.detector_angle,
            s.robot_position_x,
            s.robot_position_y,
            s.detection_active
        ]);

        return [
            headers.join(','),
            ...rows.map(row => row.map(v => v ?? 'N/A').join(','))
        ].join('\n');
    }
}
