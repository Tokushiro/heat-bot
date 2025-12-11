import React, { useState, useEffect } from 'react';
import '../Styles/GridVisualization.css';

/**
 * Grid Visualization Component
 *
 * Displays grid-based detector coverage test results.
 * Features:
 * - Color-coded cells (green = passed, red = failed, gray = pending)
 * - Coverage percentage display
 * - Real-time progress updates
 * - Cell selection to view detailed results
 * - Test configuration display
 */

interface GridPosition {
    x: number;
    y: number;
    cellX: number;
    cellY: number;
}

interface GridCellResult {
    position: GridPosition;
    testId: number;
    startTime: Date;
    endTime?: Date;
    detectionCount: number;
    anglesCovered: number[];
    coveragePercent: number;
    avgTemperature?: number;
    avgHumidity?: number;
    completed: boolean;
    passed: boolean;
    error?: string;
}

interface GridTestConfig {
    gridWidth: number;
    gridHeight: number;
    cellSize: number;
    angleStep: number;
    dwellTime: number;
    coverageThreshold: number;
    testId: number;
}

interface GridTestProgress {
    totalCells: number;
    completedCells: number;
    currentCell?: GridPosition;
    currentAngle?: number;
    percentComplete: number;
    estimatedTimeRemaining?: number;
    status: 'idle' | 'initializing' | 'running' | 'paused' | 'completed' | 'error';
}

interface GridTestResult {
    testId: number;
    config: GridTestConfig;
    cells: GridCellResult[];
    totalDetections: number;
    averageCoverage: number;
    cellsPassed: number;
    cellsFailed: number;
    coverageMap: number[][];
    startTime: Date;
    endTime: Date;
    totalDuration: number;
    completed: boolean;
    passed: boolean;
}

interface GridVisualizationProps {
    testId?: number;
    autoRefresh?: boolean;
    refreshInterval?: number;
}

