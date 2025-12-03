import { Router } from "express";
import {
    startTestExecution,
    stopTestExecution,
    getTestProgress,
    getTestMeasurements,
    getTestEventLog,
    getTestDetails,
    updateTestConfiguration
} from "../controllers/test_execution_controller";
import {
    exportTestCSV,
    exportTestStatisticsCSV
} from "../controllers/csv_export_controller";

const router = Router();

// Test execution
router.post("/start", startTestExecution);
router.post("/stop", stopTestExecution);
router.get("/:testId/progress", getTestProgress);
router.get("/:testId/measurements", getTestMeasurements);
router.get("/:testId/events", getTestEventLog);
router.get("/:testId/details", getTestDetails);
router.post("/:testId/configuration", updateTestConfiguration);

// CSV export
router.get("/:testId/export/csv", exportTestCSV);
router.get("/:testId/export/statistics", exportTestStatisticsCSV);

export default router;
