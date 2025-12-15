-- ============================================================
--  SENSOR TABLE
-- ============================================================
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
                        connection_type   VARCHAR(10),

                        CONSTRAINT sensor_mounting_height_nonneg
                            CHECK (mounting_height >= 0)
);

COMMENT ON TABLE sensor IS 'Sensor configuration and metadata. Tracks PIR sensors and other detection devices';
COMMENT ON COLUMN sensor.connection_type IS 'Connection type: BLE or SERIAL';

-- ============================================================
--  TEST CHOICE CATALOG
-- ============================================================
CREATE TABLE test_choice (
                             test_choice_id SERIAL PRIMARY KEY,
                             test_name      VARCHAR(50) NOT NULL,
                             test_standard  VARCHAR(50),
                             test_method    VARCHAR(25),
                             test_lab       VARCHAR(50)
);

COMMENT ON TABLE test_choice IS 'Catalog of test types (EN 50131, etc.)';

-- ============================================================
--  TEST HEADER
-- ============================================================
CREATE TABLE test (
                      test_id     SERIAL PRIMARY KEY,
                      test_name   VARCHAR(50),
                      test_choice INT NOT NULL,
                      sensor_id   INT NOT NULL,
                      test_date   TIMESTAMP NOT NULL,

                      -- Newer naming used by analysis/export features
                      test_type   VARCHAR(20) DEFAULT 'FULL',

                      status      VARCHAR(20) NOT NULL DEFAULT 'PLANNED',
                      started_at  TIMESTAMP,
                      finished_at TIMESTAMP,

                      -- Backwards/forwards-compatible aliases
                      test_status VARCHAR(20) GENERATED ALWAYS AS (status) STORED,
                      start_time  TIMESTAMP GENERATED ALWAYS AS (started_at) STORED,
                      end_time    TIMESTAMP GENERATED ALWAYS AS (finished_at) STORED,

                      CONSTRAINT fk_test_choice
                          FOREIGN KEY (test_choice)
                              REFERENCES test_choice (test_choice_id)
                              ON UPDATE RESTRICT ON DELETE RESTRICT,

                      CONSTRAINT fk_test_sensor
                          FOREIGN KEY (sensor_id)
                              REFERENCES sensor (sensor_id)
                              ON UPDATE RESTRICT ON DELETE RESTRICT
);

COMMENT ON TABLE test IS 'Test instances - one row per test execution';
COMMENT ON COLUMN test.test_type IS 'Test type: BOUNDARY_DETECTION, TANGENTIAL_TEST, RADIAL_TEST, GRID_TANGENTIAL';
COMMENT ON COLUMN test.test_status IS 'Test status: PLANNED, RUNNING, PAUSED, COMPLETED, FAILED, ABORTED';

