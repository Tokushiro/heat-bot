import React, { useState } from 'react';
import { Card, Radio, InputNumber, Space, Button, Divider, Alert } from 'antd';
import '../Styles/TestProfileSelector.css';


export type TestProfile = 'BOUNDARY_TANGENTIAL' | 'GRID_TANGENTIAL' | 'RADIAL_POLAR';

interface BoundaryConfig {
    minDistance: number;        // Minimum test distance (m)
    maxDistance: number;        // Maximum test distance (m)
    angleStep: number;          // Angle step (degrees)
    speed: number;              // Movement speed (m/s)
    repeatMeasurements: number; // Number of repeats per angle
}

interface GridConfig {
    gridWidth: number;          // Grid width (m)
    gridHeight: number;         // Grid height (m)
    cellSize: number;           // Cell size (m)
    angleStep: number;          // Stand rotation step (degrees)
    dwellTime: number;          // Dwell time at each angle (ms)
    coverageThreshold: number;  // Required coverage % to pass
    maxAttempts: number;        // Max attempts per cell
}

interface RadialConfig {
    startDistance: number;      // Start distance (m)
    endDistance: number;        // End distance (m)
    distanceStep: number;       // Distance increment (m)
    angleStep: number;          // Angle step (degrees)
    speed: number;              // Movement speed (m/s)
    repeatMeasurements: number; // Number of repeats
}

export interface TestProfileConfig {
    profile: TestProfile;
    boundary?: BoundaryConfig;
    grid?: GridConfig;
    radial?: RadialConfig;
}

interface TestProfileSelectorProps {
    onConfigChange?: (config: TestProfileConfig) => void;
    onStart?: (config: TestProfileConfig) => void;
}

