import { Request, Response } from "express";
import * as testStepService from "../../services/test/TestStepService";

export async function createTestStep(req: Request, res: Response) {
    const stepId = await testStepService.insertTestStep(req.body);
    return res.status(201).json({ test_step_id: stepId });
}

export async function listTestSteps(req: Request, res: Response) {
    const testId = parseInt(req.params.testId);
    const steps = await testStepService.getTestSteps(testId);
    return res.status(200).json(steps);
}

export async function updateStep(req: Request, res: Response) {
    const stepId = parseInt(req.params.stepId);
    await testStepService.updateTestStep(stepId, req.body);
    return res.status(204).send();
}

export async function getProgress(req: Request, res: Response) {
    const testId = parseInt(req.params.testId);
    const progress = await testStepService.getTestProgress(testId);
    return res.status(200).json(progress);
}