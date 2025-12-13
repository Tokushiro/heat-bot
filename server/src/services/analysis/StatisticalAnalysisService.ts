/**
 * Statistical Analysis Service
 *
 * Provides advanced statistical analysis for test data including:
 * - Detection probability analysis
 * - Multi-test comparison
 * - Trend analysis
 * - Confidence intervals
 * - Outlier detection
 * - Correlation analysis
 */

interface TestData {
    testId: number;
    testName: string;
    testType: string;
    startTime: Date;
    endTime: Date;
}

interface BoundaryMeasurement {
    angle: number;
    distance: number;
    detected: boolean;
    timestamp: Date;
}

interface AngularStatistics {
    angle: number;
    avgDistance: number;
    stdDev: number;
    minDistance: number;
    maxDistance: number;
    detectionRate: number;
    measurementCount: number;
    confidenceInterval95: { lower: number; upper: number };
}

interface DetectionProbabilityAnalysis {
    distanceRange: { min: number; max: number };
    probabilityCurve: Array<{ distance: number; probability: number }>;
    detectionThreshold: number; // 50% detection point
    optimalRange: { start: number; end: number }; // >90% detection
}

interface TestComparison {
    test1: TestData;
    test2: TestData;
    boundaryDifference: {
        avgDifference: number;
        maxDifference: number;
        correlationCoefficient: number;
        significantDifferences: Array<{ angle: number; difference: number }>;
    };
    performanceMetrics: {
        test1Duration: number;
        test2Duration: number;
        test1DetectionRate: number;
        test2DetectionRate: number;
    };
}

interface TrendAnalysis {
    testIds: number[];
    testDates: Date[];
    avgBoundaryTrend: Array<{ date: Date; avgBoundary: number }>;
    detectionRateTrend: Array<{ date: Date; detectionRate: number }>;
    durationTrend: Array<{ date: Date; durationMinutes: number }>;
    trendDirection: 'IMPROVING' | 'DECLINING' | 'STABLE';
    recommendations: string[];
}

export class StatisticalAnalysisService {

    /**
     * Calculate comprehensive angular statistics
     */
    static calculateAngularStatistics(measurements: BoundaryMeasurement[]): AngularStatistics[] {
        // Group by angle
        const angleGroups = this.groupByAngle(measurements);
        const results: AngularStatistics[] = [];

        Object.keys(angleGroups).forEach(angleKey => {
            const angle = Number(angleKey);
            const angleMeasurements = angleGroups[angle];
            const detectedMeasurements = angleMeasurements.filter(m => m.detected);
            const distances = detectedMeasurements.map(m => m.distance);

            if (distances.length === 0) {
                results.push({
                    angle,
                    avgDistance: 0,
                    stdDev: 0,
                    minDistance: 0,
                    maxDistance: 0,
                    detectionRate: 0,
                    measurementCount: angleMeasurements.length,
                    confidenceInterval95: { lower: 0, upper: 0 }
                });
                return;
            }

            // Calculate statistics
            const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
            const variance = distances.reduce((sum, d) => sum + Math.pow(d - avgDistance, 2), 0) / distances.length;
            const stdDev = Math.sqrt(variance);
            const minDistance = Math.min(...distances);
            const maxDistance = Math.max(...distances);
            const detectionRate = detectedMeasurements.length / angleMeasurements.length;

            // 95% confidence interval (assuming normal distribution)
            const standardError = stdDev / Math.sqrt(distances.length);
            const marginOfError = 1.96 * standardError; // z-score for 95% CI
            const confidenceInterval95 = {
                lower: avgDistance - marginOfError,
                upper: avgDistance + marginOfError
            };

            results.push({
                angle,
                avgDistance,
                stdDev,
                minDistance,
                maxDistance,
                detectionRate,
                measurementCount: angleMeasurements.length,
                confidenceInterval95
            });
        });

        return results.sort((a, b) => a.angle - b.angle);
    }

