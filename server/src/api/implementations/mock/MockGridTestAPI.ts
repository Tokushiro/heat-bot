import {
    IGridTestAPI,
    GridPosition,
    GridCellResult,
    GridTestConfig,
    GridTestProgress,
    GridTestResult,
    STANDARD_GRID_CONFIGS
} from '../../interfaces/IGridTestAPI';
import { StandAPIFactory } from '../../factories/StandAPIFactory';
import { EnvironmentAPIFactory } from '../../factories/EnvironmentAPIFactory';


export class MockGridTestAPI implements IGridTestAPI {
    private static instance: MockGridTestAPI;

    private initialized: boolean = false;
    private testRunning: boolean = false;
    private testPaused: boolean = false;

    // Current test state
    private currentTestId?: number;
    private currentConfig?: GridTestConfig;
    private currentPosition: GridPosition | null = null;
    private currentCellIndex: number = 0;
    private currentAngle: number = 0;

    // Test data
    private gridPositions: GridPosition[] = [];
    private cellResults: Map<string, GridCellResult> = new Map();
    private testResults: Map<number, GridTestResult> = new Map();

    // Timing
    private testStartTime?: Date;
    private cellStartTime?: Date;
    private testInterval?: NodeJS.Timeout;

    // Error tracking
    private lastError?: string;

    private constructor() {
        console.log('[MockGridTest] Mock grid test API created');
    }

    /**
     * Get singleton instance
     */
    public static getInstance(): MockGridTestAPI {
        if (!MockGridTestAPI.instance) {
            MockGridTestAPI.instance = new MockGridTestAPI();
        }
        return MockGridTestAPI.instance;
    }

    /**
     * Initialize the system
     */
    async initialize(): Promise<void> {
        console.log('[MockGridTest] Initializing grid test system...');

        // Initialize dependencies
        const stand = StandAPIFactory.getStandAPI();
        if (!stand.isReady()) {
            await stand.initialize();
        }

        const environment = EnvironmentAPIFactory.getEnvironmentAPI();
        if (!environment.isReady()) {
            await environment.initialize();
        }

        this.initialized = true;
        console.log('[MockGridTest] ✅ Grid test system initialized');
    }

    /**
     * Generate grid positions
     */
    generateGrid(config: Partial<GridTestConfig>): GridPosition[] {
        const width = config.gridWidth || STANDARD_GRID_CONFIGS.MEDIUM.gridWidth;
        const height = config.gridHeight || STANDARD_GRID_CONFIGS.MEDIUM.gridHeight;
        const cellSize = config.cellSize || STANDARD_GRID_CONFIGS.MEDIUM.cellSize;

        const positions: GridPosition[] = [];

        // Calculate number of cells
        const cellsX = Math.ceil(width / cellSize);
        const cellsY = Math.ceil(height / cellSize);

        // Generate positions (center-based coordinate system)
        for (let cy = 0; cy < cellsY; cy++) {
            for (let cx = 0; cx < cellsX; cx++) {
                const x = (cx - cellsX / 2 + 0.5) * cellSize;
                const y = (cy - cellsY / 2 + 0.5) * cellSize;

                positions.push({
                    x: parseFloat(x.toFixed(3)),
                    y: parseFloat(y.toFixed(3)),
                    cellX: cx,
                    cellY: cy
                });
            }
        }

        console.log(`[MockGridTest] Generated ${positions.length} grid positions (${cellsX}×${cellsY} grid)`);
        return positions;
    }

    /**
     * Start a grid test
     */
    async startTest(config: GridTestConfig): Promise<number> {
        if (this.testRunning) {
            throw new Error('Test already running');
        }

        console.log('[MockGridTest] Starting grid test...');
        console.log(`[MockGridTest] Grid: ${config.gridWidth}m × ${config.gridHeight}m`);
        console.log(`[MockGridTest] Cell size: ${config.cellSize}m`);
        console.log(`[MockGridTest] Angle step: ${config.angleStep}°`);

        // Validate configuration
        const validation = this.validateConfig(config);
        if (!validation.valid) {
            throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
        }

        // Generate grid
        this.gridPositions = this.generateGrid(config);

        // Initialize test state
        this.currentTestId = config.testId;
        this.currentConfig = config;
        this.currentCellIndex = 0;
        this.currentAngle = 0;
        this.cellResults.clear();
        this.testStartTime = new Date();
        this.testRunning = true;
        this.testPaused = false;

        // Start environment monitoring if requested
        if (config.continuousMonitoring) {
            const environment = EnvironmentAPIFactory.getEnvironmentAPI();
            environment.startMonitoring(5000); // Sample every 5 seconds
        }

        // Start test execution
        this.executeTest();

        return this.currentTestId;
    }

