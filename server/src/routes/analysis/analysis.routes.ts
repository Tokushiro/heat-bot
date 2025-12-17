import { Router } from 'express';
import {
    getAngularStatistics,
    getDetectionProbabilityAnalysis,
    compareTests,
    getTrendAnalysis,
    detectOutliers
} from '../../controllers/analysis/AnalysisController';

const router = Router();

// Angular statistics for a test
router.get('/angular/:testId', getAngularStatistics);

// Detection probability analysis
router.get('/detection-probability/:testId', getDetectionProbabilityAnalysis);

// Compare two tests
router.get('/compare/:testId1/:testId2', compareTests);

// Trend analysis across multiple tests
router.post('/trends', getTrendAnalysis);

// Outlier detection
router.get('/outliers/:testId', detectOutliers);

export default router;
