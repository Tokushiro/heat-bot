import {
    IHeatingAPI,
    HeatingZone,
    HeatingZoneStatus,
    HeatingSystemStatus,
    HeatingConfig,
    STANDARD_TEMP_OFFSETS
} from '../../interfaces/IHeatingAPI';
import { SerialManager } from '../../../services/core/SerialManager';


export class RealHeatingAPI implements IHeatingAPI {
    private static instance: RealHeatingAPI;
    private serialManager: SerialManager;

    private connected: boolean = false;
    private initialized: boolean = false;
    private ambientTemp: number = 20;
    private lastError: string | undefined;
    private lastUpdateTime: Date = new Date();

    // Zone state cache
    private zoneStates: Map<HeatingZone, HeatingZoneStatus> = new Map();

    private config: Required<HeatingConfig> = {
        port: process.env.HEATING_PORT || '/dev/ttyUSB0', // Same port as SerialManager
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
        this.serialManager = SerialManager.instance;
        console.log('[RealHeating] Real heating controller created');
        console.log('[RealHeating] Using SerialManager for communication');

        // Initialize zone states
        const zones: HeatingZone[] = ['HEAD', 'BODY', 'LEGS'];
        zones.forEach(zone => {
            this.zoneStates.set(zone, {
                zone,
                enabled: false,
                currentTemp: this.ambientTemp,
                targetTemp: this.ambientTemp,
                targetOffset: this.config[`${zone.toLowerCase()}Offset` as keyof typeof this.config] as number,
                status: 'IDLE',
                lastUpdateTime: new Date()
            });
        });
    }

    /**
     * Get singleton instance
     */
    public static getInstance(): RealHeatingAPI {
        if (!RealHeatingAPI.instance) {
            RealHeatingAPI.instance = new RealHeatingAPI();
        }
        return RealHeatingAPI.instance;
    }

    /**
     * Send command via SerialManager and parse JSON response
     */
    private async sendCommand(command: string): Promise<any> {
        try {
            const response = await this.serialManager.sendCommand(command);

            // Parse JSON response
            const data = JSON.parse(response);

            if (data.status === 'error') {
                throw new Error(data.error || 'Unknown error from hardware');
            }

            return data.data;
        } catch (error) {
            console.error(`[RealHeating] Command failed: ${command}`, error);
            this.lastError = error instanceof Error ? error.message : 'Unknown error';
            throw error;
        }
    }

