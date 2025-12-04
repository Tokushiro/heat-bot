-- =========================
-- Sensor Catalog
-- =========================
CREATE TABLE sensor (
                        sensor_id         SERIAL PRIMARY KEY,
                        name              VARCHAR(50) NOT NULL,
                        manufacturer      VARCHAR(25) NOT NULL,
                        product_reference VARCHAR(20),
                        description       VARCHAR(50),
                        hw_version        VARCHAR(10),
                        sw_version        VARCHAR(10),
                        mounting_height   DOUBLE PRECISION NOT NULL,
                        note              VARCHAR(25),

                        CONSTRAINT sensor_mounting_height_nonneg
                            CHECK (mounting_height >= 0)
);

-- =========================
-- Test Type Catalog
-- =========================
CREATE TABLE test_choice (
                             test_choice_id SERIAL PRIMARY KEY,
                             test_name      VARCHAR(50) NOT NULL,
                             test_standard  VARCHAR(50),
                             test_method    VARCHAR(25),
                             test_lab       VARCHAR(50)
);

-- =========================
-- Test Instance (Header)
-- =========================
CREATE TABLE test (
                      test_id     SERIAL PRIMARY KEY,
                      test_name   VARCHAR(50),
                      test_choice INT NOT NULL,
                      sensor_id   INT NOT NULL,
                      test_date   TIMESTAMP NOT NULL,

    -- Status & timing for resume / history
                      status      VARCHAR(20) NOT NULL DEFAULT 'PLANNED',
    -- Values: PLANNED, IN_PROGRESS, PAUSED, COMPLETED, ERROR
                      started_at  TIMESTAMP,
                      finished_at TIMESTAMP,

                      CONSTRAINT fk_test_choice
                          FOREIGN KEY (test_choice)
                              REFERENCES test_choice (test_choice_id)
                              ON UPDATE RESTRICT ON DELETE RESTRICT,

                      CONSTRAINT fk_test_sensor
                          FOREIGN KEY (sensor_id)
                              REFERENCES sensor (sensor_id)
                              ON UPDATE RESTRICT ON DELETE RESTRICT
);

-- =========================
-- Test State (Resume & Progress Tracking)
-- =========================
CREATE TABLE test_state (
                            test_id INTEGER PRIMARY KEY,

    -- Phase tracking
                            current_phase VARCHAR(30) NOT NULL,
    -- Values: BOUNDARY_DETECTION, COMPLIANCE_TEST, COMPLETED

    -- Boundary detection results
                            boundary_results JSONB,
    -- Format: [{"angle": 0, "detection_boundary": 5.5}, ...]

    -- User confirmation
                            awaiting_confirmation BOOLEAN DEFAULT FALSE,

    -- Resume tracking
                            last_completed_angle FLOAT,
                            last_completed_distance FLOAT,
                            completed_step_count INTEGER DEFAULT 0,

    -- Physical position tracking
                            last_position_x FLOAT,
                            last_position_y FLOAT,
                            last_position_timestamp TIMESTAMP,

    -- Full state backup
                            state_data JSONB,

    -- Timestamps
                            created_at TIMESTAMP DEFAULT NOW(),
                            updated_at TIMESTAMP DEFAULT NOW(),

                            CONSTRAINT fk_test_state_test
                                FOREIGN KEY (test_id)
                                    REFERENCES test (test_id)
                                    ON UPDATE CASCADE ON DELETE CASCADE
);

-- Indexes for test_state
CREATE INDEX idx_test_state_phase ON test_state (current_phase, awaiting_confirmation);
CREATE INDEX idx_test_state_updated ON test_state (updated_at);
CREATE INDEX idx_test_state_position ON test_state (last_position_x, last_position_y);

