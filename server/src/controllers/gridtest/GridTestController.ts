import { Request, Response } from 'express';
import { GridTestAPIFactory } from '../../api/factories/GridTestAPIFactory';
import { GridTestConfig } from '../../api/interfaces/IGridTestAPI';

/**
 * Grid Test Controller
 *
 * REST API controller for grid-based detector coverage testing.
 * Provides endpoints for test execution, progress tracking, and result retrieval.
 */

/**
 * Initialize grid test system
 * POST /api/gridtest/initialize
 */
export async function initialize(req: Request, res: Response) {
    try {
        console.log('[GridTestController] Initialize request received');

        const gridTest = GridTestAPIFactory.getGridTestAPI();
        await gridTest.initialize();

        const status = gridTest.getStatus();

        return res.status(200).json({
            message: 'Grid test system initialized successfully',
            status
        });
    } catch (error) {
        console.error('[GridTestController] Initialize error:', error);
        return res.status(500).json({
            error: 'Failed to initialize grid test system',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Generate grid positions
 * POST /api/gridtest/generate-grid
 * Body: { gridWidth: number, gridHeight: number, cellSize: number }
 */
export async function generateGrid(req: Request, res: Response) {
    try {
        const { gridWidth, gridHeight, cellSize } = req.body;

        if (!gridWidth || !gridHeight) {
            return res.status(400).json({ error: 'Grid width and height are required' });
        }

        const gridTest = GridTestAPIFactory.getGridTestAPI();
        const positions = gridTest.generateGrid({ gridWidth, gridHeight, cellSize });

        return res.status(200).json({
            count: positions.length,
            positions
        });
    } catch (error) {
        console.error('[GridTestController] Generate grid error:', error);
        return res.status(500).json({
            error: 'Failed to generate grid',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Start grid test
 * POST /api/gridtest/start
 * Body: GridTestConfig
 */
export async function startTest(req: Request, res: Response) {
    try {
        const config: GridTestConfig = req.body;

        // Validate required fields
        if (!config.gridWidth || !config.gridHeight || !config.testId) {
            return res.status(400).json({
                error: 'Missing required fields: gridWidth, gridHeight, testId'
            });
        }

        // Set defaults
        config.cellSize = config.cellSize || 0.5;
        config.angleStep = config.angleStep || 10;
        config.dwellTime = config.dwellTime || 2000;
        config.coverageThreshold = config.coverageThreshold || 80;
        config.movementSpeed = config.movementSpeed || 0.2;
        config.settlementDelay = config.settlementDelay || 500;

        console.log('[GridTestController] Starting test:', config);

        const gridTest = GridTestAPIFactory.getGridTestAPI();
        const testId = await gridTest.startTest(config);

        return res.status(200).json({
            message: 'Grid test started',
            testId,
            config
        });
    } catch (error) {
        console.error('[GridTestController] Start test error:', error);
        return res.status(500).json({
            error: 'Failed to start test',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Pause current test
 * POST /api/gridtest/pause
 */
export async function pauseTest(req: Request, res: Response) {
    try {
        console.log('[GridTestController] Pause test request');

        const gridTest = GridTestAPIFactory.getGridTestAPI();
        gridTest.pauseTest();

        const progress = gridTest.getProgress();

        return res.status(200).json({
            message: 'Test paused',
            progress
        });
    } catch (error) {
        console.error('[GridTestController] Pause test error:', error);
        return res.status(500).json({
            error: 'Failed to pause test',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Resume paused test
 * POST /api/gridtest/resume
 */
export async function resumeTest(req: Request, res: Response) {
    try {
        console.log('[GridTestController] Resume test request');

        const gridTest = GridTestAPIFactory.getGridTestAPI();
        await gridTest.resumeTest();

        const progress = gridTest.getProgress();

        return res.status(200).json({
            message: 'Test resumed',
            progress
        });
    } catch (error) {
        console.error('[GridTestController] Resume test error:', error);
        return res.status(500).json({
            error: 'Failed to resume test',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Stop current test
 * POST /api/gridtest/stop
 */
export async function stopTest(req: Request, res: Response) {
    try {
        console.log('[GridTestController] Stop test request');

        const gridTest = GridTestAPIFactory.getGridTestAPI();
        await gridTest.stopTest();

        return res.status(200).json({
            message: 'Test stopped'
        });
    } catch (error) {
        console.error('[GridTestController] Stop test error:', error);
        return res.status(500).json({
            error: 'Failed to stop test',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Get test progress
 * GET /api/gridtest/progress
 */
export async function getProgress(req: Request, res: Response) {
    try {
        const gridTest = GridTestAPIFactory.getGridTestAPI();
        const progress = gridTest.getProgress();

        return res.status(200).json(progress);
    } catch (error) {
        console.error('[GridTestController] Get progress error:', error);
        return res.status(500).json({
            error: 'Failed to get progress',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Get test result
 * GET /api/gridtest/result/:testId
 */
export async function getTestResult(req: Request, res: Response) {
    try {
        const testId = parseInt(req.params.testId, 10);

        if (isNaN(testId)) {
            return res.status(400).json({ error: 'Invalid test ID' });
        }

        const gridTest = GridTestAPIFactory.getGridTestAPI();
        const result = await gridTest.getTestResult(testId);

        if (!result) {
            return res.status(404).json({ error: 'Test result not found' });
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error('[GridTestController] Get test result error:', error);
        return res.status(500).json({
            error: 'Failed to get test result',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Get cell result
 * GET /api/gridtest/cell-result
 * Query params: cellX, cellY
 */
export async function getCellResult(req: Request, res: Response) {
    try {
        const cellX = parseInt(req.query.cellX as string, 10);
        const cellY = parseInt(req.query.cellY as string, 10);

        if (isNaN(cellX) || isNaN(cellY)) {
            return res.status(400).json({ error: 'Invalid cell coordinates' });
        }

        const gridTest = GridTestAPIFactory.getGridTestAPI();
        const result = gridTest.getCellResult({ x: 0, y: 0, cellX, cellY });

        if (!result) {
            return res.status(404).json({ error: 'Cell result not found' });
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error('[GridTestController] Get cell result error:', error);
        return res.status(500).json({
            error: 'Failed to get cell result',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Move to grid position (manual control)
 * POST /api/gridtest/move-to-position
 * Body: { x: number, y: number, cellX: number, cellY: number }
 */
export async function moveToPosition(req: Request, res: Response) {
    try {
        const { x, y, cellX, cellY } = req.body;

        if (x === undefined || y === undefined || cellX === undefined || cellY === undefined) {
            return res.status(400).json({ error: 'Position coordinates required' });
        }

        console.log(`[GridTestController] Move to position: (${x}, ${y})`);

        const gridTest = GridTestAPIFactory.getGridTestAPI();
        await gridTest.moveToPosition({ x, y, cellX, cellY });

        const currentPosition = gridTest.getCurrentPosition();

        return res.status(200).json({
            message: 'Moved to position',
            position: currentPosition
        });
    } catch (error) {
        console.error('[GridTestController] Move to position error:', error);
        return res.status(500).json({
            error: 'Failed to move to position',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Get current position
 * GET /api/gridtest/current-position
 */
export async function getCurrentPosition(req: Request, res: Response) {
    try {
        const gridTest = GridTestAPIFactory.getGridTestAPI();
        const position = gridTest.getCurrentPosition();

        if (!position) {
            return res.status(404).json({ error: 'No current position' });
        }

        return res.status(200).json(position);
    } catch (error) {
        console.error('[GridTestController] Get current position error:', error);
        return res.status(500).json({
            error: 'Failed to get current position',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Validate test configuration
 * POST /api/gridtest/validate-config
 * Body: Partial<GridTestConfig>
 */
export async function validateConfig(req: Request, res: Response) {
    try {
        const config = req.body;

        const gridTest = GridTestAPIFactory.getGridTestAPI();
        const validation = gridTest.validateConfig(config);

        return res.status(200).json(validation);
    } catch (error) {
        console.error('[GridTestController] Validate config error:', error);
        return res.status(500).json({
            error: 'Failed to validate configuration',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Get system status
 * GET /api/gridtest/status
 */
export async function getStatus(req: Request, res: Response) {
    try {
        const gridTest = GridTestAPIFactory.getGridTestAPI();
        const status = gridTest.getStatus();

        return res.status(200).json(status);
    } catch (error) {
        console.error('[GridTestController] Get status error:', error);
        return res.status(500).json({
            error: 'Failed to get status',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Disconnect grid test system
 * POST /api/gridtest/disconnect
 */
export async function disconnect(req: Request, res: Response) {
    try {
        console.log('[GridTestController] Disconnect request');

        const gridTest = GridTestAPIFactory.getGridTestAPI();
        await gridTest.disconnect();

        return res.status(200).json({
            message: 'Grid test system disconnected successfully'
        });
    } catch (error) {
        console.error('[GridTestController] Disconnect error:', error);
        return res.status(500).json({
            error: 'Failed to disconnect',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
