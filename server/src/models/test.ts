export type Test = {
    test_id: number | null;
    test_name: string;
    test_choice: number;
    sensor_id: number;
    test_date: Date;
    status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'PAUSED' | 'ERROR';
    started_at: Date | null;
    finished_at: Date | null;
};