-- =========================
-- Test Step (Individual Measurements)
-- =========================
CREATE TABLE test_step (
                           test_step_id     SERIAL PRIMARY KEY,
                           test_id          INT NOT NULL,

    -- Step type
                           step_type        VARCHAR(40) NOT NULL,
    -- Values: BOUNDARY_DETECTION_RADIAL, COMPLIANCE_RADIAL, COMPLIANCE_TANGENTIAL

                           sequence_no      INT NOT NULL,

    -- Position parameters
                           angle            FLOAT,
                           cell_row         INT,
                           cell_col         INT,

    -- Distance measurements
                           distance_1       DOUBLE PRECISION,
                           distance_2       DOUBLE PRECISION,
                           distance_avg     DOUBLE PRECISION,

    -- Detection results
                           detection_1      BOOLEAN,
                           detection_2      BOOLEAN,
                           detection_final  BOOLEAN,

    -- Step status & timing
                           status           VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    -- Values: PENDING, RUNNING, COMPLETED, ERROR, SKIPPED
                           started_at       TIMESTAMP,
                           finished_at      TIMESTAMP,

                           CONSTRAINT fk_test_step_test
                               FOREIGN KEY (test_id)
                                   REFERENCES test (test_id)
                                   ON UPDATE CASCADE ON DELETE CASCADE,

                           CONSTRAINT chk_step_angle
                               CHECK (angle IS NULL OR (angle >= 0 AND angle < 360))
);

-- Index for resume / progress queries
CREATE INDEX idx_test_step_test_status
    ON test_step (test_id, step_type, status, sequence_no);

-- =========================
-- Radial Boundary Results (Summary)
-- =========================
CREATE TABLE radial_boundary (
                                 radial_id               SERIAL PRIMARY KEY,
                                 test_id                 INT NOT NULL,
                                 angle                   FLOAT,

    -- Detection measurements
                                 measurement1_2          DOUBLE PRECISION,
                                 measurement2_2          DOUBLE PRECISION,
                                 radial_detection1_avg   DOUBLE PRECISION,
                                 verdict1                DOUBLE PRECISION,

    -- Specification
                                 specification           DOUBLE PRECISION,

    -- Additional measurements
                                 measurement_3           DOUBLE PRECISION,
                                 measurement2_3          DOUBLE PRECISION,
                                 radial_detection2_avg   DOUBLE PRECISION,
                                 verdict2                DOUBLE PRECISION,

                                 CONSTRAINT fk_radial_test
                                     FOREIGN KEY (test_id)
                                         REFERENCES test (test_id)
                                         ON UPDATE CASCADE ON DELETE CASCADE,

                                 CONSTRAINT chk_radial_angle
                                     CHECK (angle IS NULL OR (angle >= 0 AND angle < 360))
);

-- Unique constraint: one boundary per test per angle
CREATE UNIQUE INDEX idx_radial_boundary_test_angle
    ON radial_boundary (test_id, angle);

-- =========================
-- Tangential Boundary Results (Summary)
-- =========================
CREATE TABLE tangential_boundary (
                                     tang_id           SERIAL PRIMARY KEY,
                                     test_id           INT NOT NULL,
                                     angle             FLOAT,

    -- Measurements at 2m
                                     measurement2m     DOUBLE PRECISION,
                                     verdict2m         DOUBLE PRECISION,

    -- Specification
                                     specification     DOUBLE PRECISION,

    -- Measurements at 3m
                                     measurement3m     DOUBLE PRECISION,
                                     verdict3m         DOUBLE PRECISION,

                                     measurement_time  TIMESTAMP,

                                     CONSTRAINT fk_tangential_test
                                         FOREIGN KEY (test_id)
                                             REFERENCES test (test_id)
                                             ON UPDATE CASCADE ON DELETE CASCADE,

                                     CONSTRAINT chk_tangent_angle
                                         CHECK (angle IS NULL OR (angle >= 0 AND angle < 360))
);

