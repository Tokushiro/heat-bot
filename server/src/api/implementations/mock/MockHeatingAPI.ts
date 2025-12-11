import {
    IHeatingAPI,
    HeatingZone,
    HeatingZoneStatus,
    HeatingSystemStatus,
    HeatingConfig,
    STANDARD_TEMP_OFFSETS
} from '../../interfaces/IHeatingAPI';

/**
 * Mock Heating Controller
 *
 * Simulates a thermal manikin heating system without requiring real hardware.
 * Features realistic temperature simulation including:
 * - Heating rate (gradual temperature increase)
 * - Cooling rate (gradual temperature decrease when disabled)
 * - Temperature stabilization around target
 * - Power level control
 * - Temperature statistics tracking
 *
 * Used for development, testing, and demonstration purposes.
 */
export class MockHeatingAPI implements IHeatingAPI {
    private static instance: MockHeatingAPI;

    private connected: boolean = false;
    private initialized: boolean = false;
    private ambientTemp: number = 20; // Default room temperature
    private lastError: string | undefined;
    private lastUpdateTime: Date = new Date();

    // Zone state
    private zones: Map<HeatingZone, ZoneState> = new Map();

    // Simulation intervals
    private simulationInterval: NodeJS.Timeout | null = null;

    // Configuration
    private config: Required<HeatingConfig> = {
        port: 'MOCK',
        headOffset: STANDARD_TEMP_OFFSETS.HEAD,
        bodyOffset: STANDARD_TEMP_OFFSETS.BODY,
        legsOffset: STANDARD_TEMP_OFFSETS.LEGS,
        minTemp: 15,
        maxTemp: 50,
        pidKp: 1.0,
        pidKi: 0.1,
        pidKd: 0.05,
        updateInterval: 1000
    };

    private constructor() {
        console.log('[MockHeating] Mock heating controller created');
        this.initializeZones();
    }

    /**
     * Get singleton instance
     */
    public static getInstance(): MockHeatingAPI {
        if (!MockHeatingAPI.instance) {
            MockHeatingAPI.instance = new MockHeatingAPI();
        }
        return MockHeatingAPI.instance;
    }

    /**
     * Initialize zones with default state
     */
    private initializeZones(): void {
        const zones: HeatingZone[] = ['HEAD', 'BODY', 'LEGS'];
        zones.forEach(zone => {
            this.zones.set(zone, {
                enabled: false,
                currentTemp: this.ambientTemp,
                targetTemp: this.ambientTemp + this.getDefaultOffset(zone),
                targetOffset: this.getDefaultOffset(zone),
                powerLevel: 0,
                minTemp: this.ambientTemp,
                maxTemp: this.ambientTemp,
                avgTemp: this.ambientTemp,
                tempHistory: []
            });
        });
    }

    /**
     * Get default offset for a zone
     */
    private getDefaultOffset(zone: HeatingZone): number {
        switch (zone) {
            case 'HEAD': return this.config.headOffset;
            case 'BODY': return this.config.bodyOffset;
            case 'LEGS': return this.config.legsOffset;
        }
    }

    /**
     * Initialize the heating system
     */
    async initialize(): Promise<void> {
        console.log('[MockHeating] Initializing mock heating system...');

        // Simulate connection delay
        await this.delay(500);

        this.connected = true;

        // Set initial temperatures to ambient
        this.zones.forEach((state, zone) => {
            state.currentTemp = this.ambientTemp;
            state.targetTemp = this.ambientTemp + state.targetOffset;
        });

        // Start temperature simulation
        this.startSimulation();

        this.initialized = true;
        this.lastUpdateTime = new Date();

        console.log('[MockHeating] ✅ Heating system initialized');
        console.log(`[MockHeating] Ambient temperature: ${this.ambientTemp}°C`);
        console.log(`[MockHeating] Target offsets - Head: +${this.config.headOffset}°C, Body/Legs: +${this.config.bodyOffset}°C`);
    }

    /**
     * Start temperature simulation
     */
    private startSimulation(): void {
        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
        }

