import { Request, Response, NextFunction } from "express";
import CSVExportService from "../services/csv_export_service";

/**
 * Export test report as CSV
 */
export async function exportTestCSV(req: Request, res: Response, next: NextFunction) {
    try {
        const testId = parseInt(req.params.testId);

        if (isNaN(testId)) {
            return res.status(400).json({ error: "Invalid testId" });
        }

        const includeRawData = req.query.includeRawData === "true";
        const includeEventLog = req.query.includeEventLog === "true";

        const csv = await CSVExportService.generateTestReportCSV({
            testId,
            includeRawData,
            includeEventLog
        });

        // Set headers for file download
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="test_${testId}_report.csv"`);

        return res.send(csv);
    } catch (error) {
        console.error("[CSV Export] Error:", error);
        next(error);
    }
}

/**
 * Export test summary statistics as CSV
 */
export async function exportTestStatisticsCSV(req: Request, res: Response, next: NextFunction) {
    try {
        const testId = parseInt(req.params.testId);

        if (isNaN(testId)) {
            return res.status(400).json({ error: "Invalid testId" });
        }

        const csv = await CSVExportService.generateSummaryStatisticsCSV(testId);

        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="test_${testId}_statistics.csv"`);

        return res.send(csv);
    } catch (error) {
        console.error("[CSV Export] Error:", error);
        next(error);
    }
}