    /**
     * Analyze detection probability vs distance
     */
    static analyzeDetectionProbability(measurements: BoundaryMeasurement[]): DetectionProbabilityAnalysis {
        // Group by distance bins (0.5m intervals)
        const binSize = 0.5;
        const bins: Map<number, { total: number; detected: number }> = new Map();

        measurements.forEach(m => {
            const binKey = Math.floor(m.distance / binSize) * binSize;
            const bin = bins.get(binKey) || { total: 0, detected: 0 };
            bin.total++;
            if (m.detected) bin.detected++;
            bins.set(binKey, bin);
        });

        // Calculate probability curve
        const probabilityCurve: Array<{ distance: number; probability: number }> = [];
        let detectionThreshold = 0;
        let optimalStart = 0;
        let optimalEnd = 0;
        let foundOptimalStart = false;

        Array.from(bins.entries())
            .sort((a, b) => a[0] - b[0])
            .forEach(([distance, stats]) => {
                const probability = stats.detected / stats.total;
                probabilityCurve.push({ distance, probability });

                // Find 50% detection threshold
                if (probability >= 0.5 && detectionThreshold === 0) {
                    detectionThreshold = distance;
                }

                // Find optimal range (>90% detection)
                if (probability >= 0.9 && !foundOptimalStart) {
                    optimalStart = distance;
                    foundOptimalStart = true;
                }
                if (probability >= 0.9) {
                    optimalEnd = distance;
                }
            });

        const distances = measurements.map(m => m.distance);
        return {
            distanceRange: {
                min: Math.min(...distances),
                max: Math.max(...distances)
            },
            probabilityCurve,
            detectionThreshold,
            optimalRange: { start: optimalStart, end: optimalEnd }
        };
    }

    /**
     * Compare two tests
     */
    static compareTests(
        test1: TestData,
        measurements1: BoundaryMeasurement[],
        test2: TestData,
        measurements2: BoundaryMeasurement[]
    ): TestComparison {
        // Calculate average boundaries at matching angles
        const angles1 = this.groupByAngle(measurements1);
        const angles2 = this.groupByAngle(measurements2);

        const commonAngles = Object.keys(angles1).filter(angle => angles2[Number(angle)]);
        const differences: number[] = [];
        const significantDifferences: Array<{ angle: number; difference: number }> = [];

        commonAngles.forEach(angleKey => {
            const angle = Number(angleKey);
            const avg1 = this.calculateAvgDistance(angles1[angle]);
            const avg2 = this.calculateAvgDistance(angles2[angle]);
            const difference = Math.abs(avg1 - avg2);
            differences.push(difference);

            // Significant if difference > 0.5m
            if (difference > 0.5) {
                significantDifferences.push({ angle, difference });
            }
        });

        const avgDifference = differences.reduce((sum, d) => sum + d, 0) / differences.length;
        const maxDifference = Math.max(...differences);

        // Calculate correlation coefficient
        const correlationCoefficient = this.calculateCorrelation(
            commonAngles.map(a => this.calculateAvgDistance(angles1[Number(a)])),
            commonAngles.map(a => this.calculateAvgDistance(angles2[Number(a)]))
        );

        // Performance metrics
        const test1Duration = (test1.endTime.getTime() - test1.startTime.getTime()) / 1000 / 60; // minutes
        const test2Duration = (test2.endTime.getTime() - test2.startTime.getTime()) / 1000 / 60;
        const test1DetectionRate = measurements1.filter(m => m.detected).length / measurements1.length;
        const test2DetectionRate = measurements2.filter(m => m.detected).length / measurements2.length;

        return {
            test1,
            test2,
            boundaryDifference: {
                avgDifference,
                maxDifference,
                correlationCoefficient,
                significantDifferences
            },
            performanceMetrics: {
                test1Duration,
                test2Duration,
                test1DetectionRate,
                test2DetectionRate
            }
        };
    }

    /**
     * Analyze trends across multiple tests
     */
    static analyzeTrends(
        tests: TestData[],
        allMeasurements: Map<number, BoundaryMeasurement[]>
    ): TrendAnalysis {
        // Sort by date
        const sortedTests = tests.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

        // Calculate trends
        const avgBoundaryTrend: Array<{ date: Date; avgBoundary: number }> = [];
        const detectionRateTrend: Array<{ date: Date; detectionRate: number }> = [];
        const durationTrend: Array<{ date: Date; durationMinutes: number }> = [];

        sortedTests.forEach(test => {
            const measurements = allMeasurements.get(test.testId) || [];
            const detectedMeasurements = measurements.filter(m => m.detected);
            const distances = detectedMeasurements.map(m => m.distance);
            const avgBoundary = distances.length > 0
                ? distances.reduce((sum, d) => sum + d, 0) / distances.length
                : 0;
            const detectionRate = measurements.length > 0
                ? detectedMeasurements.length / measurements.length
                : 0;
            const durationMinutes = (test.endTime.getTime() - test.startTime.getTime()) / 1000 / 60;

            avgBoundaryTrend.push({ date: test.startTime, avgBoundary });
            detectionRateTrend.push({ date: test.startTime, detectionRate });
            durationTrend.push({ date: test.startTime, durationMinutes });
        });

        // Determine trend direction (simple linear regression slope)
        const detectionRateSlope = this.calculateTrendSlope(
            detectionRateTrend.map((_, i) => i),
            detectionRateTrend.map(d => d.detectionRate)
        );

        let trendDirection: 'IMPROVING' | 'DECLINING' | 'STABLE' = 'STABLE';
        if (detectionRateSlope > 0.01) trendDirection = 'IMPROVING';
        if (detectionRateSlope < -0.01) trendDirection = 'DECLINING';

        // Generate recommendations
        const recommendations: string[] = [];
        const avgDetectionRate = detectionRateTrend.reduce((sum, d) => sum + d.detectionRate, 0) / detectionRateTrend.length;

        if (avgDetectionRate < 0.8) {
            recommendations.push('Average detection rate is below 80%. Consider recalibrating sensor or checking environmental conditions.');
        }
        if (trendDirection === 'DECLINING') {
            recommendations.push('Detection performance is declining over time. Check sensor battery, heating zones, or environmental factors.');
        }
        if (trendDirection === 'IMPROVING') {
            recommendations.push('Detection performance is improving. Current test configuration appears optimal.');
        }

        const avgDuration = durationTrend.reduce((sum, d) => sum + d.durationMinutes, 0) / durationTrend.length;
        if (avgDuration > 60) {
            recommendations.push('Average test duration exceeds 60 minutes. Consider optimizing angle steps or reducing repeat measurements.');
        }

        return {
            testIds: sortedTests.map(t => t.testId),
            testDates: sortedTests.map(t => t.startTime),
            avgBoundaryTrend,
            detectionRateTrend,
            durationTrend,
            trendDirection,
            recommendations
        };
    }

