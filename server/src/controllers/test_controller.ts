import { Request, Response } from "express";
import { insertTest, getAllTests, updateTestStatus } from '../services/test_service';

export async function createTest(req: Request, res: Response) {
    await insertTest(req.body);
    console.log(`Got request ${req.body}`);
    return res.status(204).send();
}

export async function listTests(_req: Request, res: Response) {
    const tests = await getAllTests();
    return res.status(200).json(tests);
}

// NEW: Update test status
export async function updateStatus(req: Request, res: Response) {
    const testId = parseInt(req.params.testId);
    const { status, started_at, finished_at } = req.body;
    await updateTestStatus(testId, status, started_at, finished_at);
    return res.status(204).send();
}