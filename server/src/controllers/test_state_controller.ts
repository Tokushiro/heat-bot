import { Request, Response } from "express";
import * as testStateService from "../services/test_state_service";

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
