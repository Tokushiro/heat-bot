/**
 * IEC Export Service
 *
 * Generates IEC-compliant CSV exports for different test types.
 * Provides template-based formatters matching Excel templates for:
 * - Boundary Detection Tests
 * - Grid Tangential Tests
 * - Radial Polar Tests
 */

interface TestMetadata {
    testId: number;
    testName: string;
    testType: string;
    startTime: Date;
    endTime: Date;
    detectorId?: string;
    testEnvironment?: {
        temperature: number;
        humidity: number;
    };
}

interface BoundaryTestData {
    angle: number;
    distance: number;
    detected: boolean;
    timestamp: Date;
    attempts: number;
}

interface GridTestData {
    cellRow: number;
    cellCol: number;
    centerX: number;
    centerY: number;
    detected: boolean;
    attempts: number;
    coveragePercent: number;
    anglesCovered: number[];
}

interface RadialTestData {
    angle: number;
    distance: number;
    detected: boolean;
    timestamp: Date;
    repeatNumber: number;
}

/**
 * IEC Export Service
 */
export class IECExportService {
    /**
     * Export boundary detection test to IEC-compliant CSV
     */
    static exportBoundaryTest(
        metadata: TestMetadata,
        data: BoundaryTestData[]
    ): string {
        const lines: string[] = [];

        // Header section
        lines.push('=== IEC BOUNDARY DETECTION TEST REPORT ===');
        lines.push('');
        lines.push(`Test ID:,${metadata.testId}`);
        lines.push(`Test Name:,${metadata.testName}`);
        lines.push(`Test Type:,${metadata.testType}`);
        lines.push(`Detector ID:,${metadata.detectorId || 'N/A'}`);
        lines.push('');
        lines.push(`Start Time:,${metadata.startTime.toISOString()}`);
        lines.push(`End Time:,${metadata.endTime.toISOString()}`);
        lines.push(`Duration:,${this.calculateDuration(metadata.startTime, metadata.endTime)}`);
        lines.push('');

        // Environmental conditions
        if (metadata.testEnvironment) {
            lines.push('=== ENVIRONMENTAL CONDITIONS ===');
            lines.push(`Temperature:,${metadata.testEnvironment.temperature.toFixed(1)} °C`);
            lines.push(`Humidity:,${metadata.testEnvironment.humidity.toFixed(1)} % RH`);
            lines.push('');
        }

        // Test parameters
        lines.push('=== TEST PARAMETERS ===');
        lines.push('Movement Type:,Tangential');
        lines.push('Movement Speed:,0.5 m/s');
        lines.push(`Angle Step:,${this.inferAngleStep(data)}°`);
        lines.push('');

        // Summary statistics
        const summary = this.calculateBoundarySummary(data);
        lines.push('=== TEST SUMMARY ===');
        lines.push(`Total Measurements:,${data.length}`);
        lines.push(`Average Boundary:,${summary.avgDistance.toFixed(3)} m`);
        lines.push(`Min Distance:,${summary.minDistance.toFixed(3)} m`);
        lines.push(`Max Distance:,${summary.maxDistance.toFixed(3)} m`);
        lines.push(`Standard Deviation:,${summary.stdDev.toFixed(3)} m`);
        lines.push('');

        // Measurement data table
        lines.push('=== BOUNDARY MEASUREMENTS ===');
        lines.push('Angle (°),Distance (m),Detected,Timestamp,Attempts,Radial Distance');
        lines.push('');

        // Group by angle and average
        const angleGroups = this.groupByAngle(data);
        Object.keys(angleGroups).sort((a, b) => Number(a) - Number(b)).forEach((angleKey: string) => {
            const angle = Number(angleKey);
            const measurements = angleGroups[angle];
            const avgDistance = measurements
                .filter((m: BoundaryTestData) => m.detected)
                .reduce((sum: number, m: BoundaryTestData) => sum + m.distance, 0) / measurements.filter((m: BoundaryTestData) => m.detected).length;

            measurements.forEach((m: BoundaryTestData) => {
                lines.push(
                    `${m.angle},${m.distance.toFixed(3)},${m.detected ? 'YES' : 'NO'},` +
                    `${m.timestamp.toISOString()},${m.attempts},${avgDistance.toFixed(3)}`
                );
            });
        });

        lines.push('');

        // Angular analysis
        lines.push('=== ANGULAR ANALYSIS ===');
        lines.push('Angle (°),Avg Distance (m),Detection Count,Success Rate (%)');

        Object.keys(angleGroups).sort((a, b) => Number(a) - Number(b)).forEach((angleKey: string) => {
            const angle = Number(angleKey);
            const measurements = angleGroups[angle];
            const detectedMeasurements = measurements.filter((m: BoundaryTestData) => m.detected);
            const avgDistance = detectedMeasurements.length > 0
                ? detectedMeasurements.reduce((sum: number, m: BoundaryTestData) => sum + m.distance, 0) / detectedMeasurements.length
                : 0;
            const successRate = (detectedMeasurements.length / measurements.length) * 100;

            lines.push(
                `${angle},${avgDistance.toFixed(3)},${detectedMeasurements.length},${successRate.toFixed(1)}`
            );
        });

        lines.push('');
        lines.push('=== END OF REPORT ===');

        return lines.join('\n');
    }