-- =========================
-- Test Log (Events & Debugging)
-- =========================
CREATE TABLE test_log (
                          test_log_id  SERIAL PRIMARY KEY,
                          test_id      INT NOT NULL,
                          test_step_id INT,
                          log_time     TIMESTAMP NOT NULL DEFAULT NOW(),
                          level        VARCHAR(10),
                            -- Values: INFO, WARN, ERROR
                          message      TEXT NOT NULL,

                          CONSTRAINT fk_test_log_test
                              FOREIGN KEY (test_id)
                                  REFERENCES test (test_id)
                                  ON UPDATE CASCADE ON DELETE CASCADE,

                          CONSTRAINT fk_test_log_step
                              FOREIGN KEY (test_step_id)
                                  REFERENCES test_step (test_step_id)
                                  ON UPDATE CASCADE ON DELETE SET NULL
);

-- =========================
-- Helper Views
-- =========================

-- View: Resumable Tests
CREATE OR REPLACE VIEW v_resumable_tests AS
SELECT
    t.test_id,
    t.test_name,
    t.status,
    ts.current_phase,
    ts.awaiting_confirmation,
    ts.completed_step_count,
    ts.last_completed_angle,
    ts.last_completed_distance,
    ts.last_position_x,
    ts.last_position_y,
    ts.last_position_timestamp,
    EXTRACT(EPOCH FROM (NOW() - ts.updated_at)) / 60 as minutes_since_paused,
    CASE
        WHEN ts.awaiting_confirmation THEN 'At user confirmation point'
        WHEN ts.current_phase = 'BOUNDARY_DETECTION' THEN 'Mid boundary detection'
        WHEN ts.current_phase = 'COMPLIANCE_TEST' THEN 'Mid compliance test'
        ELSE 'Unknown state'
        END as resume_point,
    CASE
        WHEN ts.last_position_x IS NOT NULL AND ts.last_position_y IS NOT NULL
            THEN format('(%.2f, %.2f)', ts.last_position_x, ts.last_position_y)
        ELSE 'Unknown'
        END as last_position
FROM test t
         JOIN test_state ts ON t.test_id = ts.test_id
WHERE t.status = 'PAUSED'
ORDER BY ts.updated_at DESC;

-- =========================
-- Table Comments
-- =========================

COMMENT ON TABLE sensor IS 'Catalog of sensors available for testing';
COMMENT ON TABLE test_choice IS 'Catalog of test types (EN 50131, etc.)';
COMMENT ON TABLE test IS 'Test instances - one row per test execution';
COMMENT ON TABLE test_state IS 'Test execution state with physical robot position for resume';
COMMENT ON TABLE test_step IS 'Individual measurements within a test';
COMMENT ON TABLE radial_boundary IS 'Summary of radial boundary detection results per angle';
COMMENT ON TABLE tangential_boundary IS 'Summary of tangential boundary detection results';
COMMENT ON TABLE test_log IS 'Event log for test execution and debugging';

COMMENT ON COLUMN test_state.current_phase IS 'Current phase: BOUNDARY_DETECTION, COMPLIANCE_TEST, or COMPLETED';
COMMENT ON COLUMN test_state.boundary_results IS 'JSON array of boundary detection results';
COMMENT ON COLUMN test_state.awaiting_confirmation IS 'True when waiting for user to continue to next phase';
COMMENT ON COLUMN test_state.last_completed_angle IS 'Last angle that was fully completed';
COMMENT ON COLUMN test_state.last_completed_distance IS 'Last distance that was tested';
COMMENT ON COLUMN test_state.completed_step_count IS 'Total completed measurements';
COMMENT ON COLUMN test_state.last_position_x IS 'Robot X coordinate at last save (meters)';
COMMENT ON COLUMN test_state.last_position_y IS 'Robot Y coordinate at last save (meters)';
COMMENT ON COLUMN test_state.last_position_timestamp IS 'Timestamp of last position save';

COMMENT ON VIEW v_resumable_tests IS 'Shows all tests that can be resumed with their last known position';
