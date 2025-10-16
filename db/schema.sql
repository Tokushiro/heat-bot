-- =========================
-- Sensor lookup
-- =========================
CREATE TABLE sensor (
                        sensor_id         SERIAL PRIMARY KEY,  -- auto-increment
                        name              VARCHAR(50) NOT NULL,
                        manufacturer      VARCHAR(25) NOT NULL,
                        product_reference VARCHAR(20),
                        description       VARCHAR(50),
                        hw_version        VARCHAR(10),
                        sw_version        VARCHAR(10),
                        mounting_height   DOUBLE PRECISION NOT NULL,
                        note              VARCHAR(25),
                        CONSTRAINT sensor_mounting_height_nonneg CHECK (mounting_height >= 0)
);

-- =========================
-- Test choice
-- =========================
CREATE TABLE test_choice (
                             test_choice_id SERIAL PRIMARY KEY,     -- auto-increment
                             test_standard  VARCHAR(50),
                             test_method    VARCHAR(25),
                             test_lab       VARCHAR(50)
);

-- =========================
-- Test header
-- =========================
CREATE TABLE test (
                      test_id     SERIAL PRIMARY KEY,        -- auto-increment
                      test_name   VARCHAR(50),
                      test_choice INT NOT NULL,
                      sensor_id   INT NOT NULL,
                      CONSTRAINT fk_test_choice
                          FOREIGN KEY (test_choice) REFERENCES test_choice (test_choice_id)
                              ON UPDATE RESTRICT ON DELETE RESTRICT,
                      CONSTRAINT fk_test_sensor
                          FOREIGN KEY (sensor_id)   REFERENCES sensor (sensor_id)
                              ON UPDATE RESTRICT ON DELETE RESTRICT
);

-- =========================
-- Radial Boundary results
-- =========================
CREATE TABLE radial_boundary (
                                 radial_id               SERIAL PRIMARY KEY,  -- auto-increment
                                 test_id                 INT NOT NULL,
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
                                     FOREIGN KEY (test_id) REFERENCES test (test_id)
                                         ON UPDATE CASCADE ON DELETE CASCADE
);

-- =========================
-- Tangential Boundary results
-- =========================
CREATE TABLE tangential_boundary (
                                     tang_id           SERIAL PRIMARY KEY,  -- auto-increment
                                     test_id           INT NOT NULL,
                                     angle             INT,
                                     measurement2m     DOUBLE PRECISION,
                                     verdict2m         DOUBLE PRECISION,
                                     specification     DOUBLE PRECISION,
                                     measurement3m     DOUBLE PRECISION,
                                     verdict3m         DOUBLE PRECISION,
                                     measurement_time  TIMESTAMP,
                                     CONSTRAINT fk_tangential_test
                                         FOREIGN KEY (test_id) REFERENCES test (test_id)
                                             ON UPDATE CASCADE ON DELETE CASCADE,
                                     CONSTRAINT chk_tangent_angle
                                         CHECK (angle IS NULL OR (angle >= 0 AND angle < 360))
);