const GridVisualization: React.FC<GridVisualizationProps> = ({
    testId,
    autoRefresh = false,
    refreshInterval = 2000
}) => {
    const [testResult, setTestResult] = useState<GridTestResult | null>(null);
    const [progress, setProgress] = useState<GridTestProgress | null>(null);
    const [selectedCell, setSelectedCell] = useState<GridCellResult | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

    /**
     * Fetch test result
     */
    const fetchTestResult = async () => {
        if (!testId) {
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`${API_BASE}/api/gridtest/result/${testId}`);

            if (!response.ok) {
                throw new Error('Failed to fetch test result');
            }

            const data = await response.json();
            setTestResult(data);
        } catch (err) {
            console.error('Error fetching test result:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    /**
     * Fetch test progress
     */
    const fetchProgress = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/gridtest/progress`);

            if (!response.ok) {
                throw new Error('Failed to fetch progress');
            }

            const data = await response.json();
            setProgress(data);
        } catch (err) {
            console.error('Error fetching progress:', err);
        }
    };

    /**
     * Initialize and set up auto-refresh
     */
    useEffect(() => {
        fetchTestResult();

        if (autoRefresh) {
            const interval = setInterval(() => {
                fetchTestResult();
                fetchProgress();
            }, refreshInterval);

            return () => clearInterval(interval);
        }
    }, [testId, autoRefresh, refreshInterval]);

    /**
     * Get cell color based on status
     */
    const getCellColor = (cell: GridCellResult | null, isCurrentCell: boolean): string => {
        if (!cell) {
            return 'var(--cell-pending)';
        }

        if (isCurrentCell) {
            return 'var(--cell-current)';
        }

        if (!cell.completed) {
            return 'var(--cell-pending)';
        }

        if (cell.passed) {
            return 'var(--cell-passed)';
        }

        return 'var(--cell-failed)';
    };

    /**
     * Handle cell click
     */
    const handleCellClick = (cell: GridCellResult) => {
        setSelectedCell(cell);
    };

    /**
     * Format duration
     */
    const formatDuration = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        }

        if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        }

        return `${secs}s`;
    };

    /**
     * Render loading state
     */
    if (loading && !testResult) {
        return (
            <div className="grid-visualization loading">
                <div className="loading-spinner"></div>
                <p>Loading test results...</p>
            </div>
        );
    }

    /**
     * Render error state
     */
    if (error) {
        return (
            <div className="grid-visualization error">
                <div className="error-icon">⚠️</div>
                <p>Error: {error}</p>
                <button onClick={fetchTestResult}>Retry</button>
            </div>
        );
    }

    /**
     * Render no data state
     */
    if (!testResult) {
        return (
            <div className="grid-visualization no-data">
                <p>No test data available</p>
                {testId && <p>Test ID: {testId}</p>}
            </div>
        );
    }

    const { config, cells, coverageMap } = testResult;
    const cellsX = coverageMap[0]?.length || 0;
    const cellsY = coverageMap.length || 0;

    return (
        <div className="grid-visualization">
            <div className="grid-header">
                <h2>Grid Coverage Test - ID {testResult.testId}</h2>

                {/* Test Status */}
                <div className="test-status">
                    <div className={`status-badge ${testResult.passed ? 'passed' : 'failed'}`}>
                        {testResult.passed ? '✓ Passed' : '✗ Failed'}
                    </div>
                    <div className="status-info">
                        <span>Coverage: {testResult.averageCoverage.toFixed(1)}%</span>
                        <span>Cells: {testResult.cellsPassed}/{cells.length}</span>
                        <span>Duration: {formatDuration(testResult.totalDuration)}</span>
                    </div>
                </div>

                {/* Progress Bar (if test is running) */}
                {progress && progress.status === 'running' && (
                    <div className="progress-section">
                        <div className="progress-bar">
                            <div
                                className="progress-fill"
                                style={{ width: `${progress.percentComplete}%` }}
                            ></div>
                        </div>
                        <div className="progress-text">
                            <span>{progress.completedCells}/{progress.totalCells} cells</span>
                            <span>{progress.percentComplete.toFixed(1)}% complete</span>
                            {progress.estimatedTimeRemaining && (
                                <span>ETA: {formatDuration(progress.estimatedTimeRemaining)}</span>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="grid-content">
                {/* Grid Display */}
                <div className="grid-container">
                    <div
                        className="grid"
                        style={{
                            gridTemplateColumns: `repeat(${cellsX}, 1fr)`,
                            gridTemplateRows: `repeat(${cellsY}, 1fr)`
                        }}
                    >
                        {coverageMap.map((row, rowIndex) =>
                            row.map((coverage, colIndex) => {
                                const cell = cells.find(
                                    c => c.position.cellX === colIndex && c.position.cellY === rowIndex
                                );

                                const isCurrentCell =
                                    progress?.currentCell?.cellX === colIndex &&
                                    progress?.currentCell?.cellY === rowIndex;

                                const color = getCellColor(cell || null, isCurrentCell);

                                return (
                                    <div
                                        key={`${rowIndex}-${colIndex}`}
                                        className={`grid-cell ${selectedCell === cell ? 'selected' : ''}`}
                                        style={{ backgroundColor: color }}
                                        onClick={() => cell && handleCellClick(cell)}
                                        title={`Cell (${colIndex}, ${rowIndex}): ${coverage.toFixed(1)}%`}
                                    >
                                        <div className="cell-label">
                                            {cell ? `${coverage.toFixed(0)}%` : '-'}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Legend */}
                    <div className="grid-legend">
                        <div className="legend-item">
                            <div className="legend-color" style={{ backgroundColor: 'var(--cell-passed)' }}></div>
                            <span>Passed (≥{config.coverageThreshold}%)</span>
                        </div>
                        <div className="legend-item">
                            <div className="legend-color" style={{ backgroundColor: 'var(--cell-failed)' }}></div>
                            <span>Failed (&lt;{config.coverageThreshold}%)</span>
                        </div>
                        <div className="legend-item">
                            <div className="legend-color" style={{ backgroundColor: 'var(--cell-pending)' }}></div>
                            <span>Pending</span>
                        </div>
                        <div className="legend-item">
                            <div className="legend-color" style={{ backgroundColor: 'var(--cell-current)' }}></div>
                            <span>Current</span>
                        </div>
                    </div>
                </div>

                {/* Cell Details Panel */}
                <div className="cell-details-panel">
                    <h3>Cell Details</h3>

                    {selectedCell ? (
                        <div className="cell-details">
                            <div className="detail-group">
                                <h4>Position</h4>
                                <p>X: {selectedCell.position.x.toFixed(2)}m</p>
                                <p>Y: {selectedCell.position.y.toFixed(2)}m</p>
                                <p>Cell: ({selectedCell.position.cellX}, {selectedCell.position.cellY})</p>
                            </div>

                            <div className="detail-group">
                                <h4>Coverage</h4>
                                <p className={selectedCell.passed ? 'passed' : 'failed'}>
                                    {selectedCell.coveragePercent.toFixed(1)}% {selectedCell.passed ? '✓' : '✗'}
                                </p>
                                <p>Detections: {selectedCell.detectionCount}</p>
                                <p>Angles tested: {selectedCell.anglesCovered.length}</p>
                            </div>

                            {(selectedCell.avgTemperature || selectedCell.avgHumidity) && (
                                <div className="detail-group">
                                    <h4>Environment</h4>
                                    {selectedCell.avgTemperature && (
                                        <p>Temperature: {selectedCell.avgTemperature.toFixed(1)}°C</p>
                                    )}
                                    {selectedCell.avgHumidity && (
                                        <p>Humidity: {selectedCell.avgHumidity.toFixed(1)}% RH</p>
                                    )}
                                </div>
                            )}

                            <div className="detail-group">
                                <h4>Timing</h4>
                                <p>Start: {new Date(selectedCell.startTime).toLocaleTimeString()}</p>
                                {selectedCell.endTime && (
                                    <p>End: {new Date(selectedCell.endTime).toLocaleTimeString()}</p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <p className="no-selection">Click a cell to view details</p>
                    )}
                </div>
            </div>

            {/* Configuration Summary */}
            <div className="config-summary">
                <h3>Test Configuration</h3>
                <div className="config-grid">
                    <div className="config-item">
                        <span className="config-label">Grid Size:</span>
                        <span className="config-value">{config.gridWidth}m × {config.gridHeight}m</span>
                    </div>
                    <div className="config-item">
                        <span className="config-label">Cell Size:</span>
                        <span className="config-value">{config.cellSize}m</span>
                    </div>
                    <div className="config-item">
                        <span className="config-label">Angle Step:</span>
                        <span className="config-value">{config.angleStep}°</span>
                    </div>
                    <div className="config-item">
                        <span className="config-label">Dwell Time:</span>
                        <span className="config-value">{config.dwellTime}ms</span>
                    </div>
                    <div className="config-item">
                        <span className="config-label">Threshold:</span>
                        <span className="config-value">{config.coverageThreshold}%</span>
                    </div>
                    <div className="config-item">
                        <span className="config-label">Total Detections:</span>
                        <span className="config-value">{testResult.totalDetections}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GridVisualization;