        this.simulationInterval = setInterval(() => {
            this.updateTemperatures();
        }, this.config.updateInterval);
    }

    /**
     * Update all zone temperatures (simulation)
     */
    private updateTemperatures(): void {
        this.zones.forEach((state, zone) => {
            if (state.enabled) {
                // Heating: gradually increase towards target
                const tempDiff = state.targetTemp - state.currentTemp;

                if (Math.abs(tempDiff) < 0.1) {
                    // At target - maintain with small fluctuations
                    state.currentTemp = state.targetTemp + (Math.random() - 0.5) * 0.2;
                    state.powerLevel = 50; // Maintaining
                } else if (tempDiff > 0) {
                    // Heating up
                    const heatingRate = 0.5; // °C per second
                    state.currentTemp += heatingRate * (this.config.updateInterval / 1000);
                    state.powerLevel = Math.min(100, Math.abs(tempDiff) * 20);

                    // Don't overshoot
                    if (state.currentTemp > state.targetTemp) {
                        state.currentTemp = state.targetTemp;
                    }
                } else {
                    // Cooling down to lower target
                    const coolingRate = 0.3; // °C per second
                    state.currentTemp -= coolingRate * (this.config.updateInterval / 1000);
                    state.powerLevel = 0;

                    // Don't undershoot
                    if (state.currentTemp < state.targetTemp) {
                        state.currentTemp = state.targetTemp;
                    }
                }
            } else {
                // Disabled - cool down to ambient
                if (state.currentTemp > this.ambientTemp + 0.1) {
                    const coolingRate = 0.2; // °C per second (slower natural cooling)
                    state.currentTemp -= coolingRate * (this.config.updateInterval / 1000);
                    state.powerLevel = 0;

                    // Don't cool below ambient
                    if (state.currentTemp < this.ambientTemp) {
                        state.currentTemp = this.ambientTemp;
                    }
                } else {
                    state.currentTemp = this.ambientTemp;
                    state.powerLevel = 0;
                }
            }

            // Update statistics
            state.tempHistory.push(state.currentTemp);
            if (state.tempHistory.length > 60) { // Keep last 60 samples
                state.tempHistory.shift();
            }

            state.minTemp = Math.min(...state.tempHistory);
            state.maxTemp = Math.max(...state.tempHistory);
            state.avgTemp = state.tempHistory.reduce((a, b) => a + b, 0) / state.tempHistory.length;
        });

        this.lastUpdateTime = new Date();
    }

    /**
     * Stop temperature simulation
     */
    private stopSimulation(): void {
        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
            this.simulationInterval = null;
        }
    }

    /**
     * Set target temperature for a zone
     */
    async setTargetTemperature(zone: HeatingZone, targetTemp: number): Promise<void> {
        if (!this.initialized) {
            throw new Error('Heating system not initialized');
        }

        if (targetTemp < this.config.minTemp || targetTemp > this.config.maxTemp) {
            throw new Error(`Temperature ${targetTemp}°C out of safe range (${this.config.minTemp}-${this.config.maxTemp}°C)`);
        }

        const state = this.zones.get(zone);
        if (!state) {
            throw new Error(`Invalid zone: ${zone}`);
        }

        state.targetTemp = targetTemp;
        state.targetOffset = targetTemp - this.ambientTemp;

        console.log(`[MockHeating] ${zone} target set to ${targetTemp.toFixed(1)}°C (ambient +${state.targetOffset.toFixed(1)}°C)`);
    }

    /**
     * Set temperature offset from ambient
     */
    async setTemperatureOffset(zone: HeatingZone, offset: number): Promise<void> {
        const targetTemp = this.ambientTemp + offset;
        await this.setTargetTemperature(zone, targetTemp);
    }

    /**
     * Get current temperature for a zone
     */
    getCurrentTemperature(zone: HeatingZone): number {
        const state = this.zones.get(zone);
        return state?.currentTemp || this.ambientTemp;
    }

    /**
     * Get target temperature for a zone
     */
    getTargetTemperature(zone: HeatingZone): number {
        const state = this.zones.get(zone);
        return state?.targetTemp || this.ambientTemp;
    }

    /**
     * Enable heating for a zone
     */
    async enableHeating(zone: HeatingZone): Promise<void> {
        if (!this.initialized) {
            throw new Error('Heating system not initialized');
        }

        const state = this.zones.get(zone);
        if (!state) {
            throw new Error(`Invalid zone: ${zone}`);
        }

        state.enabled = true;
        console.log(`[MockHeating] ✅ ${zone} heating enabled (target: ${state.targetTemp.toFixed(1)}°C)`);
    }

    /**
     * Disable heating for a zone
     */
    async disableHeating(zone: HeatingZone): Promise<void> {
        if (!this.initialized) {
            throw new Error('Heating system not initialized');
        }

        const state = this.zones.get(zone);
        if (!state) {
            throw new Error(`Invalid zone: ${zone}`);
        }

        state.enabled = false;
        console.log(`[MockHeating] ⏹️ ${zone} heating disabled`);
    }

    /**
     * Enable all zones
     */
    async enableAllZones(): Promise<void> {
        console.log('[MockHeating] Enabling all heating zones...');
        await Promise.all(
            Array.from(this.zones.keys()).map(zone => this.enableHeating(zone))
        );
    }

    /**
     * Disable all zones
     */
    async disableAllZones(): Promise<void> {
        console.log('[MockHeating] Disabling all heating zones...');
        await Promise.all(
            Array.from(this.zones.keys()).map(zone => this.disableHeating(zone))
        );
    }

    /**
     * Get zone status
     */
    getZoneStatus(zone: HeatingZone): HeatingZoneStatus {
        const state = this.zones.get(zone);
        if (!state) {
            throw new Error(`Invalid zone: ${zone}`);
        }

        return this.buildZoneStatus(zone, state);
    }

    /**
     * Get all zone statuses
     */
    getAllZoneStatus(): HeatingZoneStatus[] {
        return Array.from(this.zones.entries()).map(([zone, state]) =>
            this.buildZoneStatus(zone, state)
        );
    }

    /**
     * Build zone status object
     */
    private buildZoneStatus(zone: HeatingZone, state: ZoneState): HeatingZoneStatus {
        const tempDiff = Math.abs(state.currentTemp - state.targetTemp);
        let status: 'HEATING' | 'IDLE' | 'AT_TARGET' | 'ERROR';

        if (!state.enabled) {
            status = 'IDLE';
        } else if (tempDiff < 0.5) {
            status = 'AT_TARGET';
        } else {
            status = 'HEATING';
        }

        return {
            zone,
            enabled: state.enabled,
            currentTemp: parseFloat(state.currentTemp.toFixed(2)),
            targetTemp: parseFloat(state.targetTemp.toFixed(2)),
            targetOffset: parseFloat(state.targetOffset.toFixed(2)),
            status,
            powerLevel: Math.round(state.powerLevel),
            minTemp: state.minTemp ? parseFloat(state.minTemp.toFixed(2)) : undefined,
            maxTemp: state.maxTemp ? parseFloat(state.maxTemp.toFixed(2)) : undefined,
            avgTemp: state.avgTemp ? parseFloat(state.avgTemp.toFixed(2)) : undefined,
            lastUpdateTime: this.lastUpdateTime
        };
    }

    /**
     * Get system status
     */
    getSystemStatus(): HeatingSystemStatus {
        const zones = this.getAllZoneStatus();
        const allEnabled = zones.every(z => z.enabled);

        return {
            connected: this.connected,
            initialized: this.initialized,
            ambientTemp: parseFloat(this.ambientTemp.toFixed(2)),
            zones,
            allZonesEnabled: allEnabled,
            lastError: this.lastError,
            lastUpdateTime: this.lastUpdateTime
        };
    }

    /**
     * Set ambient temperature
     */
    setAmbientTemperature(temp: number): void {
        console.log(`[MockHeating] Ambient temperature updated: ${temp.toFixed(1)}°C`);
        this.ambientTemp = temp;

        // Update all zone targets based on their offsets
        this.zones.forEach((state) => {
            state.targetTemp = this.ambientTemp + state.targetOffset;
        });
    }

    /**
     * Get ambient temperature
     */
    getAmbientTemperature(): number {
        return this.ambientTemp;
    }

    /**
     * Check if ready
     */
    isReady(): boolean {
        return this.connected && this.initialized;
    }

    /**
     * Disconnect
     */
    async disconnect(): Promise<void> {
        console.log('[MockHeating] Disconnecting heating system...');

        this.stopSimulation();
        await this.disableAllZones();

        this.connected = false;
        this.initialized = false;
        this.lastUpdateTime = new Date();

        console.log('[MockHeating] ✅ Disconnected');
    }

    /**
     * Update configuration
     */
    updateConfig(config: Partial<HeatingConfig>): void {
        this.config = { ...this.config, ...config };
        console.log('[MockHeating] Configuration updated:', this.config);
    }

    /**
     * Reset for testing
     */
    reset(): void {
        this.stopSimulation();
        this.connected = false;
        this.initialized = false;
        this.ambientTemp = 20;
        this.lastError = undefined;
        this.lastUpdateTime = new Date();
        this.initializeZones();
        console.log('[MockHeating] Heating system reset');
    }

    /**
     * Delay helper
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * Internal zone state
 */
interface ZoneState {
    enabled: boolean;
    currentTemp: number;
    targetTemp: number;
    targetOffset: number;
    powerLevel: number;
    minTemp: number;
    maxTemp: number;
    avgTemp: number;
    tempHistory: number[];
}

// Export singleton instance getter
export const getMockHeatingAPI = () => MockHeatingAPI.getInstance();