const TestProfileSelector: React.FC<TestProfileSelectorProps> = ({
    onConfigChange,
    onStart
}) => {
    // Selected profile
    const [profile, setProfile] = useState<TestProfile>('BOUNDARY_TANGENTIAL');

    // Boundary detection configuration
    const [boundaryConfig, setBoundaryConfig] = useState<BoundaryConfig>({
        minDistance: 0.5,
        maxDistance: 4.0,
        angleStep: 10,
        speed: 0.5,
        repeatMeasurements: 2
    });

    // Grid tangential configuration
    const [gridConfig, setGridConfig] = useState<GridConfig>({
        gridWidth: 3.0,
        gridHeight: 3.0,
        cellSize: 0.5,
        angleStep: 10,
        dwellTime: 2000,
        coverageThreshold: 80,
        maxAttempts: 2
    });

    // Radial polar configuration
    const [radialConfig, setRadialConfig] = useState<RadialConfig>({
        startDistance: 0.5,
        endDistance: 4.0,
        distanceStep: 0.25,
        angleStep: 15,
        speed: 0.5,
        repeatMeasurements: 2
    });

    /**
     * Handle profile change
     */
    const handleProfileChange = (newProfile: TestProfile) => {
        setProfile(newProfile);

        if (onConfigChange) {
            onConfigChange(getConfig(newProfile));
        }
    };

    /**
     * Get current configuration
     */
    const getConfig = (selectedProfile: TestProfile = profile): TestProfileConfig => {
        const config: TestProfileConfig = { profile: selectedProfile };

        if (selectedProfile === 'BOUNDARY_TANGENTIAL') {
            config.boundary = boundaryConfig;
        } else if (selectedProfile === 'GRID_TANGENTIAL') {
            config.grid = gridConfig;
        } else if (selectedProfile === 'RADIAL_POLAR') {
            config.radial = radialConfig;
        }

        return config;
    };

    /**
     * Handle start button click
     */
    const handleStart = () => {
        if (onStart) {
            onStart(getConfig());
        }
    };

    /**
     * Notify config change
     */
    const notifyConfigChange = () => {
        if (onConfigChange) {
            onConfigChange(getConfig());
        }
    };

    return (
        <div className="test-profile-selector">
            <Card title="Test Profile Selection" className="profile-card">
                {/* Profile Selection */}
                <div className="profile-selection">
                    <Radio.Group
                        value={profile}
                        onChange={(e) => handleProfileChange(e.target.value)}
                        size="large"
                    >
                        <Space direction="vertical" size="middle">
                            <Radio value="BOUNDARY_TANGENTIAL">
                                <div className="profile-option">
                                    <strong>Boundary Detection - Tangential</strong>
                                    <div className="profile-description">
                                        Determines detection boundary by moving tangentially at various distances
                                    </div>
                                </div>
                            </Radio>

                            <Radio value="GRID_TANGENTIAL">
                                <div className="profile-option">
                                    <strong>Movement Detection - Tangential (Grid)</strong>
                                    <div className="profile-description">
                                        0.5m × 0.5m grid-based coverage test with cell-by-cell verification
                                    </div>
                                </div>
                            </Radio>

                            <Radio value="RADIAL_POLAR">
                                <div className="profile-option">
                                    <strong>Movement Detection - Radial (Polar)</strong>
                                    <div className="profile-description">
                                        Radial approach at multiple angles to measure detection range vs angle
                                    </div>
                                </div>
                            </Radio>
                        </Space>
                    </Radio.Group>
                </div>

                <Divider />

                {/* Configuration based on selected profile */}
                <div className="profile-configuration">
                    <h3>Test Parameters</h3>

                    {/* Boundary Detection Configuration */}
                    {profile === 'BOUNDARY_TANGENTIAL' && (
                        <div className="config-section">
                            <Alert
                                message="Boundary Detection Test"
                                description="Performs tangential sweeps at increasing distances to find detection boundary. Uses binary search for efficiency."
                                type="info"
                                showIcon
                                style={{ marginBottom: 20 }}
                            />

                            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                                <div className="config-item">
                                    <label>Minimum Distance (m):</label>
                                    <InputNumber
                                        min={0.1}
                                        max={10}
                                        step={0.1}
                                        value={boundaryConfig.minDistance}
                                        onChange={(value) => {
                                            setBoundaryConfig({ ...boundaryConfig, minDistance: value || 0.5 });
                                            notifyConfigChange();
                                        }}
                                    />
                                    <span className="config-hint">Start testing from this distance</span>
                                </div>

                                <div className="config-item">
                                    <label>Maximum Distance (m):</label>
                                    <InputNumber
                                        min={0.5}
                                        max={10}
                                        step={0.5}
                                        value={boundaryConfig.maxDistance}
                                        onChange={(value) => {
                                            setBoundaryConfig({ ...boundaryConfig, maxDistance: value || 4.0 });
                                            notifyConfigChange();
                                        }}
                                    />
                                    <span className="config-hint">Maximum test distance</span>
                                </div>

                                <div className="config-item">
                                    <label>Angle Step (°):</label>
                                    <InputNumber
                                        min={5}
                                        max={45}
                                        step={5}
                                        value={boundaryConfig.angleStep}
                                        onChange={(value) => {
                                            setBoundaryConfig({ ...boundaryConfig, angleStep: value || 10 });
                                            notifyConfigChange();
                                        }}
                                    />
                                    <span className="config-hint">Test every N degrees (360° / step = number of angles)</span>
                                </div>

                                <div className="config-item">
                                    <label>Movement Speed (m/s):</label>
                                    <InputNumber
                                        min={0.1}
                                        max={1.0}
                                        step={0.1}
                                        value={boundaryConfig.speed}
                                        onChange={(value) => {
                                            setBoundaryConfig({ ...boundaryConfig, speed: value || 0.5 });
                                            notifyConfigChange();
                                        }}
                                    />
                                    <span className="config-hint">IEC recommended: 0.5 m/s</span>
                                </div>

                                <div className="config-item">
                                    <label>Repeat Measurements:</label>
                                    <InputNumber
                                        min={1}
                                        max={5}
                                        step={1}
                                        value={boundaryConfig.repeatMeasurements}
                                        onChange={(value) => {
                                            setBoundaryConfig({ ...boundaryConfig, repeatMeasurements: value || 2 });
                                            notifyConfigChange();
                                        }}
                                    />
                                    <span className="config-hint">Number of passes per angle for reliability</span>
                                </div>
                            </Space>
                        </div>
                    )}

                    {/* Grid Tangential Configuration */}
                    {profile === 'GRID_TANGENTIAL' && (
                        <div className="config-section">
                            <Alert
                                message="Grid-Based Tangential Test"
                                description="Tests detector coverage using 0.5m × 0.5m grid cells. Each cell is tested at multiple angles with stand rotation."
                                type="info"
                                showIcon
                                style={{ marginBottom: 20 }}
                            />

                            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                                <div className="config-item">
                                    <label>Grid Width (m):</label>
                                    <InputNumber
                                        min={1}
                                        max={10}
                                        step={0.5}
                                        value={gridConfig.gridWidth}
                                        onChange={(value) => {
                                            setGridConfig({ ...gridConfig, gridWidth: value || 3.0 });
                                            notifyConfigChange();
                                        }}
                                    />
                                    <span className="config-hint">Width of test area</span>
                                </div>

                                <div className="config-item">
                                    <label>Grid Height (m):</label>
                                    <InputNumber
                                        min={1}
                                        max={10}
                                        step={0.5}
                                        value={gridConfig.gridHeight}
                                        onChange={(value) => {
                                            setGridConfig({ ...gridConfig, gridHeight: value || 3.0 });
                                            notifyConfigChange();
                                        }}
                                    />
                                    <span className="config-hint">Height of test area</span>
                                </div>

                                <div className="config-item">
                                    <label>Cell Size (m):</label>
                                    <InputNumber
                                        min={0.25}
                                        max={1.0}
                                        step={0.25}
                                        value={gridConfig.cellSize}
                                        onChange={(value) => {
                                            setGridConfig({ ...gridConfig, cellSize: value || 0.5 });
                                            notifyConfigChange();
                                        }}
                                    />
                                    <span className="config-hint">IEC standard: 0.5m × 0.5m</span>
                                </div>

                                <div className="config-item">
                                    <label>Angle Step (°):</label>
                                    <InputNumber
                                        min={5}
                                        max={45}
                                        step={5}
                                        value={gridConfig.angleStep}
                                        onChange={(value) => {
                                            setGridConfig({ ...gridConfig, angleStep: value || 10 });
                                            notifyConfigChange();
                                        }}
                                    />
                                    <span className="config-hint">Stand rotation step at each cell</span>
                                </div>

                                <div className="config-item">
                                    <label>Dwell Time (ms):</label>
                                    <InputNumber
                                        min={500}
                                        max={5000}
                                        step={500}
                                        value={gridConfig.dwellTime}
                                        onChange={(value) => {
                                            setGridConfig({ ...gridConfig, dwellTime: value || 2000 });
                                            notifyConfigChange();
                                        }}
                                    />
                                    <span className="config-hint">Wait time at each angle</span>
                                </div>

                                <div className="config-item">
                                    <label>Coverage Threshold (%):</label>
                                    <InputNumber
                                        min={50}
                                        max={100}
                                        step={5}
                                        value={gridConfig.coverageThreshold}
                                        onChange={(value) => {
                                            setGridConfig({ ...gridConfig, coverageThreshold: value || 80 });
                                            notifyConfigChange();
                                        }}
                                    />
                                    <span className="config-hint">Required detection rate to pass cell</span>
                                </div>

                                <div className="config-item">
                                    <label>Max Attempts:</label>
                                    <InputNumber
                                        min={1}
                                        max={5}
                                        step={1}
                                        value={gridConfig.maxAttempts}
                                        onChange={(value) => {
                                            setGridConfig({ ...gridConfig, maxAttempts: value || 2 });
                                            notifyConfigChange();
                                        }}
                                    />
                                    <span className="config-hint">Retry failed cells up to N times</span>
                                </div>

                                <div className="config-summary">
                                    <strong>Grid Summary:</strong> {Math.ceil(gridConfig.gridWidth / gridConfig.cellSize)} × {Math.ceil(gridConfig.gridHeight / gridConfig.cellSize)} = {Math.ceil(gridConfig.gridWidth / gridConfig.cellSize) * Math.ceil(gridConfig.gridHeight / gridConfig.cellSize)} cells
                                </div>
                            </Space>
                        </div>
                    )}

                    {/* Radial Polar Configuration */}
                    {profile === 'RADIAL_POLAR' && (
                        <div className="config-section">
                            <Alert
                                message="Radial Polar Test"
                                description="Measures detection range at multiple angles by moving radially toward/away from detector. Creates polar plot of range vs angle."
                                type="info"
                                showIcon
                                style={{ marginBottom: 20 }}
                            />

                            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                                <div className="config-item">
                                    <label>Start Distance (m):</label>
                                    <InputNumber
                                        min={0.1}
                                        max={10}
                                        step={0.1}
                                        value={radialConfig.startDistance}
                                        onChange={(value) => {
                                            setRadialConfig({ ...radialConfig, startDistance: value || 0.5 });
                                            notifyConfigChange();
                                        }}
                                    />
                                    <span className="config-hint">Begin radial approach from this distance</span>
                                </div>

                                <div className="config-item">
                                    <label>End Distance (m):</label>
                                    <InputNumber
                                        min={0.5}
                                        max={10}
                                        step={0.5}
                                        value={radialConfig.endDistance}
                                        onChange={(value) => {
                                            setRadialConfig({ ...radialConfig, endDistance: value || 4.0 });
                                            notifyConfigChange();
                                        }}
                                    />
                                    <span className="config-hint">End radial approach at this distance</span>
                                </div>

                                <div className="config-item">
                                    <label>Distance Step (m):</label>
                                    <InputNumber
                                        min={0.1}
                                        max={1.0}
                                        step={0.05}
                                        value={radialConfig.distanceStep}
                                        onChange={(value) => {
                                            setRadialConfig({ ...radialConfig, distanceStep: value || 0.25 });
                                            notifyConfigChange();
                                        }}
                                    />
                                    <span className="config-hint">Test every N meters along radius</span>
                                </div>

                                <div className="config-item">
                                    <label>Angle Step (°):</label>
                                    <InputNumber
                                        min={5}
                                        max={45}
                                        step={5}
                                        value={radialConfig.angleStep}
                                        onChange={(value) => {
                                            setRadialConfig({ ...radialConfig, angleStep: value || 15 });
                                            notifyConfigChange();
                                        }}
                                    />
                                    <span className="config-hint">Test every N degrees (360° / step = number of angles)</span>
                                </div>

                                <div className="config-item">
                                    <label>Movement Speed (m/s):</label>
                                    <InputNumber
                                        min={0.1}
                                        max={1.0}
                                        step={0.1}
                                        value={radialConfig.speed}
                                        onChange={(value) => {
                                            setRadialConfig({ ...radialConfig, speed: value || 0.5 });
                                            notifyConfigChange();
                                        }}
                                    />
                                    <span className="config-hint">IEC recommended: 0.5 m/s</span>
                                </div>

                                <div className="config-item">
                                    <label>Repeat Measurements:</label>
                                    <InputNumber
                                        min={1}
                                        max={5}
                                        step={1}
                                        value={radialConfig.repeatMeasurements}
                                        onChange={(value) => {
                                            setRadialConfig({ ...radialConfig, repeatMeasurements: value || 2 });
                                            notifyConfigChange();
                                        }}
                                    />
                                    <span className="config-hint">Number of passes per angle for reliability</span>
                                </div>
                            </Space>
                        </div>
                    )}
                </div>

                <Divider />

                {/* Start Button */}
                <div className="action-buttons">
                    <Button
                        type="primary"
                        size="large"
                        onClick={handleStart}
                        className="start-test-button"
                    >
                        Start Test with Selected Profile
                    </Button>
                </div>
            </Card>
        </div>
    );
};

export default TestProfileSelector;