    /**
     * Export grid tangential test to IEC-compliant CSV
     */
    static exportGridTest(
        metadata: TestMetadata,
        data: GridTestData[],
        gridConfig: { width: number; height: number; cellSize: number }
    ): string {
        const lines: string[] = [];

        // Header section
        lines.push('=== IEC GRID TANGENTIAL TEST REPORT ===');
        lines.push('');
        lines.push(`Test ID:,${metadata.testId}`);
        lines.push(`Test Name:,${metadata.testName}`);
        lines.push(`Test Type:,${metadata.testType}`);
        lines.push(`Detector ID:,${metadata.detectorId || 'N/A'}`);
        lines.push('');
        lines.push(`Start Time:,${metadata.startTime.toISOString()}`);
        lines.push(`End Time:,${metadata.endTime.toISOString()}`);
        lines.push(`Duration:,${this.calculateDuration(metadata.startTime, metadata.endTime)}`);
        lines.push('');

        // Environmental conditions
        if (metadata.testEnvironment) {
            lines.push('=== ENVIRONMENTAL CONDITIONS ===');
            lines.push(`Temperature:,${metadata.testEnvironment.temperature.toFixed(1)} °C`);
            lines.push(`Humidity:,${metadata.testEnvironment.humidity.toFixed(1)} % RH`);
            lines.push('');
        }

        // Grid parameters
        lines.push('=== GRID PARAMETERS ===');
        lines.push(`Grid Width:,${gridConfig.width} m`);
        lines.push(`Grid Height:,${gridConfig.height} m`);
        lines.push(`Cell Size:,${gridConfig.cellSize} m × ${gridConfig.cellSize} m`);
        lines.push(`Total Cells:,${data.length}`);
        lines.push('');

        // Summary statistics
        const summary = this.calculateGridSummary(data);
        lines.push('=== TEST SUMMARY ===');
        lines.push(`Cells Passed:,${summary.passed}`);
        lines.push(`Cells Failed:,${summary.failed}`);
        lines.push(`Success Rate:,${summary.successRate.toFixed(1)} %`);
        lines.push(`Average Coverage:,${summary.avgCoverage.toFixed(1)} %`);
        lines.push('');

        // Cell results table
        lines.push('=== CELL RESULTS ===');
        lines.push('Row,Col,Center X (m),Center Y (m),Detected,Attempts,Coverage (%),Status');
        lines.push('');

        // Sort by row and column
        data.sort((a, b) => {
            if (a.cellRow !== b.cellRow) return a.cellRow - b.cellRow;
            return a.cellCol - b.cellCol;
        });

        data.forEach(cell => {
            lines.push(
                `${cell.cellRow},${cell.cellCol},${cell.centerX.toFixed(2)},${cell.centerY.toFixed(2)},` +
                `${cell.detected ? 'YES' : 'NO'},${cell.attempts},${cell.coveragePercent.toFixed(1)},` +
                `${cell.coveragePercent >= 80 ? 'PASS' : 'FAIL'}`
            );
        });

        lines.push('');

        // Coverage map
        lines.push('=== COVERAGE MAP ===');
        const coverageMap = this.createCoverageMap(data, gridConfig);
        lines.push(coverageMap);

        lines.push('');
        lines.push('=== END OF REPORT ===');

        return lines.join('\n');
    }

