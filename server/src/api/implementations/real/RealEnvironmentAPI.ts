import {
    IEnvironmentAPI,
    EnvironmentReading,
    EnvironmentStatus,
    EnvironmentValidation,
    EnvironmentConfig,
    STANDARD_ENVIRONMENT_LIMITS
} from '../../interfaces/IEnvironmentAPI';
import { SerialManager } from '../../../services/core/SerialManager';

export class RealEnvironmentAPI implements IEnvironmentAPI {
    private static instance: RealEnvironmentAPI;
    private serialManager: SerialManager;

    private connected: boolean = false;
    private initialized: boolean = false;
    private monitoring: boolean = false;
    private monitoringInterval: NodeJS.Timeout | null = null;

    private currentTemperature: number = 20;
    private currentHumidity: number = 70;
    private tempOffset: number = 0;
    private humidityOffset: number = 0;
    private history: EnvironmentReading[] = [];

    private config: Required<EnvironmentConfig> = {
        port: process.env.ENVIRONMENT_PORT || '/dev/i2c-1',
        sensorType: process.env.ENVIRONMENT_SENSOR_TYPE || 'DHT22',
        samplingInterval: 1000,
        tempOffset: 0,
        humidityOffset: 0,
        tempMin: STANDARD_ENVIRONMENT_LIMITS.TEMPERATURE.MIN,
        tempMax: STANDARD_ENVIRONMENT_LIMITS.TEMPERATURE.MAX,
        tempOptimal: STANDARD_ENVIRONMENT_LIMITS.TEMPERATURE.OPTIMAL,
        humidityMin: STANDARD_ENVIRONMENT_LIMITS.HUMIDITY.MIN,
        humidityMax: STANDARD_ENVIRONMENT_LIMITS.HUMIDITY.MAX,
        humidityOptimal: STANDARD_ENVIRONMENT_LIMITS.HUMIDITY.OPTIMAL
    };

    private lastError: string | undefined;

    private constructor() {
        this.serialManager = SerialManager.instance;
        console.log('[RealEnvironment] Real environment sensor created');
        console.log('[RealEnvironment] Using SerialManager for communication');
        console.log('[RealEnvironment] Sensor type:', this.config.sensorType);
    }

    /**
     * Get singleton instance
     */
    public static getInstance(): RealEnvironmentAPI {
        if (!RealEnvironmentAPI.instance) {
            RealEnvironmentAPI.instance = new RealEnvironmentAPI();
        }
        return RealEnvironmentAPI.instance;
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
            console.error(`[RealEnvironment] Command failed: ${command}`, error);
            this.lastError = error instanceof Error ? error.message : 'Unknown error';
            throw error;
        }
    }

    /**
     * Initialize the sensor
     */
    async initialize(): Promise<void> {
        console.log('[RealEnvironment] Initializing real environment sensor...');

        try {
            // Ensure SerialManager is connected
            if (!this.serialManager.connected) {
                await this.serialManager.connect(process.env.ROBOT_SERIAL_PORT || '/dev/ttyUSB0', 115200);
            }

            // Get initial status from hardware
            const response = await this.sendCommand('env_status');
            console.log('[RealEnvironment] Initialization response:', response);

            this.connected = response.connected;
            this.initialized = response.initialized;

            // Read initial values
            await this.refreshReading();

            console.log('[RealEnvironment] ✓ Environment sensor initialized');
        } catch (error) {
            this.lastError = error instanceof Error ? error.message : 'Unknown error';
            console.error('[RealEnvironment] Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Refresh reading from hardware (internal helper)
     */
    private async refreshReading(): Promise<void> {
        try {
            const response = await this.sendCommand('env_read');

            this.currentTemperature = response.temperature;
            this.currentHumidity = response.humidity;

            // Add to history
            const reading: EnvironmentReading = {
                temperature: this.getTemperature(),
                humidity: this.getHumidity(),
                timestamp: new Date(response.timestamp || Date.now())
            };

            this.history.push(reading);

            // Keep only last 1000 readings
            if (this.history.length > 1000) {
                this.history.shift();
            }
        } catch (error) {
            console.error('[RealEnvironment] Failed to refresh reading:', error);
            throw error;
        }
    }

    getTemperature(): number {
        return this.currentTemperature + this.tempOffset;
    }

    getHumidity(): number {
        return this.currentHumidity + this.humidityOffset;
    }

    getReading(): EnvironmentReading {
        return {
            temperature: this.getTemperature(),
            humidity: this.getHumidity(),
            timestamp: new Date()
        };
    }

    getHistory(count: number): EnvironmentReading[] {
        return this.history.slice(-count);
    }

    startMonitoring(interval: number = 1000, callback?: (reading: EnvironmentReading) => void): void {
        if (this.monitoring) {
            console.log('[RealEnvironment] Already monitoring');
            return;
        }

        console.log(`[RealEnvironment] Starting monitoring (interval: ${interval}ms)`);
        this.monitoring = true;

        this.monitoringInterval = setInterval(async () => {
            try {
                await this.refreshReading();

                if (callback) {
                    const reading = this.getReading();
                    callback(reading);
                }
            } catch (error) {
                console.error('[RealEnvironment] Monitoring error:', error);
                this.lastError = error instanceof Error ? error.message : 'Unknown error';
            }
        }, interval);
    }

    stopMonitoring(): void {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        this.monitoring = false;
        console.log('[RealEnvironment] Monitoring stopped');
    }

    isMonitoring(): boolean {
        return this.monitoring;
    }

    getStatus(): EnvironmentStatus {
        return {
            connected: this.connected,
            initialized: this.initialized,
            monitoring: this.monitoring,
            currentTemperature: this.getTemperature(),
            currentHumidity: this.getHumidity(),
            temperatureOffset: this.tempOffset,
            humidityOffset: this.humidityOffset,
            sampleCount: this.history.length,
            lastError: this.lastError
        };
    }

    setTemperatureOffset(offset: number): void {
        this.tempOffset = offset;
    }

    setHumidityOffset(offset: number): void {
        this.humidityOffset = offset;
    }

    validateConditions(): EnvironmentValidation {
        const temp = this.getTemperature();
        const humidity = this.getHumidity();

        return {
            valid: temp >= this.config.tempMin && temp <= this.config.tempMax &&
                   humidity >= this.config.humidityMin && humidity <= this.config.humidityMax,
            temperature: {
                value: temp,
                valid: temp >= this.config.tempMin && temp <= this.config.tempMax,
                min: this.config.tempMin,
                max: this.config.tempMax,
                optimal: this.config.tempOptimal
            },
            humidity: {
                value: humidity,
                valid: humidity >= this.config.humidityMin && humidity <= this.config.humidityMax,
                min: this.config.humidityMin,
                max: this.config.humidityMax,
                optimal: this.config.humidityOptimal
            },
            warnings: []
        };
    }

    isReady(): boolean {
        return this.connected && this.initialized;
    }

    async disconnect(): Promise<void> {
        console.log('[RealEnvironment] Disconnecting...');
        this.stopMonitoring();
        this.connected = false;
        this.initialized = false;
    }

    updateConfig(config: Partial<EnvironmentConfig>): void {
        this.config = { ...this.config, ...config };
        console.log('[RealEnvironment] Configuration updated:', this.config);
    }
}

// Export singleton instance getter
export const getRealEnvironmentAPI = () => RealEnvironmentAPI.getInstance();
