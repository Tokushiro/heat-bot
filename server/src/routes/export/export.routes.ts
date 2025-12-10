import { Router } from 'express';
import {
    exportBoundaryTest,
    exportGridTest,
    exportRadialTest
} from '../../controllers/export/ExportController';

const router = Router();

/**
 * Export Routes
 *
 * IEC-compliant CSV export endpoints for test data
 */

// Boundary test export
router.get('/boundary/:testId', exportBoundaryTest);

// Grid test export
router.get('/grid/:testId', exportGridTest);

// Radial test export
router.get('/radial/:testId', exportRadialTest);

export default router;
