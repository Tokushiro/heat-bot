/**
 * Grid Test API Interface
 *
 * Manages grid-based movement testing for detector coverage analysis.
 * Tests are conducted on a 0.5m × 0.5m grid overlaid on the detector's detection area.
 *
 * Test Area Specifications:
 * - Grid cell size: 0.5m × 0.5m
 * - Typical test area: 3m × 3m (36 cells)
 * - Coordinate system: Cartesian (x, y) with center at (0, 0)
 * - Stand rotation: 0-360° for each grid position
 *
 * Testing Process:
 * 1. Define grid dimensions and cell size
 * 2. Generate grid positions
 * 3. Move detector to each grid cell sequentially
 * 4. At each position, rotate stand through full 360°
 * 5. Record detection events and telemetry
 * 6. Analyze coverage and create visualization
 */

/**
 * Grid position in Cartesian coordinates
 */
export interface GridPosition {
    x: number;           // X coordinate in meters
    y: number;           // Y coordinate in meters
    cellX: number;       // Cell index in X direction
    cellY: number;       // Cell index in Y direction
}

/**
 * Grid cell test result
 */
export interface GridCellResult {
    position: GridPosition;
    testId: number;                  // Associated test ID
    startTime: Date;
    endTime?: Date;

    // Detection results
    detectionCount: number;          // Total detections at this cell
    anglesCovered: number[];         // Stand angles where detection occurred
    coveragePercent: number;         // Percentage of angles with detection

    // Environmental conditions
    avgTemperature?: number;         // Average temperature during test
    avgHumidity?: number;            // Average humidity during test

    // Status
    completed: boolean;
    passed: boolean;                 // True if coverage meets threshold
    error?: string;
}

/**
 * Grid test configuration
 */
export interface GridTestConfig {
    // Grid dimensions
    gridWidth: number;               // Width in meters
    gridHeight: number;              // Height in meters
    cellSize: number;                // Cell size in meters (default 0.5)

    // Test parameters
    angleStep: number;               // Stand rotation step in degrees (default 10)
    dwellTime: number;               // Time to wait at each angle in ms (default 2000)
    coverageThreshold: number;       // Required coverage % to pass (default 80)

    // Movement parameters
    movementSpeed?: number;          // Robot movement speed in m/s
    settlementDelay?: number;        // Delay after movement before testing in ms

    // Test settings
    testId: number;                  // Associated test ID
    detectorId?: number;             // Detector being tested
    continuousMonitoring?: boolean;  // Enable continuous telemetry during test
}

/**
 * Grid test progress
 */
export interface GridTestProgress {
    totalCells: number;
    completedCells: number;
    currentCell?: GridPosition;
    currentAngle?: number;
    percentComplete: number;
    estimatedTimeRemaining?: number; // In seconds
    status: 'idle' | 'initializing' | 'running' | 'paused' | 'completed' | 'error';
}

/**
 * Complete grid test result
 */
export interface GridTestResult {
    testId: number;
    config: GridTestConfig;
    cells: GridCellResult[];

    // Overall statistics
    totalDetections: number;
    averageCoverage: number;         // Average coverage across all cells
    cellsPassed: number;
    cellsFailed: number;

    // Coverage map
    coverageMap: number[][];         // 2D array of coverage percentages

    // Timing
    startTime: Date;
    endTime: Date;
    totalDuration: number;           // In seconds

    // Status
    completed: boolean;
    passed: boolean;                 // True if all cells meet threshold
}

/**
 * Grid Test API Interface
 */
export interface IGridTestAPI {
    /**
     * Initialize grid test system
     */
    initialize(): Promise<void>;

    /**
     * Generate grid positions based on configuration
     */
    generateGrid(config: Partial<GridTestConfig>): GridPosition[];

    /**
     * Start a grid test
     */
    startTest(config: GridTestConfig): Promise<number>; // Returns test ID

    /**
     * Pause current test
     */
    pauseTest(): void;

    /**
     * Resume paused test
     */
    resumeTest(): Promise<void>;

    /**
     * Stop current test
     */
    stopTest(): Promise<void>;

    /**
     * Get current test progress
     */
    getProgress(): GridTestProgress;

    /**
     * Get test result for a specific test
     */
    getTestResult(testId: number): Promise<GridTestResult | null>;

    /**
     * Get cell result for specific position in current test
     */
    getCellResult(position: GridPosition): GridCellResult | null;

    /**
     * Move to specific grid position (for manual testing)
     */
    moveToPosition(position: GridPosition): Promise<void>;

    /**
     * Get current position
     */
    getCurrentPosition(): GridPosition | null;

    /**
     * Check if test is running
     */
    isRunning(): boolean;

    /**
     * Calculate distance from center for a grid position
     */
    calculateDistance(position: GridPosition): number;

    /**
     * Calculate angle from center for a grid position
     */
    calculateAngle(position: GridPosition): number;

    /**
     * Validate grid configuration
     */
    validateConfig(config: Partial<GridTestConfig>): { valid: boolean; errors: string[] };

    /**
     * Get status
     */
    getStatus(): {
        initialized: boolean;
        testRunning: boolean;
        currentTestId?: number;
        lastError?: string;
    };

    /**
     * Disconnect and cleanup
     */
    disconnect(): Promise<void>;
}

/**
 * Standard grid configurations
 */
export const STANDARD_GRID_CONFIGS = {
    SMALL: {
        gridWidth: 2.0,
        gridHeight: 2.0,
        cellSize: 0.5,
        angleStep: 10,
        dwellTime: 2000,
        coverageThreshold: 80
    },
    MEDIUM: {
        gridWidth: 3.0,
        gridHeight: 3.0,
        cellSize: 0.5,
        angleStep: 10,
        dwellTime: 2000,
        coverageThreshold: 80
    },
    LARGE: {
        gridWidth: 4.0,
        gridHeight: 4.0,
        cellSize: 0.5,
        angleStep: 10,
        dwellTime: 2000,
        coverageThreshold: 80
    },
    FINE_RESOLUTION: {
        gridWidth: 3.0,
        gridHeight: 3.0,
        cellSize: 0.5,
        angleStep: 5,          // More angle steps
        dwellTime: 2000,
        coverageThreshold: 85
    },
    QUICK_TEST: {
        gridWidth: 2.0,
        gridHeight: 2.0,
        cellSize: 0.5,
        angleStep: 30,         // Fewer angle steps
        dwellTime: 1000,       // Shorter dwell time
        coverageThreshold: 70
    }
} as const;
