import pool from "../db_conn";

/**
 * CSV Export Service
 * Generates CSV reports from test data matching the Excel template format
 */

export interface CSVExportOptions {
    testId: number;
    includeRawData?: boolean;
    includeEventLog?: boolean;
}

export class CSVExportService {
    /**
     * Generate complete test report CSV
     */
    static async generateTestReportCSV(options: CSVExportOptions): Promise<string> {
        const { testId, includeRawData = true, includeEventLog = false } = options;

        // Get test details
        const testData = await this.getTestData(testId);
        
        let csv = "";

        // Header section
        csv += this.generateHeaderSection(testData);
        csv += "\n";

        // Radial boundary results
        if (testData.radialBoundaries.length > 0) {
            csv += this.generateRadialBoundarySection(testData.radialBoundaries);
            csv += "\n";
        }

        // Tangential boundary results
        if (testData.tangentialBoundaries.length > 0) {
            csv += this.generateTangentialBoundarySection(testData.tangentialBoundaries);
            csv += "\n";
        }

        // Raw measurements
        if (includeRawData && testData.measurements.length > 0) {
            csv += this.generateMeasurementsSection(testData.measurements);
            csv += "\n";
        }

        // Event log
        if (includeEventLog && testData.eventLog.length > 0) {
            csv += this.generateEventLogSection(testData.eventLog);
        }

        return csv;
    }

    /**
     * Get all test data from database
     */
    private static async getTestData(testId: number): Promise<any> {
        // Get test info
        const testQuery = `
            SELECT 
                t.*,
                tc.test_name as test_choice_name,
                tc.test_standard,
                tc.test_method,
                tc.test_lab,
                s.name as sensor_name,
                s.manufacturer,
                s.product_reference,
                s.description,
                s.hw_version,
                s.sw_version,
                s.mounting_height,
                s.note as sensor_notes
            FROM test t
            LEFT JOIN test_choice tc ON t.test_choice = tc.test_choice_id
            LEFT JOIN sensor s ON t.sensor_id = s.sensor_id
            WHERE t.test_id = $1
        `;
        const testResult = await pool.query(testQuery, [testId]);
        const test = testResult.rows[0];

        // Get measurements
        const measurementsQuery = `
            SELECT * FROM test_measurement
            WHERE test_id = $1
            ORDER BY measured_at ASC
        `;
        const measurementsResult = await pool.query(measurementsQuery, [testId]);

        // Get radial boundaries
        const radialQuery = `
            SELECT * FROM radial_boundary
            WHERE test_id = $1
            ORDER BY measured_at ASC
        `;
        const radialResult = await pool.query(radialQuery, [testId]);

        // Get tangential boundaries
        const tangentialQuery = `
            SELECT * FROM tangential_boundary
            WHERE test_id = $1
            ORDER BY angle ASC
        `;
        const tangentialResult = await pool.query(tangentialQuery, [testId]);

        // Get event log
        const eventLogQuery = `
            SELECT * FROM test_event_log
            WHERE test_id = $1
            ORDER BY created_at ASC
        `;
        const eventLogResult = await pool.query(eventLogQuery, [testId]);

        return {
            test,
            measurements: measurementsResult.rows,
            radialBoundaries: radialResult.rows,
            tangentialBoundaries: tangentialResult.rows,
            eventLog: eventLogResult.rows
        };
    }

    /**
     * Generate header section
     */
    private static generateHeaderSection(testData: any): string {
        const test = testData.test;
        let csv = "";

        csv += "PIR SENSOR PERFORMANCE TEST REPORT\n";
        csv += "\n";
        csv += "TEST INFORMATION\n";
        csv += `Test Name,${this.escapeCSV(test.test_name)}\n`;
        csv += `Test ID,${test.test_id}\n`;
        csv += `Test Date,${this.formatDate(test.test_date)}\n`;
        csv += `Test Status,${test.status}\n`;
        csv += `Duration,${this.calculateDuration(test.started_at, test.completed_at)}\n`;
        csv += "\n";
        csv += "TEST STANDARD\n";
        csv += `Standard,${this.escapeCSV(test.test_standard || "N/A")}\n`;
        csv += `Test Method,${this.escapeCSV(test.test_method || "N/A")}\n`;
        csv += `Test Lab,${this.escapeCSV(test.test_lab || "N/A")}\n`;
        csv += "\n";
        csv += "SENSOR INFORMATION\n";
        csv += `Sensor Name,${this.escapeCSV(test.sensor_name)}\n`;
        csv += `Manufacturer,${this.escapeCSV(test.manufacturer)}\n`;
        csv += `Product Reference,${this.escapeCSV(test.product_reference || "N/A")}\n`;
        csv += `Description,${this.escapeCSV(test.description || "N/A")}\n`;
        csv += `HW Version,${this.escapeCSV(test.hw_version || "N/A")}\n`;
        csv += `SW Version,${this.escapeCSV(test.sw_version || "N/A")}\n`;
        csv += `Mounting Height,${test.mounting_height} m\n`;
        csv += `Notes,${this.escapeCSV(test.sensor_notes || "N/A")}\n`;

        return csv;
    }