-- ============================================================
--  TEST STATE (RESUME SUPPORT)
-- ============================================================
CREATE TABLE test_state (
                            test_id INTEGER PRIMARY KEY,

                            current_phase VARCHAR(30) NOT NULL,
                            execution_state VARCHAR(30) DEFAULT 'IDLE',
                            boundary_results JSONB,
                            awaiting_confirmation BOOLEAN DEFAULT FALSE,

                            last_completed_angle FLOAT,
                            last_completed_distance FLOAT,
                            completed_step_count INTEGER DEFAULT 0,

                            last_position_x FLOAT,
                            last_position_y FLOAT,
                            last_position_timestamp TIMESTAMP,

                            state_data JSONB,

                            created_at TIMESTAMP DEFAULT NOW(),
                            updated_at TIMESTAMP DEFAULT NOW(),

                            CONSTRAINT fk_test_state_test
                                FOREIGN KEY (test_id)
                                    REFERENCES test (test_id)
                                    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX idx_test_state_phase ON test_state (current_phase, awaiting_confirmation);
CREATE INDEX idx_test_state_execution_state ON test_state (execution_state);
CREATE INDEX idx_test_state_updated ON test_state (updated_at);
CREATE INDEX idx_test_state_position ON test_state (last_position_x, last_position_y);

COMMENT ON TABLE test_state IS 'Test execution state with physical robot position for resume';
COMMENT ON COLUMN test_state.current_phase IS 'Current test phase: BOUNDARY_DETECTION, TANGENTIAL_TEST, RADIAL_TEST, COMPLETED';
COMMENT ON COLUMN test_state.execution_state IS 'Test execution state: IDLE, BOUNDARY_RUNNING, BOUNDARY_PAUSED, BOUNDARY_COMPLETE, TANGENTIAL_RUNNING, TANGENTIAL_PAUSED, TANGENTIAL_COMPLETE, RADIAL_RUNNING, RADIAL_PAUSED, RADIAL_COMPLETE, ALL_COMPLETE, ERROR';

-- ============================================================
--  TEST STEP
-- ============================================================
CREATE TABLE test_step (
                           test_step_id     SERIAL PRIMARY KEY,
                           test_id          INT NOT NULL,
                           step_type        VARCHAR(40) NOT NULL,
                           sequence_no      INT NOT NULL,

                           angle            FLOAT,
                           cell_row         INT,
                           cell_col         INT,
                           cell_x           DOUBLE PRECISION,
                           cell_y           DOUBLE PRECISION,

                           distance_1       DOUBLE PRECISION,
                           distance_2       DOUBLE PRECISION,
                           distance_avg     DOUBLE PRECISION,

                           detection_1      BOOLEAN,
                           detection_2      BOOLEAN,
                           detection_final  BOOLEAN,

                           status           VARCHAR(20) NOT NULL DEFAULT 'PENDING',
                           started_at       TIMESTAMP,
                           finished_at      TIMESTAMP,

                           -- Newer naming used by analysis/export features
                           repeat_number    INT GENERATED ALWAYS AS (sequence_no) STORED,
                           distance_to_sensor DOUBLE PRECISION GENERATED ALWAYS AS (distance_1) STORED,
                           detection_occurred BOOLEAN GENERATED ALWAYS AS (detection_final) STORED,
                           recorded_at      TIMESTAMP GENERATED ALWAYS AS (finished_at) STORED,

                           CONSTRAINT fk_test_step_test
                               FOREIGN KEY (test_id)
                                   REFERENCES test (test_id)
                                   ON UPDATE CASCADE ON DELETE CASCADE,

                           CONSTRAINT chk_step_angle
                               CHECK (angle IS NULL OR (angle >= 0 AND angle < 360))
);

CREATE INDEX idx_test_step_test_status
    ON test_step (test_id, step_type, status, sequence_no);

CREATE INDEX idx_test_step_grid_coordinates
    ON test_step (cell_x, cell_y)
    WHERE cell_x IS NOT NULL AND cell_y IS NOT NULL;

COMMENT ON TABLE test_step IS 'Individual measurements within a test';
COMMENT ON COLUMN test_step.step_type IS 'Step type: BOUNDARY_DETECTION_TANGENTIAL, GRID_TANGENTIAL, COMPLIANCE_RADIAL';
COMMENT ON COLUMN test_step.angle IS 'Angle in degrees (0-360)';
COMMENT ON COLUMN test_step.cell_x IS 'Grid cell center X coordinate in meters (for GRID_TANGENTIAL tests)';
COMMENT ON COLUMN test_step.cell_y IS 'Grid cell center Y coordinate in meters (for GRID_TANGENTIAL tests)';
COMMENT ON COLUMN test_step.detection_occurred IS 'Detection at this step (true/false)';

-- ============================================================
--  RADIAL BOUNDARY SUMMARY
-- ============================================================
CREATE TABLE radial_boundary (
                                 radial_id               SERIAL PRIMARY KEY,
                                 test_id                 INT NOT NULL,
                                 angle                   FLOAT,

                                 measurement1_2          DOUBLE PRECISION,
                                 measurement2_2          DOUBLE PRECISION,
                                 radial_detection1_avg   DOUBLE PRECISION,
                                 verdict1                DOUBLE PRECISION,

                                 specification           DOUBLE PRECISION,

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

CREATE UNIQUE INDEX idx_radial_boundary_test_angle
    ON radial_boundary (test_id, angle);

COMMENT ON TABLE radial_boundary IS 'Summary of radial boundary detection results per angle';

-- ============================================================
--  TANGENTIAL BOUNDARY SUMMARY
-- ============================================================
CREATE TABLE tangential_boundary (
                                     tang_id           SERIAL PRIMARY KEY,
                                     test_id           INT NOT NULL,
                                     angle             FLOAT,

                                     measurement2m     DOUBLE PRECISION,
                                     verdict2m         DOUBLE PRECISION,

                                     specification     DOUBLE PRECISION,

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

COMMENT ON TABLE tangential_boundary IS 'Summary of tangential boundary detection results';

-- ============================================================
--  TEST LOG
-- ============================================================
CREATE TABLE test_log (
                          test_log_id  SERIAL PRIMARY KEY,
                          test_id      INT NOT NULL,
                          test_step_id INT,
                          log_time     TIMESTAMP NOT NULL DEFAULT NOW(),
                          level        VARCHAR(10),
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

COMMENT ON TABLE test_log IS 'Event log for test execution and debugging';

-- ============================================================
--  DEAD TIME LOG
-- ============================================================
CREATE TABLE dead_time_log (
                               log_id SERIAL PRIMARY KEY,
                               test_id INT NOT NULL,
                               test_step_id INT,
                               timestamp TIMESTAMP NOT NULL DEFAULT NOW(),

                               reason VARCHAR(50) NOT NULL,
                               duration_ms INT NOT NULL,
                               metadata JSONB,

                               CONSTRAINT fk_deadtime_test
                                   FOREIGN KEY (test_id)
                                       REFERENCES test (test_id)
                                       ON DELETE CASCADE,

                               CONSTRAINT fk_deadtime_step
                                   FOREIGN KEY (test_step_id)
                                       REFERENCES test_step (test_step_id)
                                       ON DELETE CASCADE,

                               CONSTRAINT chk_duration_positive
                                   CHECK (duration_ms > 0),

                               CONSTRAINT chk_reason_valid
                                   CHECK (reason IN (
                                                     'SENSOR_RECOVERY',
                                                     'MOVEMENT_SETTLING',
                                                     'DATA_ACQUISITION',
                                                     'IEC_COMPLIANCE',
                                                     'GRID_CELL_PAUSE',
                                                     'PHASE_TRANSITION'
                                       ))
);

CREATE INDEX idx_deadtime_test ON dead_time_log (test_id);
CREATE INDEX idx_deadtime_test_time ON dead_time_log (test_id, timestamp);
CREATE INDEX idx_deadtime_reason ON dead_time_log (reason);

COMMENT ON TABLE dead_time_log IS 'Dead time required during tests (IEC compliance)';

-- ============================================================
--  TELEMETRY SAMPLE (MERGED)
-- ============================================================
CREATE TABLE telemetry_sample (
                                  telemetry_id SERIAL PRIMARY KEY,
                                  test_id INT NOT NULL,
                                  test_step_id INT,
                                  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),

                                  ambient_temp DOUBLE PRECISION,
                                  humidity DOUBLE PRECISION,

                                  head_temp_avg DOUBLE PRECISION,
                                  head_temp_min DOUBLE PRECISION,
                                  head_temp_max DOUBLE PRECISION,
                                  head_enabled BOOLEAN,
                                  head_power_level DOUBLE PRECISION,
                                  head_target_temp DOUBLE PRECISION,

                                  body_temp_avg DOUBLE PRECISION,
                                  body_temp_min DOUBLE PRECISION,
                                  body_temp_max DOUBLE PRECISION,
                                  body_enabled BOOLEAN,
                                  body_power_level DOUBLE PRECISION,
                                  body_target_temp DOUBLE PRECISION,

                                  legs_temp_avg DOUBLE PRECISION,
                                  legs_temp_min DOUBLE PRECISION,
                                  legs_temp_max DOUBLE PRECISION,
                                  legs_enabled BOOLEAN,
                                  legs_power_level DOUBLE PRECISION,
                                  legs_target_temp DOUBLE PRECISION,

                                  detector_angle DOUBLE PRECISION,
                                  robot_position_x DOUBLE PRECISION,
                                  robot_position_y DOUBLE PRECISION,

                                  detection_active BOOLEAN,

                                  CONSTRAINT fk_telemetry_test
                                      FOREIGN KEY (test_id)
                                          REFERENCES test (test_id)
                                          ON UPDATE CASCADE ON DELETE CASCADE,

                                  CONSTRAINT fk_telemetry_step
                                      FOREIGN KEY (test_step_id)
                                          REFERENCES test_step (test_step_id)
                                          ON UPDATE CASCADE ON DELETE SET NULL,

                                  CONSTRAINT chk_ambient_temp
                                      CHECK (ambient_temp IS NULL OR ambient_temp BETWEEN -50 AND 100),

                                  CONSTRAINT chk_humidity
                                      CHECK (humidity IS NULL OR humidity BETWEEN 0 AND 100),

                                  CONSTRAINT chk_detector_angle
                                      CHECK (detector_angle IS NULL OR (detector_angle >= 0 AND detector_angle < 360)),

                                  CONSTRAINT chk_head_power
                                      CHECK (head_power_level IS NULL OR (head_power_level BETWEEN 0 AND 100)),

                                  CONSTRAINT chk_body_power
                                      CHECK (body_power_level IS NULL OR (body_power_level BETWEEN 0 AND 100)),

                                  CONSTRAINT chk_legs_power
                                      CHECK (legs_power_level IS NULL OR (legs_power_level BETWEEN 0 AND 100))
);

CREATE INDEX idx_telemetry_test_time
    ON telemetry_sample (test_id, timestamp);

CREATE INDEX idx_telemetry_step
    ON telemetry_sample (test_step_id);

CREATE INDEX idx_telemetry_timestamp
    ON telemetry_sample (timestamp DESC);

CREATE INDEX idx_telemetry_position
    ON telemetry_sample (robot_position_x, robot_position_y);

COMMENT ON TABLE telemetry_sample IS 'Environmental and system telemetry recorded during tests';

-- ============================================================
--  VIEWS
-- ============================================================

CREATE OR REPLACE VIEW v_latest_telemetry AS
SELECT DISTINCT ON (test_id)
    telemetry_id,
    test_id,
    test_step_id,
    timestamp,
    ambient_temp,
    humidity,
    head_temp_avg,
    body_temp_avg,
    legs_temp_avg,
    detector_angle,
    robot_position_x,
    robot_position_y,
    detection_active
FROM telemetry_sample
ORDER BY test_id, timestamp DESC;

CREATE OR REPLACE VIEW v_telemetry_summary AS
SELECT
    test_id,
    COUNT(*) AS sample_count,
    MIN(timestamp) AS first_sample,
    MAX(timestamp) AS last_sample,
    EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp))) AS duration_seconds,

    AVG(ambient_temp) AS avg_ambient_temp,
    MIN(ambient_temp) AS min_ambient_temp,
    MAX(ambient_temp) AS max_ambient_temp,

    AVG(humidity) AS avg_humidity,

    AVG(head_temp_avg) AS avg_head_temp,
    AVG(body_temp_avg) AS avg_body_temp,
    AVG(legs_temp_avg) AS avg_legs_temp,

    COUNT(CASE WHEN detection_active THEN 1 END) AS detection_count,
    COUNT(CASE WHEN detection_active THEN 1 END)::FLOAT / NULLIF(COUNT(*),0) * 100 AS detection_rate_percent
