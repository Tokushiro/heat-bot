import { Request, Response } from "express";
import { insertTestChoice, getAllTestChoices, checkTestChoiceExists } from '../../services/test/TestChoiceService';

export async function createTestChoice(req: Request, res: Response) {
    await insertTestChoice(req.body);
    console.log(`Got request ${req.body}`);
    return res.status(204).send();
}

export async function listTestChoices(_req: Request, res: Response) {
    const testChoices = await getAllTestChoices();
    return res.status(200).json(testChoices);
}


export async function checkIfTestExists(_req: Request, res: Response) {
    const exists = await checkTestChoiceExists();
    return res.status(200).json({ exists });
}