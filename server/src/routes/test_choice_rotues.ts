import { Router } from "express";
import { createTestChoice, listTestChoices } from "../controllers/test_choice_controller";

const router = Router();

router.post("/", createTestChoice);
router.get("/", listTestChoices);

export default router;