    /**
     * Execute test (internal)
     */
    private async executeTest(): Promise<void> {
        if (!this.currentConfig || !this.currentTestId) {
            return;
        }

        const config = this.currentConfig;
        const angleStep = config.angleStep;
        const dwellTime = config.dwellTime;
        const totalAngles = Math.ceil(360 / angleStep);

        // Process each grid cell
        while (this.currentCellIndex < this.gridPositions.length && this.testRunning && !this.testPaused) {
            const position = this.gridPositions[this.currentCellIndex];
            this.currentPosition = position;

            console.log(`[MockGridTest] Testing cell (${position.x}, ${position.y}) - Cell ${this.currentCellIndex + 1}/${this.gridPositions.length}`);

            // Move to position
            await this.moveToPosition(position);

            // Wait for settlement
            if (config.settlementDelay) {
                await this.delay(config.settlementDelay);
            }

            // Initialize cell result
            const cellKey = `${position.cellX},${position.cellY}`;
            const cellResult: GridCellResult = {
                position,
                testId: this.currentTestId,
                startTime: new Date(),
                detectionCount: 0,
                anglesCovered: [],
                coveragePercent: 0,
                completed: false,
                passed: false
            };

            this.cellStartTime = new Date();

            // Test at each angle
            for (let angle = 0; angle < 360; angle += angleStep) {
                if (!this.testRunning || this.testPaused) {
                    break;
                }

                this.currentAngle = angle;

                // Rotate stand
                const stand = StandAPIFactory.getStandAPI();
                await stand.setDetectorAngle(angle);

                // Wait at angle
                await this.delay(dwellTime);

                // Simulate detection (detection probability based on distance from center)
                const distance = this.calculateDistance(position);
                const detectionProbability = this.calculateDetectionProbability(distance, angle);

                if (Math.random() < detectionProbability) {
                    cellResult.detectionCount++;
                    cellResult.anglesCovered.push(angle);
                }
            }

            // Complete cell result
            cellResult.endTime = new Date();
            cellResult.coveragePercent = (cellResult.anglesCovered.length / totalAngles) * 100;
            cellResult.passed = cellResult.coveragePercent >= config.coverageThreshold;
            cellResult.completed = true;

            // Record environmental conditions
            const environment = EnvironmentAPIFactory.getEnvironmentAPI();
            const envReading = environment.getReading();
            cellResult.avgTemperature = envReading.temperature;
            cellResult.avgHumidity = envReading.humidity;

            // Store result
            this.cellResults.set(cellKey, cellResult);

            console.log(`[MockGridTest] Cell (${position.x}, ${position.y}) complete: ${cellResult.detectionCount} detections, ${cellResult.coveragePercent.toFixed(1)}% coverage`);

            this.currentCellIndex++;
        }

        // Complete test if not paused or stopped
        if (this.testRunning && !this.testPaused && this.currentCellIndex >= this.gridPositions.length) {
            await this.completeTest();
        }
    }

