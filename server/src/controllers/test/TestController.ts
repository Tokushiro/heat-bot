import { Request, Response } from "express";
import { insertTest, getAllTests, updateTestStatus, deleteTest, getTestById } from '../../services/test/TestService';

export async function createTest(req: Request, res: Response) {
    const test_id = await insertTest(req.body);
    console.log(`Created test with ID ${test_id}`);
    return res.status(201).json({
        test_id,
        ...req.body,
        status: req.body.status || 'PLANNED'
    });
}

export async function listTests(_req: Request, res: Response) {
    const tests = await getAllTests();
    return res.status(200).json(tests);
}

export async function getTest(req: Request, res: Response) {
    const testId = parseInt(req.params.testId);

    if (isNaN(testId)) {
        return res.status(400).json({ error: "Invalid test ID" });
    }

    const test = await getTestById(testId);

    if (!test) {
        return res.status(404).json({ error: "Test not found" });
    }

    return res.status(200).json(test);
}

export async function updateStatus(req: Request, res: Response) {
    const testId = parseInt(req.params.testId);

    if (isNaN(testId)) {
        return res.status(400).json({ error: "Invalid test ID" });
    }

    const { status, started_at, finished_at } = req.body;

    if (!status) {
        return res.status(400).json({ error: "Status is required" });
    }

    await updateTestStatus(testId, status, started_at, finished_at);
    return res.status(204).send();
}

export async function removeTest(req: Request, res: Response) {
    const testId = parseInt(req.params.testId);

    if (isNaN(testId)) {
        return res.status(400).json({ error: "Invalid test ID" });
    }

    const test = await getTestById(testId);
    if (!test) {
        return res.status(404).json({ error: "Test not found" });
    }

    await deleteTest(testId);
    console.log(`Deleted test ${testId}`);
    return res.status(204).send();
}