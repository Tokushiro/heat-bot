export interface GridPosition {
    x: number;
    y: number;
    cellX: number;
    cellY: number;
}

/**
 * Grid cell test result
 */
export interface GridCellResult {
    position: GridPosition;
    testId: number;
    startTime: Date;
    endTime?: Date;

    // Detection results
    detectionCount: number;
    anglesCovered: number[];
    coveragePercent: number;

    // Environmental conditions
    avgTemperature?: number;
    avgHumidity?: number;

    // Status
    completed: boolean;
    passed: boolean;
    error?: string;
}

/**
 * Grid test configuration
 */
export interface GridTestConfig {
    // Grid dimensions
    gridWidth: number;
    gridHeight: number;
    cellSize: number;

    // Test parameters
    angleStep: number;
    dwellTime: number;
    coverageThreshold: number;

    // Movement parameters
    movementSpeed?: number;
    settlementDelay?: number;
    // Test settings
    testId: number;
    detectorId?: number;
    continuousMonitoring?: boolean;
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
    averageCoverage: number;
    cellsPassed: number;
    cellsFailed: number;

    // Coverage map
    coverageMap: number[][];

    // Timing
    startTime: Date;
    endTime: Date;
    totalDuration: number;

    // Status
    completed: boolean;
    passed: boolean;
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
