import { Router } from "express";
import {
    startTestExecution,
    resumeTestExecution,
    stopTestExecution,
    getTestProgress,
    getResumableTests,
    getTestCheckpoint,
    getTestCheckpoints,
    getTestMeasurements,
    getTestEventLog,
    getTestDetails,
    updateTestConfiguration,
} from "../controllers/test_execution_controller_with_resume";
import {
    exportTestCSV,
    exportTestStatisticsCSV,
} from "../controllers/csv_export_controller";

const router = Router();

// Test execution control
router.post("/start", startTestExecution);
router.post("/resume", resumeTestExecution);
router.post("/stop", stopTestExecution);

// Test progress and data
router.get("/:testId/progress", getTestProgress);
router.get("/:testId/measurements", getTestMeasurements);
router.get("/:testId/events", getTestEventLog);
router.get("/:testId/details", getTestDetails);

// Resume functionality
router.get("/resumable", getResumableTests);
router.get("/:testId/checkpoint", getTestCheckpoint);
router.get("/:testId/checkpoints", getTestCheckpoints);

// Configuration
router.post("/:testId/configuration", updateTestConfiguration);

// CSV exports
router.get("/:testId/export/csv", exportTestCSV);
router.get("/:testId/export/statistics", exportTestStatisticsCSV);

export default router;
