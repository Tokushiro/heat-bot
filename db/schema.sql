-- ===============================================
    -- HEAT Bot Enhanced Database Schema
    -- ===============================================
    -- This schema includes all original tables plus new tables for:
    -- - Test resume functionality (checkpoints)
    -- - Event logging and audit trail
    -- - Individual measurement tracking
    -- ===============================================

    -- -------------------------
    -- Existing Tables (Preserved)
    -- -------------------------

    -- Sensor table (unchanged)
    CREATE TABLE IF NOT EXISTS sensor (
        sensor_id SERIAL PRIMARY KEY,
        mac VARCHAR(17) UNIQUE NOT NULL,
        name VARCHAR(100),
        location VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Test choice table (unchanged)
    CREATE TABLE IF NOT EXISTS test_choice (
        test_choice_id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        radial_points INTEGER NOT NULL CHECK (radial_points > 0),
        tangential_start NUMERIC(10,2) NOT NULL,
        tangential_end NUMERIC(10,2) NOT NULL CHECK (tangential_end > tangential_start),
        tangential_step NUMERIC(10,2) NOT NULL CHECK (tangential_step > 0),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Test table (ENHANCED with resume fields)
    CREATE TABLE IF NOT EXISTS test (
        test_id SERIAL PRIMARY KEY,
        test_choice_id INTEGER NOT NULL REFERENCES test_choice(test_choice_id) ON DELETE CASCADE,
        sensor_id INTEGER NOT NULL REFERENCES sensor(sensor_id) ON DELETE CASCADE,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        finished_at TIMESTAMP,

        -- NEW FIELDS for resume functionality
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'interrupted', 'failed')),
        can_resume BOOLEAN DEFAULT FALSE,
        interrupted_reason TEXT,
        completed_at TIMESTAMP,

        -- Computed field for duration (seconds)
        duration_seconds INTEGER GENERATED ALWAYS AS (
            CASE
                WHEN finished_at IS NOT NULL THEN CAST(EXTRACT(EPOCH FROM (finished_at - started_at)) AS INTEGER)
                ELSE NULL
            END
        ) STORED
    );

    -- Create indexes for test table
    CREATE INDEX IF NOT EXISTS idx_test_status ON test(status);
    CREATE INDEX IF NOT EXISTS idx_test_can_resume ON test(can_resume);
    CREATE INDEX IF NOT EXISTS idx_test_started_at ON test(started_at);

    -- Radial boundary table (unchanged)
    CREATE TABLE IF NOT EXISTS radial_boundary (
        radial_boundary_id SERIAL PRIMARY KEY,
        test_id INTEGER NOT NULL REFERENCES test(test_id) ON DELETE CASCADE,
        angle NUMERIC(10,2) NOT NULL,
        distance NUMERIC(10,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (test_id, angle)
    );

    -- Tangential boundary table (unchanged)
    CREATE TABLE IF NOT EXISTS tangential_boundary (
        tangential_boundary_id SERIAL PRIMARY KEY,
        test_id INTEGER NOT NULL REFERENCES test(test_id) ON DELETE CASCADE,
        distance NUMERIC(10,2) NOT NULL,
        angle_min NUMERIC(10,2),
        angle_max NUMERIC(10,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (test_id, distance)
    );

    -- -------------------------
    -- NEW TABLES for Resume Functionality
    -- -------------------------

    -- Test checkpoints - stores resume points
    CREATE TABLE IF NOT EXISTS test_checkpoint (
        checkpoint_id SERIAL PRIMARY KEY,
        test_id INTEGER NOT NULL REFERENCES test(test_id) ON DELETE CASCADE,
        phase VARCHAR(50) NOT NULL CHECK (phase IN ('radial_boundary', 'tangential_boundary')),
        checkpoint_data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Create index for fast checkpoint retrieval
    CREATE INDEX IF NOT EXISTS idx_checkpoint_test_created ON test_checkpoint(test_id, created_at DESC);

    -- Test event log - audit trail of all test events
    CREATE TABLE IF NOT EXISTS test_event_log (
        event_id SERIAL PRIMARY KEY,
        test_id INTEGER NOT NULL REFERENCES test(test_id) ON DELETE CASCADE,
        event_type VARCHAR(50) NOT NULL CHECK (
            event_type IN (
                'test_started', 'test_completed', 'test_interrupted', 'test_resumed',
                'phase_started', 'phase_completed', 'measurement_taken', 'measurement_retry',
                'checkpoint_saved', 'error_occurred', 'battery_low', 'connection_lost'
            )
        ),
        message TEXT NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Create indexes for event log
    CREATE INDEX IF NOT EXISTS idx_event_test_type ON test_event_log(test_id, event_type);
    CREATE INDEX IF NOT EXISTS idx_event_created_at ON test_event_log(created_at DESC);

    -- Measurement results - detailed measurement tracking
    CREATE TABLE IF NOT EXISTS measurement_result (
        measurement_id SERIAL PRIMARY KEY,
        test_id INTEGER NOT NULL REFERENCES test(test_id) ON DELETE CASCADE,
        phase VARCHAR(50) NOT NULL CHECK (phase IN ('radial_boundary', 'tangential_boundary')),
        angle NUMERIC(10,2) NOT NULL,
        distance NUMERIC(10,2),
        detected BOOLEAN NOT NULL,
        attempt_number INTEGER NOT NULL DEFAULT 1,
        measurement_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sensor_data JSONB,
        UNIQUE (test_id, phase, angle, attempt_number)
    );

    -- Create indexes for measurement results
    CREATE INDEX IF NOT EXISTS idx_measurement_test_phase ON measurement_result(test_id, phase);
    CREATE INDEX IF NOT EXISTS idx_measurement_time ON measurement_result(measurement_time DESC);

    -- -------------------------
    -- Helper Functions
    -- -------------------------

    -- Function to get the latest checkpoint for a test
    CREATE OR REPLACE FUNCTION get_latest_checkpoint(p_test_id INTEGER)
    RETURNS TABLE (
        checkpoint_id INTEGER,
        phase VARCHAR(50),
        checkpoint_data JSONB,
        created_at TIMESTAMP
    ) AS $$
    BEGIN
        RETURN QUERY
        SELECT
            tc.checkpoint_id,
            tc.phase,
            tc.checkpoint_data,
            tc.created_at
        FROM test_checkpoint tc
        WHERE tc.test_id = p_test_id
        ORDER BY tc.created_at DESC
        LIMIT 1;
    END;
    $$ LANGUAGE plpgsql;

    -- Function to mark test as interrupted
    CREATE OR REPLACE FUNCTION mark_test_interrupted(
        p_test_id INTEGER,
        p_reason TEXT
    ) RETURNS VOID AS $$
    BEGIN
        UPDATE test
        SET
            status = 'interrupted',
            can_resume = TRUE,
            interrupted_reason = p_reason
        WHERE test_id = p_test_id;

        -- Log the event
        INSERT INTO test_event_log (test_id, event_type, message, metadata)
        VALUES (
            p_test_id,
            'test_interrupted',
            'Test interrupted: ' || p_reason,
            jsonb_build_object('reason', p_reason, 'timestamp', NOW())
        );
    END;
    $$ LANGUAGE plpgsql;

    -- Function to mark test as resumed
    CREATE OR REPLACE FUNCTION mark_test_resumed(p_test_id INTEGER)
    RETURNS VOID AS $$
    BEGIN
        UPDATE test
        SET
            status = 'running',
            can_resume = FALSE
        WHERE test_id = p_test_id;

        -- Log the event
        INSERT INTO test_event_log (test_id, event_type, message)
        VALUES (p_test_id, 'test_resumed', 'Test resumed from checkpoint');
    END;
    $$ LANGUAGE plpgsql;

    -- Function to mark test as completed
    CREATE OR REPLACE FUNCTION mark_test_completed(p_test_id INTEGER)
    RETURNS VOID AS $$
    BEGIN
        UPDATE test
        SET
            status = 'completed',
            can_resume = FALSE,
            finished_at = NOW(),
            completed_at = NOW()
        WHERE test_id = p_test_id;

        -- Log the event
        INSERT INTO test_event_log (test_id, event_type, message)
        VALUES (p_test_id, 'test_completed', 'Test completed successfully');
    END;
    $$ LANGUAGE plpgsql;

    -- -------------------------
    -- Sample Data (Optional)
    -- -------------------------

    -- Insert a sample sensor
    INSERT INTO sensor (mac, name, location)
    VALUES ('AA:BB:CC:DD:EE:FF', 'Niko PIR Sensor', 'Lab Test Area')
    ON CONFLICT (mac) DO NOTHING;

    -- Insert a sample test choice
    INSERT INTO test_choice (name, description, radial_points, tangential_start, tangential_end, tangential_step)
    VALUES (
        'Standard Test',
        'Standard boundary test with 8 radial points',
        8,
        1.0,
        5.0,
        0.5
    )
    ON CONFLICT DO NOTHING;

    -- -------------------------
    -- Permissions (Optional)
    -- -------------------------

    -- Grant permissions to your application user
    -- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_app_user;
    -- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_app_user;

    -- -------------------------
    -- Schema Version
    -- -------------------------

    -- Create a version table to track schema changes
    CREATE TABLE IF NOT EXISTS schema_version (
        version_id SERIAL PRIMARY KEY,
        version VARCHAR(20) NOT NULL,
        description TEXT,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Record this schema version
    INSERT INTO schema_version (version, description)
    VALUES ('2.0.0', 'Enhanced schema with resume functionality, event logging, and measurement tracking');
    -- ===============================================
    -- End of Schema
    -- ===============================================