    /**
     * Detect outliers using IQR method
     */
    static detectOutliers(measurements: BoundaryMeasurement[]): {
        outliers: BoundaryMeasurement[];
        outlierAngles: number[];
        outlierCount: number;
        outlierPercentage: number;
    } {
        const distances = measurements.filter(m => m.detected).map(m => m.distance);
        if (distances.length === 0) {
            return { outliers: [], outlierAngles: [], outlierCount: 0, outlierPercentage: 0 };
        }

        // Calculate IQR
        const sorted = distances.slice().sort((a, b) => a - b);
        const q1Index = Math.floor(sorted.length * 0.25);
        const q3Index = Math.floor(sorted.length * 0.75);
        const q1 = sorted[q1Index];
        const q3 = sorted[q3Index];
        const iqr = q3 - q1;

        // Outlier bounds
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;

        // Find outliers
        const outliers = measurements.filter(m =>
            m.detected && (m.distance < lowerBound || m.distance > upperBound)
        );

        const outlierAngles = [...new Set(outliers.map(m => m.angle))].sort((a, b) => a - b);

        return {
            outliers,
            outlierAngles,
            outlierCount: outliers.length,
            outlierPercentage: (outliers.length / measurements.length) * 100
        };
    }

    // Helper methods

    private static groupByAngle(measurements: BoundaryMeasurement[]): Record<number, BoundaryMeasurement[]> {
        return measurements.reduce((groups, m) => {
            if (!groups[m.angle]) groups[m.angle] = [];
            groups[m.angle].push(m);
            return groups;
        }, {} as Record<number, BoundaryMeasurement[]>);
    }

    private static calculateAvgDistance(measurements: BoundaryMeasurement[]): number {
        const detected = measurements.filter(m => m.detected);
        if (detected.length === 0) return 0;
        return detected.reduce((sum, m) => sum + m.distance, 0) / detected.length;
    }

    private static calculateCorrelation(x: number[], y: number[]): number {
        if (x.length !== y.length || x.length === 0) return 0;

        const n = x.length;
        const meanX = x.reduce((sum, val) => sum + val, 0) / n;
        const meanY = y.reduce((sum, val) => sum + val, 0) / n;

        let numerator = 0;
        let denomX = 0;
        let denomY = 0;

        for (let i = 0; i < n; i++) {
            const diffX = x[i] - meanX;
            const diffY = y[i] - meanY;
            numerator += diffX * diffY;
            denomX += diffX * diffX;
            denomY += diffY * diffY;
        }

        const denom = Math.sqrt(denomX * denomY);
        return denom === 0 ? 0 : numerator / denom;
    }

    private static calculateTrendSlope(x: number[], y: number[]): number {
        if (x.length !== y.length || x.length < 2) return 0;

        const n = x.length;
        const meanX = x.reduce((sum, val) => sum + val, 0) / n;
        const meanY = y.reduce((sum, val) => sum + val, 0) / n;

        let numerator = 0;
        let denominator = 0;

        for (let i = 0; i < n; i++) {
            numerator += (x[i] - meanX) * (y[i] - meanY);
            denominator += (x[i] - meanX) * (x[i] - meanX);
        }

        return denominator === 0 ? 0 : numerator / denominator;
    }
}