    /**
     * Complete the test
     */
    private async completeTest(): Promise<void> {
        if (!this.currentConfig || !this.currentTestId || !this.testStartTime) {
            return;
        }

        console.log('[MockGridTest] Test complete, aggregating results...');

        // Stop environment monitoring
        const environment = EnvironmentAPIFactory.getEnvironmentAPI();
        environment.stopMonitoring();

        // Aggregate results
        const cells = Array.from(this.cellResults.values());
        const totalDetections = cells.reduce((sum, cell) => sum + cell.detectionCount, 0);
        const averageCoverage = cells.reduce((sum, cell) => sum + cell.coveragePercent, 0) / cells.length;
        const cellsPassed = cells.filter(cell => cell.passed).length;
        const cellsFailed = cells.length - cellsPassed;

        // Create coverage map
        const coverageMap = this.createCoverageMap(cells);

        const result: GridTestResult = {
            testId: this.currentTestId,
            config: this.currentConfig,
            cells,
            totalDetections,
            averageCoverage,
            cellsPassed,
            cellsFailed,
            coverageMap,
            startTime: this.testStartTime,
            endTime: new Date(),
            totalDuration: (new Date().getTime() - this.testStartTime.getTime()) / 1000,
            completed: true,
            passed: cellsFailed === 0
        };

        this.testResults.set(this.currentTestId, result);

        console.log('[MockGridTest] ✅ Test completed');
        console.log(`[MockGridTest] Total detections: ${totalDetections}`);
        console.log(`[MockGridTest] Average coverage: ${averageCoverage.toFixed(1)}%`);
        console.log(`[MockGridTest] Cells passed: ${cellsPassed}/${cells.length}`);

        this.testRunning = false;
        this.currentTestId = undefined;
    }

    /**
     * Create coverage map
     */
    private createCoverageMap(cells: GridCellResult[]): number[][] {
        if (cells.length === 0) {
            return [];
        }

        // Find grid dimensions
        const maxCellX = Math.max(...cells.map(c => c.position.cellX));
        const maxCellY = Math.max(...cells.map(c => c.position.cellY));

        // Initialize map
        const map: number[][] = Array(maxCellY + 1)
            .fill(0)
            .map(() => Array(maxCellX + 1).fill(0));

        // Fill map
        cells.forEach(cell => {
            map[cell.position.cellY][cell.position.cellX] = cell.coveragePercent;
        });

        return map;
    }

    /**
     * Calculate detection probability based on distance and angle
     */
    private calculateDetectionProbability(distance: number, angle: number): number {
        // Base probability decreases with distance
        let probability = Math.max(0, 1 - (distance / 3)); // Assumes 3m max detection range

        // Add angular variation (simulates detector beam pattern)
        const angleVariation = Math.sin((angle * Math.PI) / 180) * 0.1;
        probability += angleVariation;

        // Clamp to [0, 1]
        return Math.max(0, Math.min(1, probability));
    }

    /**
     * Pause test
     */
    pauseTest(): void {
        if (!this.testRunning) {
            throw new Error('No test running');
        }

        console.log('[MockGridTest] Test paused');
        this.testPaused = true;
    }

    /**
     * Resume test
     */
    async resumeTest(): Promise<void> {
        if (!this.testRunning || !this.testPaused) {
            throw new Error('No paused test to resume');
        }

        console.log('[MockGridTest] Test resumed');
        this.testPaused = false;

        // Continue execution
        this.executeTest();
    }

    /**
     * Stop test
     */
    async stopTest(): Promise<void> {
        if (!this.testRunning) {
            throw new Error('No test running');
        }

        console.log('[MockGridTest] Test stopped');

        this.testRunning = false;
        this.testPaused = false;

        // Stop environment monitoring
        const environment = EnvironmentAPIFactory.getEnvironmentAPI();
        environment.stopMonitoring();

        // Reset stand
        const stand = StandAPIFactory.getStandAPI();
        await stand.setDetectorAngle(0);
    }

    /**
     * Get test progress
     */
    getProgress(): GridTestProgress {
        if (!this.testRunning || !this.currentConfig) {
            return {
                totalCells: 0,
                completedCells: 0,
                percentComplete: 0,
                status: 'idle'
            };
        }

        const totalCells = this.gridPositions.length;
        const completedCells = this.currentCellIndex;
        const percentComplete = (completedCells / totalCells) * 100;

        // Estimate time remaining
        let estimatedTimeRemaining: number | undefined;
        if (this.testStartTime && completedCells > 0) {
            const elapsed = (new Date().getTime() - this.testStartTime.getTime()) / 1000;
            const avgTimePerCell = elapsed / completedCells;
            estimatedTimeRemaining = Math.ceil(avgTimePerCell * (totalCells - completedCells));
        }

        return {
            totalCells,
            completedCells,
            currentCell: this.currentPosition || undefined,
            currentAngle: this.currentAngle,
            percentComplete,
            estimatedTimeRemaining,
            status: this.testPaused ? 'paused' : 'running'
        };
    }

