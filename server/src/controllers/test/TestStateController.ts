import { Request, Response } from "express";
import * as testStateService from "../../services/test/TestStateService";
import * as testService from "../../services/test/TestService";

/**
 * Get test step summary for a specific test
 * Returns counts of steps by status
 */
export async function getTestStepSummary(req: Request, res: Response) {
    try {
        const testId = parseInt(req.params.testId);

        if (isNaN(testId)) {
            return res.status(400).json({ error: "Invalid testId" });
        }

        const summary = await testStateService.getTestStepSummary(testId);
        return res.status(200).json(summary);

    } catch (error: any) {
        console.error("Error fetching test step summary:", error);
        return res.status(500).json({ 
            error: error.message || "Failed to fetch test step summary" 
        });
    }
}

/**
 * Get test state for a specific test
 * Returns current phase, boundary results, position, etc.
 */
export async function getTestState(req: Request, res: Response) {
    try {
        const testId = parseInt(req.params.testId);

        if (isNaN(testId)) {
            return res.status(400).json({ error: "Invalid testId" });
        }

        const state = await testStateService.getTestState(testId);

        if (!state) {
            return res.status(404).json({ error: "Test state not found" });
        }

        return res.status(200).json(state);

    } catch (error: any) {
        console.error("Error fetching test state:", error);
        return res.status(500).json({ 
            error: error.message || "Failed to fetch test state" 
        });
    }
}

/**
 * Get detailed test steps for a specific test
 * Optional: filter by step_type and status
 */
export async function getTestSteps(req: Request, res: Response) {
    try {
        const testId = parseInt(req.params.testId);

        if (isNaN(testId)) {
            return res.status(400).json({ error: "Invalid testId" });
        }

        const stepType = req.query.step_type as string | undefined;
        const status = req.query.status as string | undefined;

        const steps = await testStateService.getTestSteps(testId, stepType, status);
        return res.status(200).json(steps);

    } catch (error: any) {
        console.error("Error fetching test steps:", error);
        return res.status(500).json({
            error: error.message || "Failed to fetch test steps"
        });
    }
}

/**
 * Export complete test data for CSV generation
 * Returns test info, state, steps, and boundary results
 */
export async function exportTestData(req: Request, res: Response) {
    try {
        const testId = parseInt(req.params.testId);

        if (isNaN(testId)) {
            return res.status(400).json({ error: "Invalid testId" });
        }

        // Fetch all test data
        const test = await testService.getTestById(testId);
        if (!test) {
            return res.status(404).json({ error: "Test not found" });
        }

        const state = await testStateService.getTestState(testId);
        const steps = await testStateService.getTestSteps(testId);
        const summary = await testStateService.getTestStepSummary(testId);

        // Combine all data
        const exportData = {
            test,
            state,
            steps,
            summary
        };

        return res.status(200).json(exportData);

    } catch (error: any) {
        console.error("Error exporting test data:", error);
        return res.status(500).json({
            error: error.message || "Failed to export test data"
        });
    }
}

/**
 * Get compliance test results (tangential or radial)
 * Query param: type = 'TANGENTIAL' | 'RADIAL'
 */
export async function getComplianceResults(req: Request, res: Response) {
    try {
        const testId = parseInt(req.params.testId);
        const testType = req.query.type as 'TANGENTIAL' | 'RADIAL' | undefined;

        if (isNaN(testId)) {
            return res.status(400).json({ error: "Invalid testId" });
        }

        if (!testType || (testType !== 'TANGENTIAL' && testType !== 'RADIAL')) {
            return res.status(400).json({ error: "Invalid or missing test type. Use ?type=TANGENTIAL or ?type=RADIAL" });
        }

        const results = await testStateService.getComplianceResults(testId, testType);
        return res.status(200).json(results);

    } catch (error: any) {
        console.error("Error fetching compliance results:", error);
        return res.status(500).json({
            error: error.message || "Failed to fetch compliance results"
        });
    }
}