    /**
     * Initialize the heating system
     */
    async initialize(): Promise<void> {
        console.log('[RealHeating] Initializing real heating system...');

        try {
            // Ensure SerialManager is connected
            if (!this.serialManager.connected) {
                await this.serialManager.connect(process.env.ROBOT_SERIAL_PORT || '/dev/ttyUSB0', 115200);
            }

            // Send initialization command
            const response = await this.sendCommand('heating_init');
            console.log('[RealHeating] Initialization response:', response);

            this.connected = true;
            this.initialized = true;
            this.ambientTemp = response.ambientTemp || 20;
            this.lastUpdateTime = new Date();

            // Update zone states with current status
            await this.refreshStatus();

            console.log('[RealHeating] ✓ Heating system initialized');
        } catch (error) {
            this.lastError = error instanceof Error ? error.message : 'Unknown error';
            console.error('[RealHeating] Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Refresh status from hardware
     */
    private async refreshStatus(): Promise<void> {
        try {
            const response = await this.sendCommand('heating_status');

            this.connected = response.connected;
            this.initialized = response.initialized;
            this.ambientTemp = response.ambientTemp;

            // Update zone states
            if (response.zones && Array.isArray(response.zones)) {
                response.zones.forEach((zoneData: any) => {
                    const zone = zoneData.zone as HeatingZone;
                    this.zoneStates.set(zone, {
                        zone,
                        enabled: zoneData.enabled,
                        currentTemp: zoneData.currentTemp,
                        targetTemp: zoneData.targetTemp,
                        targetOffset: zoneData.targetOffset,
                        status: zoneData.status,
                        powerLevel: zoneData.powerLevel,
                        minTemp: zoneData.minTemp,
                        maxTemp: zoneData.maxTemp,
                        avgTemp: zoneData.avgTemp,
                        lastUpdateTime: new Date()
                    });
                });
            }

            this.lastUpdateTime = new Date();
        } catch (error) {
            console.error('[RealHeating] Status refresh failed:', error);
        }
    }

    /**
     * Set target temperature for a zone
     */
    async setTargetTemperature(zone: HeatingZone, targetTemp: number): Promise<void> {
        // Validate temperature range
        if (targetTemp < this.config.minTemp || targetTemp > this.config.maxTemp) {
            throw new Error(`Temperature ${targetTemp}°C out of range [${this.config.minTemp}, ${this.config.maxTemp}]`);
        }

        console.log(`[RealHeating] Setting ${zone} target temperature to ${targetTemp}°C`);

        try {
            const response = await this.sendCommand(`heating_set_zone:${zone}:${targetTemp}`);
            console.log(`[RealHeating] Set temperature response:`, response);

            // Update cache
            const zoneState = this.zoneStates.get(zone)!;
            zoneState.targetTemp = targetTemp;
            zoneState.lastUpdateTime = new Date();
        } catch (error) {
            console.error(`[RealHeating] Failed to set temperature for ${zone}:`, error);
            throw error;
        }
    }

    /**
     * Set temperature offset for a zone (relative to ambient)
     */
    async setTemperatureOffset(zone: HeatingZone, offset: number): Promise<void> {
        const targetTemp = this.ambientTemp + offset;
        await this.setTargetTemperature(zone, targetTemp);

        // Update offset in cache
        const zoneState = this.zoneStates.get(zone)!;
        zoneState.targetOffset = offset;
    }

    /**
     * Get current temperature of a zone
     */
    getCurrentTemperature(zone: HeatingZone): number {
        return this.zoneStates.get(zone)?.currentTemp || this.ambientTemp;
    }

    /**
     * Get target temperature of a zone
     */
    getTargetTemperature(zone: HeatingZone): number {
        return this.zoneStates.get(zone)?.targetTemp || this.ambientTemp;
    }

    /**
     * Enable heating for a zone
     */
    async enableHeating(zone: HeatingZone): Promise<void> {
        console.log(`[RealHeating] Enabling heating for ${zone}`);

        try {
            const response = await this.sendCommand(`heating_enable:${zone}`);
            console.log(`[RealHeating] Enable response:`, response);

            // Update cache
            const zoneState = this.zoneStates.get(zone)!;
            zoneState.enabled = true;
            zoneState.status = 'HEATING';
            zoneState.lastUpdateTime = new Date();
        } catch (error) {
            console.error(`[RealHeating] Failed to enable heating for ${zone}:`, error);
            throw error;
        }
    }

    /**
     * Disable heating for a zone
     */
    async disableHeating(zone: HeatingZone): Promise<void> {
        console.log(`[RealHeating] Disabling heating for ${zone}`);

        try {
            const response = await this.sendCommand(`heating_disable:${zone}`);
            console.log(`[RealHeating] Disable response:`, response);

            // Update cache
            const zoneState = this.zoneStates.get(zone)!;
            zoneState.enabled = false;
            zoneState.status = 'IDLE';
            zoneState.lastUpdateTime = new Date();
        } catch (error) {
            console.error(`[RealHeating] Failed to disable heating for ${zone}:`, error);
            throw error;
        }
    }

    /**
     * Enable all heating zones
     */
    async enableAllZones(): Promise<void> {
        console.log('[RealHeating] Enabling all zones');

        try {
            const response = await this.sendCommand('heating_enable_all');
            console.log('[RealHeating] Enable all response:', response);

            // Update all zone caches
            this.zoneStates.forEach((state, zone) => {
                state.enabled = true;
                state.status = 'HEATING';
                state.lastUpdateTime = new Date();
            });
        } catch (error) {
            console.error('[RealHeating] Failed to enable all zones:', error);
            throw error;
        }
    }

    /**
     * Disable all heating zones
     */
    async disableAllZones(): Promise<void> {
        console.log('[RealHeating] Disabling all zones');

        try {
            const response = await this.sendCommand('heating_disable_all');
            console.log('[RealHeating] Disable all response:', response);

            // Update all zone caches
            this.zoneStates.forEach((state, zone) => {
                state.enabled = false;
                state.status = 'IDLE';
                state.lastUpdateTime = new Date();
            });
        } catch (error) {
            console.error('[RealHeating] Failed to disable all zones:', error);
            throw error;
        }
    }

    /**
     * Get status of a specific zone
     */
    getZoneStatus(zone: HeatingZone): HeatingZoneStatus {
        return this.zoneStates.get(zone)!;
    }

    /**
     * Get status of all zones
     */
    getAllZoneStatus(): HeatingZoneStatus[] {
        return Array.from(this.zoneStates.values());
    }

    /**
     * Get overall system status
     */
    getSystemStatus(): HeatingSystemStatus {
        const zones = this.getAllZoneStatus();
        const allEnabled = zones.every(z => z.enabled);

        return {
            connected: this.connected,
            initialized: this.initialized,
            ambientTemp: this.ambientTemp,
            zones,
            allZonesEnabled: allEnabled,
            lastError: this.lastError,
            lastUpdateTime: this.lastUpdateTime
        };
    }

    /**
     * Set ambient temperature (for calculation purposes)
     */
    setAmbientTemperature(temp: number): void {
        this.ambientTemp = temp;
    }

    /**
     * Get ambient temperature
     */
    getAmbientTemperature(): number {
        return this.ambientTemp;
    }

    /**
     * Check if system is ready
     */
    isReady(): boolean {
        return this.connected && this.initialized;
    }

    /**
     * Disconnect from hardware
     */
    async disconnect(): Promise<void> {
        console.log('[RealHeating] Disconnecting...');
        await this.disableAllZones();
        this.connected = false;
        this.initialized = false;
    }

    /**
     * Update configuration
     */
    updateConfig(config: Partial<HeatingConfig>): void {
        this.config = { ...this.config, ...config };
        console.log('[RealHeating] Configuration updated:', this.config);
    }
}

// Export singleton instance getter
export const getRealHeatingAPI = () => RealHeatingAPI.getInstance();
