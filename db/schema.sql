-- =========================
-- Sensor lookup
-- =========================
CREATE TABLE sensor (
                        sensor_id         SERIAL PRIMARY KEY,           -- auto-increment
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
-- Test choice (catalog of test types)
-- =========================
CREATE TABLE test_choice (
                             test_choice_id SERIAL PRIMARY KEY,              -- auto-increment
                             test_name      VARCHAR(50) NOT NULL,           -- e.g. "Radial boundary EN 50131"
                             test_standard  VARCHAR(50),
                             test_method    VARCHAR(25),
                             test_lab       VARCHAR(50)
);

-- =========================
-- Test header (one test instance)
-- =========================
CREATE TABLE test (
                      test_id     SERIAL PRIMARY KEY,                -- auto-increment
                      test_name   VARCHAR(50),                       -- optional human-readable name
                      test_choice INT NOT NULL,                      -- FK to test_choice
                      sensor_id   INT NOT NULL,                      -- FK to sensor
                      test_date   TIMESTAMP NOT NULL,                -- planned or created date

    -- status & timing for resume / history
                      status      VARCHAR(20) NOT NULL DEFAULT 'PLANNED',
    -- suggested values: PLANNED, RUNNING, STOPPED, COMPLETED, ABORTED
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
-- Test step (atomic unit of work inside a test)
-- Used for:
--  - boundary detection
--  - radial boundary at each angle
--  - tangential boundary
--  - movement/grid cells, etc.
-- =========================
CREATE TABLE test_step (
                           test_step_id     SERIAL PRIMARY KEY,           -- auto-increment
                           test_id          INT NOT NULL,                 -- FK to test

    -- what kind of step is this?
    -- examples: 'BOUNDARY_DETECTION_RADIAL',
    --           'RADIAL_BOUNDARY_FINAL',
    --           'TANGENTIAL_BOUNDARY',
    --           'TANGENTIAL_MOVEMENT'
                           step_type        VARCHAR(40) NOT NULL,

                           sequence_no      INT NOT NULL,                 -- order inside this test

    -- for angle-based tests
                           angle            INT,                          -- 0..359
    -- for grid-based tests (tangential movement)
                           cell_row         INT,
                           cell_col         INT,

    -- generic measurements for this step
                           distance_1       DOUBLE PRECISION,
                           distance_2       DOUBLE PRECISION,
                           distance_avg     DOUBLE PRECISION,             -- precomputed for easy CSV

                           detection_1      BOOLEAN,                      -- first attempt detection?
                           detection_2      BOOLEAN,                      -- second attempt detection?
                           detection_final  BOOLEAN,                      -- final verdict for this step

    -- status & timing of the step for resume/progress
                           status           VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    -- suggested values: PENDING, RUNNING, COMPLETED, ERROR, SKIPPED
                           started_at       TIMESTAMP,
                           finished_at      TIMESTAMP,

                           CONSTRAINT fk_test_step_test
                               FOREIGN KEY (test_id)
                                   REFERENCES test (test_id)
                                   ON UPDATE CASCADE ON DELETE CASCADE,

                           CONSTRAINT chk_step_angle
                               CHECK (angle IS NULL OR (angle >= 0 AND angle < 360))
);

-- Optional index to speed up resume / listing
CREATE INDEX idx_test_step_test_status
    ON test_step (test_id, step_type, status, sequence_no);

-- =========================
-- Radial Boundary results (summary per test / per angle)
-- You can fill this from aggregated test_step rows of type 'RADIAL_BOUNDARY_FINAL'
-- =========================
CREATE TABLE radial_boundary (
                                 radial_id               SERIAL PRIMARY KEY,    -- auto-increment
                                 test_id                 INT NOT NULL,          -- FK to test
                                 angle                   INT,                   -- angle for this boundary result

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

-- =========================
-- Tangential Boundary results (summary)
-- Typically one row per angle or per test,
-- filled after all relevant test_step rows are completed.
-- =========================
CREATE TABLE tangential_boundary (
                                     tang_id           SERIAL PRIMARY KEY,          -- auto-increment
                                     test_id           INT NOT NULL,                -- FK to test

                                     angle             INT,                         -- angle if applicable
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

-- =========================
-- OPTIONAL: Test log (messages / events during a test)
-- Good for debugging and UI notifications.
-- =========================
CREATE TABLE test_log (
                          test_log_id  SERIAL PRIMARY KEY,
                          test_id      INT NOT NULL,                     -- FK to test
                          test_step_id INT,                              -- optional FK to step
                          log_time     TIMESTAMP NOT NULL DEFAULT NOW(),
                          level        VARCHAR(10),                      -- INFO, WARN, ERROR
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
