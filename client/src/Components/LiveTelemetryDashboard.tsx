import React, { useState, useEffect } from 'react';
import '../Styles/LiveTelemetryDashboard.css';


interface EnvironmentStatus {
    connected: boolean;
    initialized: boolean;
    monitoring: boolean;
    currentTemperature: number;
    currentHumidity: number;
    temperatureOffset: number;
    humidityOffset: number;
    sampleCount: number;
    lastSampleTime?: string;
    lastError?: string;
}

interface HeatingStatus {
    connected: boolean;
    initialized: boolean;
    zones: {
        zone1: { enabled: boolean; targetTemp: number; currentTemp: number };
        zone2: { enabled: boolean; targetTemp: number; currentTemp: number };
        zone3: { enabled: boolean; targetTemp: number; currentTemp: number };
    };
    allZonesStable: boolean;
    lastError?: string;
}

interface StandStatus {
    connected: boolean;
    initialized: boolean;
    currentAngle: number;
    isMoving: boolean;
    lastError?: string;
    lastUpdateTime: string;
}

interface GridTestProgress {
    totalCells: number;
    completedCells: number;
    currentCell?: { x: number; y: number; cellX: number; cellY: number };
    currentAngle?: number;
    percentComplete: number;
    estimatedTimeRemaining?: number;
    status: 'idle' | 'initializing' | 'running' | 'paused' | 'completed' | 'error';
}

interface LiveTelemetryDashboardProps {
    refreshInterval?: number;  // Refresh interval in milliseconds (default 1000)
    showEnvironment?: boolean;
    showHeating?: boolean;
    showStand?: boolean;
    showGridTest?: boolean;
}

