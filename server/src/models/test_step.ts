export type TestStep = {
    test_step_id: number | null;
    test_id: number;
    step_type: string; // e.g., 'BOUNDARY_DETECTION_RADIAL', 'RADIAL_BOUNDARY_FINAL', etc.
    sequence_no: number;
    angle: number | null;
    cell_row: number | null;
    cell_col: number | null;
    distance_1: number | null;
    distance_2: number | null;
    distance_avg: number | null;
    detection_1: boolean | null;
    detection_2: boolean | null;
    detection_final: boolean | null;
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'ERROR' | 'SKIPPED';
    started_at: Date | null;
    finished_at: Date | null;
};