    /**
     * Get test result
     */
    async getTestResult(testId: number): Promise<GridTestResult | null> {
        return this.testResults.get(testId) || null;
    }

    /**
     * Get cell result
     */
    getCellResult(position: GridPosition): GridCellResult | null {
        const key = `${position.cellX},${position.cellY}`;
        return this.cellResults.get(key) || null;
    }

    /**
     * Move to position (simulated)
     */
    async moveToPosition(position: GridPosition): Promise<void> {
        console.log(`[MockGridTest] Moving to (${position.x}, ${position.y})`);

        // Simulate movement time based on distance
        if (this.currentPosition) {
            const dx = position.x - this.currentPosition.x;
            const dy = position.y - this.currentPosition.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const speed = this.currentConfig?.movementSpeed || 0.2; // m/s
            const movementTime = (distance / speed) * 1000; // ms

            await this.delay(movementTime);
        }

        this.currentPosition = position;
    }

    /**
     * Get current position
     */
    getCurrentPosition(): GridPosition | null {
        return this.currentPosition;
    }

    /**
     * Check if test is running
     */
    isRunning(): boolean {
        return this.testRunning;
    }

    /**
     * Calculate distance from center
     */
    calculateDistance(position: GridPosition): number {
        return Math.sqrt(position.x * position.x + position.y * position.y);
    }

    /**
     * Calculate angle from center
     */
    calculateAngle(position: GridPosition): number {
        let angle = Math.atan2(position.y, position.x) * (180 / Math.PI);
        if (angle < 0) {
            angle += 360;
        }
        return angle;
    }

    /**
     * Validate configuration
     */
    validateConfig(config: Partial<GridTestConfig>): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!config.gridWidth || config.gridWidth <= 0) {
            errors.push('Grid width must be positive');
        }

        if (!config.gridHeight || config.gridHeight <= 0) {
            errors.push('Grid height must be positive');
        }

        if (!config.cellSize || config.cellSize <= 0 || config.cellSize > 1) {
            errors.push('Cell size must be between 0 and 1 meter');
        }

        if (!config.angleStep || config.angleStep <= 0 || config.angleStep > 360) {
            errors.push('Angle step must be between 0 and 360 degrees');
        }

        if (!config.dwellTime || config.dwellTime < 100) {
            errors.push('Dwell time must be at least 100ms');
        }

        if (config.coverageThreshold !== undefined &&
            (config.coverageThreshold < 0 || config.coverageThreshold > 100)) {
            errors.push('Coverage threshold must be between 0 and 100');
        }

        if (!config.testId) {
            errors.push('Test ID is required');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Get status
     */
    getStatus() {
        return {
            initialized: this.initialized,
            testRunning: this.testRunning,
            currentTestId: this.currentTestId,
            lastError: this.lastError
        };
    }

    /**
     * Disconnect
     */
    async disconnect(): Promise<void> {
        console.log('[MockGridTest] Disconnecting...');

        if (this.testRunning) {
            await this.stopTest();
        }

        this.initialized = false;
        console.log('[MockGridTest] ✅ Disconnected');
    }

    /**
     * Delay helper
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Reset for testing
     */
    reset(): void {
        this.initialized = false;
        this.testRunning = false;
        this.testPaused = false;
        this.currentTestId = undefined;
        this.currentConfig = undefined;
        this.currentPosition = null;
        this.currentCellIndex = 0;
        this.currentAngle = 0;
        this.gridPositions = [];
        this.cellResults.clear();
        this.testResults.clear();
        this.lastError = undefined;
        console.log('[MockGridTest] Grid test system reset');
    }
}

// Export singleton instance getter
export const getMockGridTestAPI = () => MockGridTestAPI.getInstance();