const LiveTelemetryDashboard: React.FC<LiveTelemetryDashboardProps> = ({
    refreshInterval = 1000,
    showEnvironment = true,
    showHeating = true,
    showStand = true,
    showGridTest = true
}) => {
    const [environmentStatus, setEnvironmentStatus] = useState<EnvironmentStatus | null>(null);
    const [heatingStatus, setHeatingStatus] = useState<HeatingStatus | null>(null);
    const [standStatus, setStandStatus] = useState<StandStatus | null>(null);
    const [gridTestProgress, setGridTestProgress] = useState<GridTestProgress | null>(null);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
    const [isPaused, setIsPaused] = useState<boolean>(false);

    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

    /**
     * Fetch environment status
     */
    const fetchEnvironmentStatus = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/environment/status`);
            if (response.ok) {
                const data = await response.json();
                setEnvironmentStatus(data);
            }
        } catch (error) {
            console.error('Error fetching environment status:', error);
        }
    };

    /**
     * Fetch heating status
     */
    const fetchHeatingStatus = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/heating/status`);
            if (response.ok) {
                const data = await response.json();
                setHeatingStatus(data);
            }
        } catch (error) {
            console.error('Error fetching heating status:', error);
        }
    };

    /**
     * Fetch stand status
     */
    const fetchStandStatus = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/stand/status`);
            if (response.ok) {
                const data = await response.json();
                setStandStatus(data);
            }
        } catch (error) {
            console.error('Error fetching stand status:', error);
        }
    };

    /**
     * Fetch grid test progress
     */
    const fetchGridTestProgress = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/gridtest/progress`);
            if (response.ok) {
                const data = await response.json();
                setGridTestProgress(data);
            }
        } catch (error) {
            console.error('Error fetching grid test progress:', error);
        }
    };

    /**
     * Fetch all data
     */
    const fetchAllData = async () => {
        if (showEnvironment) await fetchEnvironmentStatus();
        if (showHeating) await fetchHeatingStatus();
        if (showStand) await fetchStandStatus();
        if (showGridTest) await fetchGridTestProgress();
        setLastUpdate(new Date());
    };

    /**
     * Set up auto-refresh
     */
    useEffect(() => {
        fetchAllData();

        if (!isPaused) {
            const interval = setInterval(fetchAllData, refreshInterval);
            return () => clearInterval(interval);
        }
    }, [isPaused, refreshInterval]);

    /**
     * Get status indicator color
     */
    const getStatusColor = (connected: boolean, initialized: boolean): string => {
        if (!connected) return '#f44336'; // Red
        if (!initialized) return '#ff9800'; // Orange
        return '#4caf50'; // Green
    };

    /**
     * Format timestamp
     */
    const formatTime = (date: Date): string => {
        return date.toLocaleTimeString();
    };

    /**
     * Format duration
     */
    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="live-telemetry-dashboard">
            {/* Header */}
            <div className="dashboard-header">
                <div className="header-left">
                    <h2>Live Telemetry Dashboard</h2>
                    <span className="last-update">Last update: {formatTime(lastUpdate)}</span>
                </div>
                <div className="header-right">
                    <button
                        className={`pause-button ${isPaused ? 'paused' : ''}`}
                        onClick={() => setIsPaused(!isPaused)}
                    >
                        {isPaused ? '▶ Resume' : '⏸ Pause'}
                    </button>
                    <button className="refresh-button" onClick={fetchAllData}>
                        🔄 Refresh
                    </button>
                </div>
            </div>

            {/* Dashboard Grid */}
            <div className="dashboard-grid">
                {/* Environment Panel */}
                {showEnvironment && environmentStatus && (
                    <div className="dashboard-panel environment-panel">
                        <div className="panel-header">
                            <h3>🌡️ Environment</h3>
                            <div
                                className="status-indicator"
                                style={{
                                    backgroundColor: getStatusColor(
                                        environmentStatus.connected,
                                        environmentStatus.initialized
                                    )
                                }}
                            ></div>
                        </div>

                        <div className="panel-content">
                            <div className="metric-large">
                                <span className="metric-value">
                                    {environmentStatus.currentTemperature.toFixed(1)}
                                </span>
                                <span className="metric-unit">°C</span>
                                <span className="metric-label">Temperature</span>
                            </div>

                            <div className="metric-large">
                                <span className="metric-value">
                                    {environmentStatus.currentHumidity.toFixed(1)}
                                </span>
                                <span className="metric-unit">% RH</span>
                                <span className="metric-label">Humidity</span>
                            </div>

                            <div className="metric-row">
                                <span className="metric-label">Monitoring:</span>
                                <span className={`metric-badge ${environmentStatus.monitoring ? 'active' : ''}`}>
                                    {environmentStatus.monitoring ? 'Active' : 'Inactive'}
                                </span>
                            </div>

                            <div className="metric-row">
                                <span className="metric-label">Samples:</span>
                                <span className="metric-value">{environmentStatus.sampleCount}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Heating Panel */}
                {showHeating && heatingStatus && (
                    <div className="dashboard-panel heating-panel">
                        <div className="panel-header">
                            <h3>🔥 Heating Zones</h3>
                            <div
                                className="status-indicator"
                                style={{
                                    backgroundColor: getStatusColor(
                                        heatingStatus.connected,
                                        heatingStatus.initialized
                                    )
                                }}
                            ></div>
                        </div>

                        <div className="panel-content">
                            {/* Zone 1 */}
                            <div className="zone-status">
                                <div className="zone-header">
                                    <span className="zone-name">Zone 1</span>
                                    <span className={`zone-badge ${heatingStatus.zones.zone1.enabled ? 'enabled' : 'disabled'}`}>
                                        {heatingStatus.zones.zone1.enabled ? 'ON' : 'OFF'}
                                    </span>
                                </div>
                                <div className="zone-temps">
                                    <span className="current-temp">
                                        {heatingStatus.zones.zone1.currentTemp.toFixed(1)}°C
                                    </span>
                                    <span className="target-temp">
                                        Target: {heatingStatus.zones.zone1.targetTemp}°C
                                    </span>
                                </div>
                                <div className="zone-progress-bar">
                                    <div
                                        className="zone-progress-fill"
                                        style={{
                                            width: `${Math.min(
                                                (heatingStatus.zones.zone1.currentTemp /
                                                    heatingStatus.zones.zone1.targetTemp) *
                                                    100,
                                                100
                                            )}%`
                                        }}
                                    ></div>
                                </div>
                            </div>

                            {/* Zone 2 */}
                            <div className="zone-status">
                                <div className="zone-header">
                                    <span className="zone-name">Zone 2</span>
                                    <span className={`zone-badge ${heatingStatus.zones.zone2.enabled ? 'enabled' : 'disabled'}`}>
                                        {heatingStatus.zones.zone2.enabled ? 'ON' : 'OFF'}
                                    </span>
                                </div>
                                <div className="zone-temps">
                                    <span className="current-temp">
                                        {heatingStatus.zones.zone2.currentTemp.toFixed(1)}°C
                                    </span>
                                    <span className="target-temp">
                                        Target: {heatingStatus.zones.zone2.targetTemp}°C
                                    </span>
                                </div>
                                <div className="zone-progress-bar">
                                    <div
                                        className="zone-progress-fill"
                                        style={{
                                            width: `${Math.min(
                                                (heatingStatus.zones.zone2.currentTemp /
                                                    heatingStatus.zones.zone2.targetTemp) *
                                                    100,
                                                100
                                            )}%`
                                        }}
                                    ></div>
                                </div>
                            </div>

                            {/* Zone 3 */}
                            <div className="zone-status">
                                <div className="zone-header">
                                    <span className="zone-name">Zone 3</span>
                                    <span className={`zone-badge ${heatingStatus.zones.zone3.enabled ? 'enabled' : 'disabled'}`}>
                                        {heatingStatus.zones.zone3.enabled ? 'ON' : 'OFF'}
                                    </span>
                                </div>
                                <div className="zone-temps">
                                    <span className="current-temp">
                                        {heatingStatus.zones.zone3.currentTemp.toFixed(1)}°C
                                    </span>
                                    <span className="target-temp">
                                        Target: {heatingStatus.zones.zone3.targetTemp}°C
                                    </span>
                                </div>
                                <div className="zone-progress-bar">
                                    <div
                                        className="zone-progress-fill"
                                        style={{
                                            width: `${Math.min(
                                                (heatingStatus.zones.zone3.currentTemp /
                                                    heatingStatus.zones.zone3.targetTemp) *
                                                    100,
                                                100
                                            )}%`
                                        }}
                                    ></div>
                                </div>
                            </div>

                            <div className="metric-row">
                                <span className="metric-label">All zones stable:</span>
                                <span className={`metric-badge ${heatingStatus.allZonesStable ? 'active' : ''}`}>
                                    {heatingStatus.allZonesStable ? 'Yes' : 'No'}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Stand Panel */}
                {showStand && standStatus && (
                    <div className="dashboard-panel stand-panel">
                        <div className="panel-header">
                            <h3>🔄 Detector Stand</h3>
                            <div
                                className="status-indicator"
                                style={{
                                    backgroundColor: getStatusColor(
                                        standStatus.connected,
                                        standStatus.initialized
                                    )
                                }}
                            ></div>
                        </div>

                        <div className="panel-content">
                            <div className="angle-display">
                                <div className="angle-circle">
                                    <div
                                        className="angle-indicator"
                                        style={{
                                            transform: `rotate(${standStatus.currentAngle}deg)`
                                        }}
                                    ></div>
                                </div>
                                <div className="angle-value">{standStatus.currentAngle.toFixed(1)}°</div>
                            </div>

                            <div className="metric-row">
                                <span className="metric-label">Movement:</span>
                                <span className={`metric-badge ${standStatus.isMoving ? 'active' : ''}`}>
                                    {standStatus.isMoving ? 'Moving' : 'Stationary'}
                                </span>
                            </div>

                            <div className="metric-row">
                                <span className="metric-label">Last update:</span>
                                <span className="metric-value">
                                    {new Date(standStatus.lastUpdateTime).toLocaleTimeString()}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Grid Test Panel */}
                {showGridTest && gridTestProgress && gridTestProgress.status !== 'idle' && (
                    <div className="dashboard-panel gridtest-panel">
                        <div className="panel-header">
                            <h3>📍 Grid Test</h3>
                            <span className={`status-badge status-${gridTestProgress.status}`}>
                                {gridTestProgress.status}
                            </span>
                        </div>

                        <div className="panel-content">
                            <div className="progress-display">
                                <div className="progress-bar-large">
                                    <div
                                        className="progress-fill-large"
                                        style={{ width: `${gridTestProgress.percentComplete}%` }}
                                    ></div>
                                </div>
                                <div className="progress-text-large">
                                    {gridTestProgress.percentComplete.toFixed(1)}%
                                </div>
                            </div>

                            <div className="metric-row">
                                <span className="metric-label">Cells:</span>
                                <span className="metric-value">
                                    {gridTestProgress.completedCells} / {gridTestProgress.totalCells}
                                </span>
                            </div>

                            {gridTestProgress.currentCell && (
                                <div className="metric-row">
                                    <span className="metric-label">Current position:</span>
                                    <span className="metric-value">
                                        ({gridTestProgress.currentCell.x.toFixed(2)}m,{' '}
                                        {gridTestProgress.currentCell.y.toFixed(2)}m)
                                    </span>
                                </div>
                            )}

                            {gridTestProgress.currentAngle !== undefined && (
                                <div className="metric-row">
                                    <span className="metric-label">Current angle:</span>
                                    <span className="metric-value">{gridTestProgress.currentAngle}°</span>
                                </div>
                            )}

                            {gridTestProgress.estimatedTimeRemaining && (
                                <div className="metric-row">
                                    <span className="metric-label">ETA:</span>
                                    <span className="metric-value">
                                        {formatDuration(gridTestProgress.estimatedTimeRemaining)}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LiveTelemetryDashboard;