    /**
     * Generate radial boundary section
     */
    private static generateRadialBoundarySection(radialBoundaries: any[]): string {
        let csv = "";
        
        csv += "\n";
        csv += "RADIAL BOUNDARY TEST RESULTS\n";
        csv += "Distance (m),Measurement 1,Measurement 2,Average,Verdict,Retry Count,Measured At\n";

        radialBoundaries.forEach((row) => {
            csv += `${row.measurement1_2 || ""},`;
            csv += `${row.measurement2_2 || ""},`;
            csv += `${row.radial_detection1_avg || ""},`;
            csv += `${row.verdict1 || ""},`;
            csv += `${row.retry_count || 0},`;
            csv += `${this.formatDateTime(row.measured_at)}\n`;
        });

        return csv;
    }

    /**
     * Generate tangential boundary section
     */
    private static generateTangentialBoundarySection(tangentialBoundaries: any[]): string {
        let csv = "";
        
        csv += "\n";
        csv += "TANGENTIAL BOUNDARY TEST RESULTS\n";
        csv += "Angle (°),Distance 2m,Verdict 2m,Distance 3m,Verdict 3m,Retry Count,Measured At\n";

        tangentialBoundaries.forEach((row) => {
            csv += `${row.angle},`;
            csv += `${row.measurement2m || ""},`;
            csv += `${row.verdict2m || ""},`;
            csv += `${row.measurement3m || ""},`;
            csv += `${row.verdict3m || ""},`;
            csv += `${row.retry_count || 0},`;
            csv += `${this.formatDateTime(row.measurement_time)}\n`;
        });

        return csv;
    }

    /**
     * Generate measurements section
     */
    private static generateMeasurementsSection(measurements: any[]): string {
        let csv = "";
        
        csv += "\n";
        csv += "DETAILED MEASUREMENTS\n";
        csv += "Measurement ID,Test Type,Angle,Distance,X,Y,Result,Detected,Attempt,Measured At\n";

        measurements.forEach((row) => {
            csv += `${row.measurement_id},`;
            csv += `${row.test_type},`;
            csv += `${row.angle || ""},`;
            csv += `${row.distance_m || ""},`;
            csv += `${row.x_coord || ""},`;
            csv += `${row.y_coord || ""},`;
            csv += `${row.result},`;
            csv += `${row.detected ? "Yes" : "No"},`;
            csv += `${row.attempt_number},`;
            csv += `${this.formatDateTime(row.measured_at)}\n`;
        });

        return csv;
    }

    /**
     * Generate event log section
     */
    private static generateEventLogSection(eventLog: any[]): string {
        let csv = "";
        
        csv += "\n";
        csv += "EVENT LOG\n";
        csv += "Event ID,Event Type,Data,Timestamp\n";

        eventLog.forEach((row) => {
            csv += `${row.event_id},`;
            csv += `${this.escapeCSV(row.event_type)},`;
            csv += `${this.escapeCSV(JSON.stringify(row.event_data))},`;
            csv += `${this.formatDateTime(row.created_at)}\n`;
        });

        return csv;
    }

    /**
     * Escape CSV values
     */
    private static escapeCSV(value: string): string {
        if (value == null) return "";
        
        const stringValue = String(value);
        
        // If value contains comma, quote, or newline, wrap in quotes and escape quotes
        if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
            return `"${stringValue.replace(/"/g, '""')}"`;
        }
        
        return stringValue;
    }

    /**
     * Format date
     */
    private static formatDate(date: Date | string): string {
        if (!date) return "N/A";
        const d = new Date(date);
        return d.toISOString().split("T")[0];
    }

    /**
     * Format date and time
     */
    private static formatDateTime(date: Date | string): string {
        if (!date) return "N/A";
        const d = new Date(date);
        return d.toISOString().replace("T", " ").substring(0, 19);
    }

    /**
     * Calculate duration between two timestamps
     */
    private static calculateDuration(start: Date | string, end: Date | string): string {
        if (!start || !end) return "N/A";
        
        const startTime = new Date(start).getTime();
        const endTime = new Date(end).getTime();
        const durationMs = endTime - startTime;
        
        const hours = Math.floor(durationMs / (1000 * 60 * 60));
        const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);
        
        return `${hours}h ${minutes}m ${seconds}s`;
    }

    /**
     * Generate summary statistics CSV
     */
    static async generateSummaryStatisticsCSV(testId: number): string {
        const statsQuery = `
            WITH detection_stats AS (
                SELECT 
                    test_type,
                    COUNT(*) as total_measurements,
                    SUM(CASE WHEN detected THEN 1 ELSE 0 END) as successful_detections,
                    AVG(attempt_number) as avg_attempts,
                    AVG(detection_delay_ms) as avg_delay_ms
                FROM test_measurement
                WHERE test_id = $1
                GROUP BY test_type
            )
            SELECT * FROM detection_stats
        `;

        const result = await pool.query(statsQuery, [testId]);
        
        let csv = "SUMMARY STATISTICS\n";
        csv += "Test Type,Total Measurements,Successful Detections,Success Rate (%),Avg Attempts,Avg Delay (ms)\n";

        result.rows.forEach((row) => {
            const successRate = (row.successful_detections / row.total_measurements * 100).toFixed(2);
            csv += `${row.test_type},`;
            csv += `${row.total_measurements},`;
            csv += `${row.successful_detections},`;
            csv += `${successRate},`;
            csv += `${Number(row.avg_attempts).toFixed(2)},`;
            csv += `${row.avg_delay_ms ? Number(row.avg_delay_ms).toFixed(0) : "N/A"}\n`;
        });

        return csv;
    }
}

export default CSVExportService;
