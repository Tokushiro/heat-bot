import React, { useRef, useEffect, useState } from "react";
import { Card, Typography, Row, Col } from "antd";
import "../Styles/GridHeatmap.css";

const { Title, Text } = Typography;

export interface GridCellData {
    x: number;
    y: number;
    row: number;
    col: number;
    detected: boolean;
    angle: number;
    distance: number;
}

export interface GridHeatmapProps {
    data: GridCellData[];
    cellSize?: number;        // meters (default 0.5)
    maxRadius?: number;       // meters (default 6)
    width?: number;           // pixels (default 600)
    height?: number;          // pixels (default 600)
}

export const GridHeatmap: React.FC<GridHeatmapProps> = ({
    data,
    cellSize = 0.5,
    maxRadius = 6,
    width = 600,
    height = 600
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [hoveredCell, setHoveredCell] = useState<GridCellData | null>(null);
    const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

    // Calculate canvas parameters
    const padding = 50;
    const chartWidth = width - (padding * 2);
    const chartHeight = height - (padding * 2);
    const centerX = padding + chartWidth / 2;
    const centerY = padding + chartHeight / 2;
    const scale = Math.min(chartWidth, chartHeight) / (maxRadius * 2);

    // Convert world coordinates (meters) to canvas coordinates (pixels)
    const worldToCanvas = (x: number, y: number): { cx: number; cy: number } => {
        return {
            cx: centerX + (x * scale),
            cy: centerY - (y * scale) // Invert Y for canvas
        };
    };

    // Convert canvas coordinates to world coordinates
    const canvasToWorld = (cx: number, cy: number): { x: number; y: number } => {
        return {
            x: (cx - centerX) / scale,
            y: -(cy - centerY) / scale
        };
    };

    // Find cell at given canvas position
    const findCellAtPosition = (canvasX: number, canvasY: number): GridCellData | null => {
        const { x, y } = canvasToWorld(canvasX, canvasY);

        // Find closest cell
        let closest: GridCellData | null = null;
        let minDist = Infinity;

        for (const cell of data) {
            const dist = Math.sqrt(Math.pow(cell.x - x, 2) + Math.pow(cell.y - y, 2));
            if (dist < minDist && dist < cellSize) {
                minDist = dist;
                closest = cell;
            }
        }

        return closest;
    };

    // Draw the heatmap
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = "#f0f0f0";
        ctx.fillRect(0, 0, width, height);

        // Draw grid lines
        ctx.strokeStyle = "#ddd";
        ctx.lineWidth = 1;

        // Vertical grid lines
        for (let x = -maxRadius; x <= maxRadius; x += cellSize) {
            const { cx } = worldToCanvas(x, 0);
            ctx.beginPath();
            ctx.moveTo(cx, padding);
            ctx.lineTo(cx, height - padding);
            ctx.stroke();
        }

        // Horizontal grid lines
        for (let y = -maxRadius; y <= maxRadius; y += cellSize) {
            const { cy } = worldToCanvas(0, y);
            ctx.beginPath();
            ctx.moveTo(padding, cy);
            ctx.lineTo(width - padding, cy);
            ctx.stroke();
        }

        // Draw axes
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;

        // X-axis
        ctx.beginPath();
        ctx.moveTo(padding, centerY);
        ctx.lineTo(width - padding, centerY);
        ctx.stroke();

        // Y-axis
        ctx.beginPath();
        ctx.moveTo(centerX, padding);
        ctx.lineTo(centerX, height - padding);
        ctx.stroke();

        // Draw axis labels
        ctx.fillStyle = "#000";
        ctx.font = "12px Arial";
        ctx.textAlign = "center";

        // X-axis labels
        for (let x = -maxRadius; x <= maxRadius; x += 1) {
            if (x === 0) continue;
            const { cx } = worldToCanvas(x, 0);
            ctx.fillText(`${x}m`, cx, centerY + 20);
        }

        // Y-axis labels
        ctx.textAlign = "right";
        for (let y = -maxRadius; y <= maxRadius; y += 1) {
            if (y === 0) continue;
            const { cy } = worldToCanvas(0, y);
            ctx.fillText(`${y}m`, centerX - 10, cy + 4);
        }

        // Draw origin marker
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.arc(centerX, centerY, 4, 0, 2 * Math.PI);
        ctx.fill();

        // Draw sensor icon (at origin)
        ctx.fillStyle = "#ff6b6b";
        ctx.font = "16px Arial";
        ctx.textAlign = "center";
        ctx.fillText("S", centerX, centerY - 10);

        // Draw cells
        for (const cell of data) {
            const { cx, cy } = worldToCanvas(cell.x, cell.y);
            const pixelSize = cellSize * scale;

            // Set color based on detection
            if (cell.detected) {
                ctx.fillStyle = "rgba(76, 175, 80, 0.7)"; // Green
            } else {
                ctx.fillStyle = "rgba(244, 67, 54, 0.7)"; // Red
            }

            // Draw cell rectangle
            ctx.fillRect(
                cx - pixelSize / 2,
                cy - pixelSize / 2,
                pixelSize,
                pixelSize
            );

            // Draw cell border
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 1;
            ctx.strokeRect(
                cx - pixelSize / 2,
                cy - pixelSize / 2,
                pixelSize,
                pixelSize
            );
        }

        // Highlight hovered cell
        if (hoveredCell) {
            const { cx, cy } = worldToCanvas(hoveredCell.x, hoveredCell.y);
            const pixelSize = cellSize * scale;

            ctx.strokeStyle = "#2196F3";
            ctx.lineWidth = 3;
            ctx.strokeRect(
                cx - pixelSize / 2,
                cy - pixelSize / 2,
                pixelSize,
                pixelSize
            );
        }

    }, [data, cellSize, maxRadius, width, height, centerX, centerY, scale, hoveredCell, padding]);

    // Handle mouse move for hover
    const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const canvasX = event.clientX - rect.left;
        const canvasY = event.clientY - rect.top;

        const cell = findCellAtPosition(canvasX, canvasY);
        setHoveredCell(cell);

        if (cell) {
            setTooltipPos({
                x: event.clientX,
                y: event.clientY
            });
        } else {
            setTooltipPos(null);
        }
    };

    const handleMouseLeave = () => {
        setHoveredCell(null);
        setTooltipPos(null);
    };

    // Calculate statistics
    const totalCells = data.length;
    const detectedCount = data.filter(c => c.detected).length;
    const detectionRate = totalCells > 0 ? (detectedCount / totalCells * 100) : 0;

    return (
        <Card className="grid-heatmap-container">
            <div className="grid-heatmap-header">
                <Title level={4}>Tangential Test Grid Heatmap</Title>
                <Text type="secondary">
                    2D Cartesian grid showing detected (green) and not detected (red) cells
                </Text>
            </div>

            <div className="grid-heatmap-legend">
                <Row gutter={16}>
                    <Col>
                        <span className="legend-marker legend-detected"></span>
                        <Text>Detected</Text>
                    </Col>
                    <Col>
                        <span className="legend-marker legend-not-detected"></span>
                        <Text>Not Detected</Text>
                    </Col>
                    <Col>
                        <span className="legend-marker legend-sensor"></span>
                        <Text>Sensor (Origin)</Text>
                    </Col>
                </Row>
            </div>

            <div className="grid-heatmap-canvas-wrapper">
                <canvas
                    ref={canvasRef}
                    width={width}
                    height={height}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                    className="grid-heatmap-canvas"
                />
                {tooltipPos && hoveredCell && (
                    <div
                        className="grid-heatmap-tooltip"
                        style={{
                            left: tooltipPos.x + 10,
                            top: tooltipPos.y + 10
                        }}
                    >
                        <div><strong>Position:</strong> ({hoveredCell.x.toFixed(2)}m, {hoveredCell.y.toFixed(2)}m)</div>
                        <div><strong>Grid:</strong> Row {hoveredCell.row}, Col {hoveredCell.col}</div>
                        <div><strong>Angle:</strong> {hoveredCell.angle.toFixed(1)}°</div>
                        <div><strong>Distance:</strong> {hoveredCell.distance.toFixed(2)}m</div>
                        <div><strong>Detection:</strong> {hoveredCell.detected ? 'YES' : 'NO'}</div>
                    </div>
                )}
            </div>

            <div className="grid-heatmap-stats">
                <Row gutter={16} justify="center">
                    <Col>
                        <Text strong>Total Cells:</Text> {totalCells}
                    </Col>
                    <Col>
                        <Text strong>Detected:</Text> {detectedCount}
                    </Col>
                    <Col>
                        <Text strong>Not Detected:</Text> {totalCells - detectedCount}
                    </Col>
                    <Col>
                        <Text strong>Detection Rate:</Text> {detectionRate.toFixed(1)}%
                    </Col>
                </Row>
            </div>
        </Card>
    );
};

export default GridHeatmap;
