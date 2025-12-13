-- ============================================================
-- Migration: IEC 63180 State Machine and Grid Coordinates
-- Description: Add execution_state to test_state and cell coordinates to test_step
-- Date: 2025-12-11
-- ============================================================

-- Add execution_state column to test_state table
-- This replaces the multiple boolean flags with a single state enum
ALTER TABLE test_state
    ADD COLUMN execution_state VARCHAR(30) DEFAULT 'IDLE';

COMMENT ON COLUMN test_state.execution_state IS 'Test execution state: IDLE, BOUNDARY_RUNNING, BOUNDARY_PAUSED, BOUNDARY_COMPLETE, TANGENTIAL_RUNNING, TANGENTIAL_PAUSED, TANGENTIAL_COMPLETE, RADIAL_RUNNING, RADIAL_PAUSED, RADIAL_COMPLETE, ALL_COMPLETE, ERROR';

-- Add grid cell coordinate columns to test_step table
-- These store the actual metric coordinates (in meters) of grid cell centers
-- Separate from cell_row/cell_col which are integer grid indices
ALTER TABLE test_step
    ADD COLUMN cell_x DOUBLE PRECISION,
    ADD COLUMN cell_y DOUBLE PRECISION;

COMMENT ON COLUMN test_step.cell_x IS 'Grid cell center X coordinate in meters (for GRID_TANGENTIAL tests)';
COMMENT ON COLUMN test_step.cell_y IS 'Grid cell center Y coordinate in meters (for GRID_TANGENTIAL tests)';

-- Create index on grid coordinates for spatial queries
CREATE INDEX idx_test_step_grid_coordinates
    ON test_step (cell_x, cell_y)
    WHERE cell_x IS NOT NULL AND cell_y IS NOT NULL;

-- Create index on execution_state for filtering
CREATE INDEX idx_test_state_execution_state
    ON test_state (execution_state);

-- Update existing records to have IDLE state
UPDATE test_state
SET execution_state = 'IDLE'
WHERE execution_state IS NULL;

-- Note: current_phase and awaiting_confirmation columns are kept for backward compatibility
-- They will be deprecated in future migrations once all code is updated
