import React, { useEffect, useRef } from 'react';
import '../Styles/BoundaryComparisonPlot.css';

/**
 * Boundary Comparison Plot
 *
 * Overlays ideal boundary (pink circle) with measured boundary (green line).
 * Shows deviations between theoretical and actual detection boundaries.
 *
 * Use cases:
 * - Compare measured detector boundary with specification
 * - Identify angular variations in detection range
 * - Visualize boundary shape irregularities
 * - Quality control and validation
 */

interface BoundaryPoint {
    angle: number;      // Angle in degrees (0-360)
    distance: number;   // Measured distance in meters
}

interface BoundaryComparisonPlotProps {
    idealBoundary: number;               // Theoretical radius in meters
    measuredBoundary: BoundaryPoint[];   // Actual measurements
    width?: number;                      // Canvas width
    height?: number;                     // Canvas height
    title?: string;                      // Plot title
}

const BoundaryComparisonPlot: React.FC<BoundaryComparisonPlotProps> = ({
    idealBoundary,
    measuredBoundary,
    width = 600,
    height = 600,
    title = 'Boundary Comparison - Ideal vs Measured'
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    /**
     * Convert polar coordinates to canvas coordinates
     */
    const polarToCanvas = (
        angle: number,
        distance: number,
        centerX: number,
        centerY: number,
        scale: number
    ): { x: number; y: number } => {
        // Convert angle to radians (0° = up, clockwise)
        const angleRad = ((angle - 90) * Math.PI) / 180;

        const x = centerX + distance * scale * Math.cos(angleRad);
        const y = centerY + distance * scale * Math.sin(angleRad);

        return { x, y };
    };

    /**
     * Draw the plot
     */
    const drawPlot = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Calculate plot parameters
        const centerX = width / 2;
        const centerY = height / 2;
        const maxDistance = Math.max(idealBoundary, ...measuredBoundary.map(p => p.distance)) * 1.2;
        const maxRadius = Math.min(width, height) * 0.4;
        const scale = maxRadius / maxDistance;

        // Draw background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        // Draw grid circles
        drawGrid(ctx, centerX, centerY, maxDistance, scale);

        // Draw ideal boundary (pink circle)
        drawIdealBoundary(ctx, centerX, centerY, idealBoundary, scale);

        // Draw measured boundary (green line)
        drawMeasuredBoundary(ctx, centerX, centerY, measuredBoundary, scale);

        // Draw center point
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 6, 0, 2 * Math.PI);
        ctx.fill();

        // Draw statistics
        drawStatistics(ctx, idealBoundary, measuredBoundary);
    };

    /**
     * Draw grid circles and angle lines
     */
    const drawGrid = (
        ctx: CanvasRenderingContext2D,
        centerX: number,
        centerY: number,
        maxDistance: number,
        scale: number
    ) => {
        ctx.strokeStyle = '#f0f0f0';
        ctx.lineWidth = 1;

        // Distance circles
        const distanceSteps = Math.ceil(maxDistance);
        for (let i = 1; i <= distanceSteps; i++) {
            const radius = i * scale;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.stroke();

            // Distance labels
            ctx.fillStyle = '#ccc';
            ctx.font = '11px Arial';
            ctx.fillText(`${i}m`, centerX + 5, centerY - radius + 5);
        }

        // Angle lines (every 30°)
        ctx.strokeStyle = '#f5f5f5';
        for (let angle = 0; angle < 360; angle += 30) {
            const { x, y } = polarToCanvas(angle, maxDistance, centerX, centerY, scale);

            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(x, y);
            ctx.stroke();

            // Angle labels
            if (angle % 90 === 0) {
                const labelPos = polarToCanvas(angle, maxDistance * 1.05, centerX, centerY, scale);
                ctx.fillStyle = '#999';
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`${angle}°`, labelPos.x, labelPos.y);
            }
        }
    };

    /**
     * Draw ideal boundary (pink circle)
     */
    const drawIdealBoundary = (
        ctx: CanvasRenderingContext2D,
        centerX: number,
        centerY: number,
        radius: number,
        scale: number
    ) => {
        ctx.strokeStyle = '#ff69b4';  // Pink
        ctx.lineWidth = 3;
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * scale, 0, 2 * Math.PI);
        ctx.stroke();

        // Label
        ctx.fillStyle = '#ff69b4';
        ctx.font = 'bold 13px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(
            `Ideal: ${radius.toFixed(2)}m`,
            centerX,
            centerY - (radius * scale) - 15
        );
    };

    /**
     * Draw measured boundary (green line)
     */
    const drawMeasuredBoundary = (
        ctx: CanvasRenderingContext2D,
        centerX: number,
        centerY: number,
        measurements: BoundaryPoint[],
        scale: number
    ) => {
        if (measurements.length === 0) return;

        // Sort measurements by angle
        const sortedMeasurements = [...measurements].sort((a, b) => a.angle - b.angle);

        // Draw connecting line
        ctx.strokeStyle = '#4caf50';  // Green
        ctx.lineWidth = 2;
        ctx.setLineDash([]);

        ctx.beginPath();

        sortedMeasurements.forEach((point, index) => {
            const { x, y } = polarToCanvas(point.angle, point.distance, centerX, centerY, scale);

            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        // Close the path
        if (sortedMeasurements.length > 0) {
            const first = sortedMeasurements[0];
            const { x, y } = polarToCanvas(first.angle, first.distance, centerX, centerY, scale);
            ctx.lineTo(x, y);
        }

        ctx.stroke();

        // Draw measurement points
        ctx.fillStyle = '#2e7d32';  // Dark green
        sortedMeasurements.forEach((point) => {
            const { x, y } = polarToCanvas(point.angle, point.distance, centerX, centerY, scale);

            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.fill();
        });

        // Draw deviation lines (from ideal to measured)
        ctx.strokeStyle = 'rgba(255, 152, 0, 0.3)';  // Orange with transparency
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);

        sortedMeasurements.forEach((point) => {
            const idealPoint = polarToCanvas(point.angle, idealBoundary, centerX, centerY, scale);
            const measuredPoint = polarToCanvas(point.angle, point.distance, centerX, centerY, scale);

            ctx.beginPath();
            ctx.moveTo(idealPoint.x, idealPoint.y);
            ctx.lineTo(measuredPoint.x, measuredPoint.y);
            ctx.stroke();
        });
    };

    /**
     * Draw statistics
     */
    const drawStatistics = (
        ctx: CanvasRenderingContext2D,
        idealRadius: number,
        measurements: BoundaryPoint[]
    ) => {
        if (measurements.length === 0) return;

        // Calculate statistics
        const distances = measurements.map(p => p.distance);
        const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
        const minDistance = Math.min(...distances);
        const maxDistance = Math.max(...distances);
        const deviations = measurements.map(p => Math.abs(p.distance - idealRadius));
        const avgDeviation = deviations.reduce((sum, d) => sum + d, 0) / deviations.length;
        const maxDeviation = Math.max(...deviations);

        // Draw statistics box
        const boxX = 10;
        const boxY = 10;
        const boxWidth = 200;
        const boxHeight = 150;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1;
        ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

        ctx.fillStyle = '#333';
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';

        const lineHeight = 20;
        let currentY = boxY + 20;

        ctx.font = 'bold 13px Arial';
        ctx.fillText('Boundary Statistics:', boxX + 10, currentY);
        currentY += lineHeight + 5;

        ctx.font = '12px Arial';
        ctx.fillText(`Avg Distance: ${avgDistance.toFixed(2)}m`, boxX + 10, currentY);
        currentY += lineHeight;

        ctx.fillText(`Min: ${minDistance.toFixed(2)}m  Max: ${maxDistance.toFixed(2)}m`, boxX + 10, currentY);
        currentY += lineHeight;

        ctx.fillText(`Avg Deviation: ${avgDeviation.toFixed(2)}m`, boxX + 10, currentY);
        currentY += lineHeight;

        ctx.fillText(`Max Deviation: ${maxDeviation.toFixed(2)}m`, boxX + 10, currentY);
        currentY += lineHeight;

        ctx.fillText(`Points: ${measurements.length}`, boxX + 10, currentY);
    };

    /**
     * Redraw when data changes
     */
    useEffect(() => {
        drawPlot();
    }, [idealBoundary, measuredBoundary]);

    return (
        <div className="boundary-comparison-plot">
            <div className="plot-header">
                <h3>{title}</h3>
                <div className="plot-legend">
                    <div className="legend-item">
                        <div className="legend-line ideal"></div>
                        <span>Ideal Boundary</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-line measured"></div>
                        <span>Measured Boundary</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-line deviation"></div>
                        <span>Deviation</span>
                    </div>
                </div>
            </div>

            <canvas
                ref={canvasRef}
                width={width}
                height={height}
                className="boundary-canvas"
            />
        </div>
    );
};

export default BoundaryComparisonPlot;
