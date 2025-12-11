import { Router } from 'express';
import {
    exportBoundaryTest,
    exportGridTest,
    exportRadialTest,
    exportComprehensiveTest
} from '../../controllers/export/ExportController';

const router = Router();

/**
 * Export Routes
 *
 * IEC-compliant CSV export endpoints for test data
 */

// Comprehensive test export (all test types combined - IEC 63180 format)
router.get('/comprehensive/:testId', exportComprehensiveTest);

// Boundary test export
router.get('/boundary/:testId', exportBoundaryTest);

// Grid test export
router.get('/grid/:testId', exportGridTest);

// Radial test export
router.get('/radial/:testId', exportRadialTest);

export default router;