    /**
     * Export radial polar test to IEC-compliant CSV
     */
    static exportRadialTest(
        metadata: TestMetadata,
        data: RadialTestData[]
    ): string {
        const lines: string[] = [];

        // Header section
        lines.push('=== IEC RADIAL POLAR TEST REPORT ===');
        lines.push('');
        lines.push(`Test ID:,${metadata.testId}`);
        lines.push(`Test Name:,${metadata.testName}`);
        lines.push(`Test Type:,${metadata.testType}`);
        lines.push(`Detector ID:,${metadata.detectorId || 'N/A'}`);
        lines.push('');
        lines.push(`Start Time:,${metadata.startTime.toISOString()}`);
        lines.push(`End Time:,${metadata.endTime.toISOString()}`);
        lines.push(`Duration:,${this.calculateDuration(metadata.startTime, metadata.endTime)}`);
        lines.push('');

        // Environmental conditions
        if (metadata.testEnvironment) {
            lines.push('=== ENVIRONMENTAL CONDITIONS ===');
            lines.push(`Temperature:,${metadata.testEnvironment.temperature.toFixed(1)} °C`);
            lines.push(`Humidity:,${metadata.testEnvironment.humidity.toFixed(1)} % RH`);
            lines.push('');
        }

        // Test parameters
        lines.push('=== TEST PARAMETERS ===');
        lines.push('Movement Type:,Radial');
        lines.push('Movement Speed:,0.5 m/s');
        lines.push(`Angle Step:,${this.inferAngleStep(data)}°`);
        lines.push(`Distance Step:,${this.inferDistanceStep(data)} m`);
        lines.push('');

        // Summary statistics
        const summary = this.calculateRadialSummary(data);
        lines.push('=== TEST SUMMARY ===');
        lines.push(`Total Measurements:,${data.length}`);
        lines.push(`Angles Tested:,${summary.uniqueAngles}`);
        lines.push(`Distances Tested:,${summary.uniqueDistances}`);
        lines.push(`Average Detection Range:,${summary.avgRange.toFixed(3)} m`);
        lines.push(`Max Range:,${summary.maxRange.toFixed(3)} m`);
        lines.push(`Min Range:,${summary.minRange.toFixed(3)} m`);
        lines.push('');

        // Measurement data table
        lines.push('=== RADIAL MEASUREMENTS ===');
        lines.push('Angle (°),Distance (m),Detected,Timestamp,Repeat #,Detection Range');
        lines.push('');

        // Group by angle
        const angleGroups = this.groupByAngle(data);
        Object.keys(angleGroups).sort((a, b) => Number(a) - Number(b)).forEach((angleKey: string) => {
            const angle = Number(angleKey);
            const measurements = angleGroups[angle];

            // Find detection range for this angle
            const detectedDistances = measurements.filter((m: RadialTestData) => m.detected).map((m: RadialTestData) => m.distance);
            const maxDetectedDistance = detectedDistances.length > 0 ? Math.max(...detectedDistances) : 0;

            measurements.forEach((m: RadialTestData) => {
                lines.push(
                    `${m.angle},${m.distance.toFixed(3)},${m.detected ? 'YES' : 'NO'},` +
                    `${m.timestamp.toISOString()},${m.repeatNumber},${maxDetectedDistance.toFixed(3)}`
                );
            });
        });

        lines.push('');

        // Angular range analysis
        lines.push('=== ANGULAR RANGE ANALYSIS ===');
        lines.push('Angle (°),Detection Range (m),Measurements,Detection Rate (%)');

        Object.keys(angleGroups).sort((a, b) => Number(a) - Number(b)).forEach((angleKey: string) => {
            const angle = Number(angleKey);
            const measurements = angleGroups[angle];
            const detectedMeasurements = measurements.filter((m: RadialTestData) => m.detected);
            const maxRange = detectedMeasurements.length > 0
                ? Math.max(...detectedMeasurements.map((m: RadialTestData) => m.distance))
                : 0;
            const detectionRate = (detectedMeasurements.length / measurements.length) * 100;

            lines.push(
                `${angle},${maxRange.toFixed(3)},${measurements.length},${detectionRate.toFixed(1)}`
            );
        });

        lines.push('');
        lines.push('=== END OF REPORT ===');

        return lines.join('\n');
    }

