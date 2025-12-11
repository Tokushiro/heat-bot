import React, { useEffect, useRef, useState } from 'react';
import '../Styles/PolarPlot.css';

/**
 * Polar Plot Component
 *
 * Displays detector coverage data in polar coordinates (angle vs. distance).
 * Features:
 * - Circular plot with angle (0-360°) and distance axes
 * - Detection events plotted as points
 * - Optional detection zone overlay
 * - Gridlines for angle and distance
 * - Interactive tooltips
 * - Real-time data updates
 *
 * Use cases:
 * - Visualize detector field of view
 * - Show detection pattern at different angles
 * - Compare measured detection boundary with theoretical boundary
 * - Identify angular variations in sensitivity
 */

interface PolarDataPoint {
    angle: number;       // Angle in degrees (0-360)
    distance: number;    // Distance in meters
    detected: boolean;   // Whether detection occurred
    metadata?: {
        timestamp?: Date;
        temperature?: number;
        humidity?: number;
    };
}

interface PolarPlotProps {
    data: PolarDataPoint[];
    maxDistance?: number;          // Maximum distance for plot (default 4m)
    showGrid?: boolean;            // Show angle/distance gridlines
    showIdealBoundary?: boolean;   // Show theoretical detection boundary
    idealBoundaryDistance?: number; // Distance for ideal boundary
    width?: number;                // Canvas width in pixels
    height?: number;               // Canvas height in pixels
    title?: string;                // Plot title
    onPointHover?: (point: PolarDataPoint | null) => void;
}