FROM telemetry_sample
GROUP BY test_id;

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
    EXTRACT(EPOCH FROM (NOW() - ts.updated_at))/60 AS minutes_since_paused
FROM test t
         JOIN test_state ts ON t.test_id = ts.test_id
WHERE t.status = 'PAUSED'
ORDER BY ts.updated_at DESC;

CREATE OR REPLACE VIEW v_test_timing_summary AS
SELECT
    t.test_id,
    t.test_name,
    t.test_type,
    t.start_time,
    t.end_time,
    EXTRACT(EPOCH FROM (t.end_time - t.start_time)) AS total_duration_seconds,
    COUNT(dtl.log_id) AS dead_time_count,
    COALESCE(SUM(dtl.duration_ms),0) AS total_dead_time_ms,
    COALESCE(SUM(dtl.duration_ms),0)/1000.0 AS total_dead_time_seconds,
    CASE WHEN EXTRACT(EPOCH FROM (t.end_time - t.start_time)) > 0
             THEN (COALESCE(SUM(dtl.duration_ms),0)/1000.0) /
                  EXTRACT(EPOCH FROM (t.end_time - t.start_time)) * 100
         ELSE 0 END AS dead_time_percentage,
    EXTRACT(EPOCH FROM (t.end_time - t.start_time))
        - (COALESCE(SUM(dtl.duration_ms),0)/1000.0) AS active_time_seconds
FROM test t
         LEFT JOIN dead_time_log dtl ON t.test_id = dtl.test_id
WHERE t.test_status = 'COMPLETED'
GROUP BY t.test_id, t.test_name, t.test_type, t.start_time, t.end_time;

CREATE OR REPLACE VIEW v_dead_time_breakdown AS
SELECT
    test_id,
    reason,
    COUNT(*) AS occurrence_count,
    SUM(duration_ms) AS total_duration_ms,
    AVG(duration_ms) AS avg_duration_ms,
    MIN(duration_ms) AS min_duration_ms,
    MAX(duration_ms) AS max_duration_ms
FROM dead_time_log
GROUP BY test_id, reason
ORDER BY test_id, total_duration_ms DESC;

