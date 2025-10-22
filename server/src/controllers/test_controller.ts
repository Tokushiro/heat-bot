import { Request, Response } from "express";
import { insertTest, getAllTests } from '../services/test_service';

export async function createTest(req: Request, res: Response) {
    await insertTest(req.body);
    console.log(`Got request ${req.body}`);
    return res.status(204).send();
}

export async function listTests(_req: Request, res: Response) {
    const tests = await getAllTests();
    return res.status(200).json(tests);
}  