const PolarPlot: React.FC<PolarPlotProps> = ({
    data,
    maxDistance = 4,
    showGrid = true,
    showIdealBoundary = false,
    idealBoundaryDistance = 3,
    width = 600,
    height = 600,
    title = 'Detector Coverage - Polar Plot',
    onPointHover
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [hoveredPoint, setHoveredPoint] = useState<PolarDataPoint | null>(null);
    const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);

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
     * Convert canvas coordinates to polar coordinates
     * (Currently unused but kept for future interactive features)
     */
    // const canvasToPolar = (
    //     canvasX: number,
    //     canvasY: number,
    //     centerX: number,
    //     centerY: number,
    //     scale: number
    // ): { angle: number; distance: number } => {
    //     const dx = canvasX - centerX;
    //     const dy = canvasY - centerY;

    //     const distance = Math.sqrt(dx * dx + dy * dy) / scale;
    //     let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;

    //     if (angle < 0) {
    //         angle += 360;
    //     }

    //     return { angle, distance };
    // };

    /**
     * Draw the polar plot
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
        const maxRadius = Math.min(width, height) * 0.4;
        const scale = maxRadius / maxDistance;

        // Draw background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        // Draw gridlines
        if (showGrid) {
            drawGrid(ctx, centerX, centerY, maxRadius, scale);
        }

        // Draw ideal boundary
        if (showIdealBoundary) {
            drawIdealBoundary(ctx, centerX, centerY, idealBoundaryDistance, scale);
        }

        // Draw data points
        drawDataPoints(ctx, centerX, centerY, scale);

        // Draw center point
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 5, 0, 2 * Math.PI);
        ctx.fill();

        // Draw hovered point highlight
        if (hoveredPoint) {
            const { x, y } = polarToCanvas(
                hoveredPoint.angle,
                hoveredPoint.distance,
                centerX,
                centerY,
                scale
            );

            ctx.strokeStyle = '#2196f3';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, 2 * Math.PI);
            ctx.stroke();
        }
    };

    /**
     * Draw grid lines (circles for distance, lines for angle)
     */
    const drawGrid = (
        ctx: CanvasRenderingContext2D,
        centerX: number,
        centerY: number,
        _maxRadius: number,
        scale: number
    ) => {
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;

        // Distance circles
        const distanceSteps = Math.ceil(maxDistance);
        for (let i = 1; i <= distanceSteps; i++) {
            const radius = i * scale;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.stroke();

            // Distance labels
            ctx.fillStyle = '#999';
            ctx.font = '12px Arial';
            ctx.fillText(`${i}m`, centerX + 5, centerY - radius + 5);
        }

        // Angle lines (every 30°)
        for (let angle = 0; angle < 360; angle += 30) {
            const { x, y } = polarToCanvas(angle, maxDistance, centerX, centerY, scale);

            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(x, y);
            ctx.stroke();

            // Angle labels
            const labelPos = polarToCanvas(angle, maxDistance + 0.3, centerX, centerY, scale);
            ctx.fillStyle = '#666';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${angle}°`, labelPos.x, labelPos.y);
        }
    };

    /**
     * Draw ideal boundary circle
     */
    const drawIdealBoundary = (
        ctx: CanvasRenderingContext2D,
        centerX: number,
        centerY: number,
        distance: number,
        scale: number
    ) => {
        ctx.strokeStyle = '#4caf50';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);

        ctx.beginPath();
        ctx.arc(centerX, centerY, distance * scale, 0, 2 * Math.PI);
        ctx.stroke();

        ctx.setLineDash([]);
    };

    /**
     * Draw data points
     */
    const drawDataPoints = (
        ctx: CanvasRenderingContext2D,
        centerX: number,
        centerY: number,
        scale: number
    ) => {
        data.forEach((point) => {
            const { x, y } = polarToCanvas(point.angle, point.distance, centerX, centerY, scale);

            // Draw point
            ctx.fillStyle = point.detected ? '#4caf50' : '#f44336';
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.fill();

            // Draw outline
            ctx.strokeStyle = point.detected ? '#2e7d32' : '#c62828';
            ctx.lineWidth = 1;
            ctx.stroke();
        });
    };

    /**
     * Handle mouse move
     */
    const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        setMousePosition({ x: mouseX, y: mouseY });

        // Find closest point
        const centerX = width / 2;
        const centerY = height / 2;
        const maxRadius = Math.min(width, height) * 0.4;
        const scale = maxRadius / maxDistance;

        let closestPoint: PolarDataPoint | null = null;
        let closestDistance = Infinity;

        data.forEach((point) => {
            const { x, y } = polarToCanvas(point.angle, point.distance, centerX, centerY, scale);
            const distance = Math.sqrt((mouseX - x) ** 2 + (mouseY - y) ** 2);

            if (distance < 10 && distance < closestDistance) {
                closestPoint = point;
                closestDistance = distance;
            }
        });

        setHoveredPoint(closestPoint);

        if (onPointHover) {
            onPointHover(closestPoint);
        }
    };

    /**
     * Handle mouse leave
     */
    const handleMouseLeave = () => {
        setHoveredPoint(null);
        setMousePosition(null);

        if (onPointHover) {
            onPointHover(null);
        }
    };

    /**
     * Redraw when data changes
     */
    useEffect(() => {
        drawPlot();
    }, [data, maxDistance, showGrid, showIdealBoundary, idealBoundaryDistance, hoveredPoint]);

    return (
        <div className="polar-plot">
            <div className="polar-plot-header">
                <h3>{title}</h3>
                <div className="polar-plot-legend">
                    <div className="legend-item">
                        <div className="legend-marker detected"></div>
                        <span>Detected</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-marker not-detected"></div>
                        <span>Not Detected</span>
                    </div>
                    {showIdealBoundary && (
                        <div className="legend-item">
                            <div className="legend-marker ideal-boundary"></div>
                            <span>Ideal Boundary</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="polar-plot-canvas-container">
                <canvas
                    ref={canvasRef}
                    width={width}
                    height={height}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                    className="polar-plot-canvas"
                />

                {/* Tooltip */}
                {hoveredPoint && mousePosition && (
                    <div
                        className="polar-plot-tooltip"
                        style={{
                            left: mousePosition.x + 10,
                            top: mousePosition.y + 10
                        }}
                    >
                        <div className="tooltip-row">
                            <span className="tooltip-label">Angle:</span>
                            <span className="tooltip-value">{hoveredPoint.angle.toFixed(1)}°</span>
                        </div>
                        <div className="tooltip-row">
                            <span className="tooltip-label">Distance:</span>
                            <span className="tooltip-value">{hoveredPoint.distance.toFixed(2)}m</span>
                        </div>
                        <div className="tooltip-row">
                            <span className="tooltip-label">Status:</span>
                            <span className={`tooltip-value ${hoveredPoint.detected ? 'detected' : 'not-detected'}`}>
                                {hoveredPoint.detected ? 'Detected' : 'Not Detected'}
                            </span>
                        </div>
                        {hoveredPoint.metadata?.temperature && (
                            <div className="tooltip-row">
                                <span className="tooltip-label">Temp:</span>
                                <span className="tooltip-value">
                                    {hoveredPoint.metadata.temperature.toFixed(1)}°C
                                </span>
                            </div>
                        )}
                        {hoveredPoint.metadata?.humidity && (
                            <div className="tooltip-row">
                                <span className="tooltip-label">Humidity:</span>
                                <span className="tooltip-value">
                                    {hoveredPoint.metadata.humidity.toFixed(1)}% RH
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Statistics */}
            <div className="polar-plot-stats">
                <div className="stat-item">
                    <span className="stat-label">Total Points:</span>
                    <span className="stat-value">{data.length}</span>
                </div>
                <div className="stat-item">
                    <span className="stat-label">Detected:</span>
                    <span className="stat-value">{data.filter(p => p.detected).length}</span>
                </div>
                <div className="stat-item">
                    <span className="stat-label">Not Detected:</span>
                    <span className="stat-value">{data.filter(p => !p.detected).length}</span>
                </div>
                <div className="stat-item">
                    <span className="stat-label">Detection Rate:</span>
                    <span className="stat-value">
                        {data.length > 0
                            ? ((data.filter(p => p.detected).length / data.length) * 100).toFixed(1)
                            : 0}%
                    </span>
                </div>
            </div>
        </div>
    );
};

export default PolarPlot;