    // Helper methods

    private static calculateDuration(start: Date, end: Date): string {
        const durationMs = end.getTime() - start.getTime();
        const hours = Math.floor(durationMs / (1000 * 60 * 60));
        const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);

        return `${hours}h ${minutes}m ${seconds}s`;
    }

    private static groupByAngle<T extends { angle: number }>(data: T[]): Record<number, T[]> {
        return data.reduce((groups: Record<number, T[]>, item: T) => {
            const angle = item.angle;
            if (!groups[angle]) {
                groups[angle] = [];
            }
            groups[angle].push(item);
            return groups;
        }, {} as Record<number, T[]>);
    }

    private static inferAngleStep(data: { angle: number }[]): number {
        if (data.length < 2) return 10;

        const sortedAngles = [...new Set(data.map(d => d.angle))].sort((a, b) => a - b);
        if (sortedAngles.length < 2) return 10;

        return sortedAngles[1] - sortedAngles[0];
    }

    private static inferDistanceStep(data: { distance: number }[]): number {
        if (data.length < 2) return 0.5;

        const sortedDistances = [...new Set(data.map(d => d.distance))].sort((a, b) => a - b);
        if (sortedDistances.length < 2) return 0.5;

        return parseFloat((sortedDistances[1] - sortedDistances[0]).toFixed(2));
    }

    private static calculateBoundarySummary(data: BoundaryTestData[]) {
        const detectedData = data.filter(d => d.detected);
        const distances = detectedData.map(d => d.distance);

        const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
        const minDistance = Math.min(...distances);
        const maxDistance = Math.max(...distances);

        // Calculate standard deviation
        const variance = distances.reduce((sum, d) => sum + Math.pow(d - avgDistance, 2), 0) / distances.length;
        const stdDev = Math.sqrt(variance);

        return { avgDistance, minDistance, maxDistance, stdDev };
    }

    private static calculateGridSummary(data: GridTestData[]) {
        const passed = data.filter(cell => cell.coveragePercent >= 80).length;
        const failed = data.length - passed;
        const successRate = (passed / data.length) * 100;
        const avgCoverage = data.reduce((sum, cell) => sum + cell.coveragePercent, 0) / data.length;

        return { passed, failed, successRate, avgCoverage };
    }

    private static calculateRadialSummary(data: RadialTestData[]) {
        const uniqueAngles = [...new Set(data.map(d => d.angle))].length;
        const uniqueDistances = [...new Set(data.map(d => d.distance))].length;

        // Calculate detection range per angle
        const angleGroups = this.groupByAngle(data);
        const ranges: number[] = [];

        Object.keys(angleGroups).forEach((angleKey: string) => {
            const angle = Number(angleKey);
            const measurements = angleGroups[angle];
            const detectedDistances = measurements.filter((m: RadialTestData) => m.detected).map((m: RadialTestData) => m.distance);
            if (detectedDistances.length > 0) {
                ranges.push(Math.max(...detectedDistances));
            }
        });

        const avgRange = ranges.reduce((sum, r) => sum + r, 0) / ranges.length;
        const maxRange = Math.max(...ranges);
        const minRange = Math.min(...ranges);

        return { uniqueAngles, uniqueDistances, avgRange, maxRange, minRange };
    }

    private static createCoverageMap(
        data: GridTestData[],
        gridConfig: { width: number; height: number; cellSize: number }
    ): string {
        const rows = Math.ceil(gridConfig.height / gridConfig.cellSize);
        const cols = Math.ceil(gridConfig.width / gridConfig.cellSize);

        // Create 2D array
        const map: string[][] = Array(rows).fill(null).map(() => Array(cols).fill('-'));

        // Fill map with coverage percentages
        data.forEach(cell => {
            if (cell.cellRow < rows && cell.cellCol < cols) {
                map[cell.cellRow][cell.cellCol] = cell.coveragePercent.toFixed(0);
            }
        });

        // Convert to CSV format
        const lines: string[] = [];
        lines.push(',' + Array.from({ length: cols }, (_, i) => `Col ${i}`).join(','));

        map.forEach((row, rowIndex) => {
            lines.push(`Row ${rowIndex},` + row.join(','));
        });

        return lines.join('\n');
    }
}
