import { Router } from "express";
import { createTestChoice, listTestChoices, checkIfTestExists } from "../controllers/test_choice_controller";

const router = Router();

router.post("/", createTestChoice);
router.get("/", listTestChoices);
router.get("/exists", checkIfTestExists);

export default router;