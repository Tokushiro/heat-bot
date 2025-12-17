import {
    IEnvironmentAPI,
    EnvironmentReading,
    EnvironmentStatus,
    EnvironmentValidation,
    ValidationResult,
    EnvironmentConfig,
    STANDARD_ENVIRONMENT_LIMITS
} from '../../interfaces/IEnvironmentAPI';
import { TimeUtility } from '../../../utils/TimeUtility';


export class MockEnvironmentAPI implements IEnvironmentAPI {
    private static instance: MockEnvironmentAPI;

    private connected: boolean = false;
    private initialized: boolean = false;
    private monitoring: boolean = false;

    // Current readings
    private currentTemperature: number = 20;  // °C
    private currentHumidity: number = 70;      // % RH

    // Calibration offsets
    private tempOffset: number = 0;
    private humidityOffset: number = 0;

    // History
    private history: EnvironmentReading[] = [];
    private maxHistorySize: number = 1000;

    // Monitoring
    private monitoringInterval: NodeJS.Timeout | null = null;
    private monitoringCallback?: (reading: EnvironmentReading) => void;

    // Simulation parameters
    private simulationTime: number = 0;  // Simulated time in seconds
    private baseTemperature: number = 20;
    private baseHumidity: number = 70;

    // Configuration
    private config: Required<EnvironmentConfig> = {
        port: 'MOCK',
        sensorType: 'DHT22_SIMULATED',
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
        console.log('[MockEnvironment] Mock environment sensor created');
    }

    /**
     * Get singleton instance
     */
    public static getInstance(): MockEnvironmentAPI {
        if (!MockEnvironmentAPI.instance) {
            MockEnvironmentAPI.instance = new MockEnvironmentAPI();
        }
        return MockEnvironmentAPI.instance;
    }

    /**
     * Initialize the sensor
     */
    async initialize(): Promise<void> {
        console.log('[MockEnvironment] Initializing mock environment sensor...');

        // Simulate connection delay
        await this.delay(300);

        this.connected = true;

        // Initialize with standard conditions
        this.currentTemperature = this.baseTemperature;
        this.currentHumidity = this.baseHumidity;

        // Record initial reading
        this.recordReading();

        this.initialized = true;

        console.log('[MockEnvironment] ✅ Environment sensor initialized');
        console.log(`[MockEnvironment] Temperature: ${this.currentTemperature.toFixed(1)}°C`);
        console.log(`[MockEnvironment] Humidity: ${this.currentHumidity.toFixed(1)}% RH`);
    }

    /**
     * Get current temperature
     */
    getTemperature(): number {
        return parseFloat((this.currentTemperature + this.tempOffset).toFixed(2));
    }

    /**
     * Get current humidity
     */
    getHumidity(): number {
        return parseFloat((this.currentHumidity + this.humidityOffset).toFixed(2));
    }

    /**
     * Get complete reading
     */
    getReading(): EnvironmentReading {
        const reading: EnvironmentReading = {
            temperature: this.getTemperature(),
            humidity: this.getHumidity(),
            timestamp: new Date(),
            temperatureRaw: this.currentTemperature,
            humidityRaw: this.currentHumidity,
            dewPoint: this.calculateDewPoint(this.getTemperature(), this.getHumidity())
        };

        return reading;
    }

    /**
     * Get historical readings
     */
    getHistory(count: number): EnvironmentReading[] {
        return this.history.slice(-count);
    }

    /**
     * Start continuous monitoring with simulation speed adjustment
     */
    startMonitoring(interval: number = 1000, callback?: (reading: EnvironmentReading) => void): void {
        if (this.monitoring) {
            console.log('[MockEnvironment] Monitoring already active');
            return;
        }

        const adjustedInterval = TimeUtility.adjustInterval(interval);
        console.log(`[MockEnvironment] Starting continuous monitoring (${interval}ms interval, adjusted: ${adjustedInterval}ms)`);

        this.monitoringCallback = callback;
        this.monitoring = true;

        this.monitoringInterval = setInterval(() => {
            this.updateSimulation();
            const reading = this.getReading();
            this.recordReading();

            if (this.monitoringCallback) {
                this.monitoringCallback(reading);
            }
        }, adjustedInterval);
    }

    /**
     * Stop continuous monitoring
     */
    stopMonitoring(): void {
        if (!this.monitoring) {
            return;
        }

        console.log('[MockEnvironment] Stopping continuous monitoring');

        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }

        this.monitoring = false;
        this.monitoringCallback = undefined;
    }

    /**
     * Check if monitoring is active
     */
    isMonitoring(): boolean {
        return this.monitoring;
    }

    /**
     * Get sensor status
     */
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
            lastSampleTime: this.history.length > 0 ? this.history[this.history.length - 1].timestamp : undefined,
            lastError: this.lastError
        };
    }

    /**
     * Set temperature calibration offset
     */
    setTemperatureOffset(offset: number): void {
        console.log(`[MockEnvironment] Temperature offset set to ${offset.toFixed(2)}°C`);
        this.tempOffset = offset;
    }

    /**
     * Set humidity calibration offset
     */
    setHumidityOffset(offset: number): void {
        console.log(`[MockEnvironment] Humidity offset set to ${offset.toFixed(2)}% RH`);
        this.humidityOffset = offset;
    }

    /**
     * Validate environmental conditions
     */
    validateConditions(): EnvironmentValidation {
        const temp = this.getTemperature();
        const humidity = this.getHumidity();

        const tempResult: ValidationResult = {
            value: temp,
            valid: temp >= this.config.tempMin && temp <= this.config.tempMax,
            min: this.config.tempMin,
            max: this.config.tempMax,
            optimal: this.config.tempOptimal,
            message: temp < this.config.tempMin ? 'Temperature too low' :
                     temp > this.config.tempMax ? 'Temperature too high' : undefined
        };

        const humidityResult: ValidationResult = {
            value: humidity,
            valid: humidity >= this.config.humidityMin && humidity <= this.config.humidityMax,
            min: this.config.humidityMin,
            max: this.config.humidityMax,
            optimal: this.config.humidityOptimal,
            message: humidity < this.config.humidityMin ? 'Humidity too low' :
                     humidity > this.config.humidityMax ? 'Humidity too high' : undefined
        };

        const warnings: string[] = [];

        // Check for optimal conditions
        if (Math.abs(temp - this.config.tempOptimal) > 5) {
            warnings.push(`Temperature ${temp.toFixed(1)}°C is far from optimal (${this.config.tempOptimal}°C)`);
        }

        if (Math.abs(humidity - this.config.humidityOptimal) > 10) {
            warnings.push(`Humidity ${humidity.toFixed(1)}% RH is far from optimal (${this.config.humidityOptimal}%)`);
        }

        return {
            valid: tempResult.valid && humidityResult.valid,
            temperature: tempResult,
            humidity: humidityResult,
            warnings
        };
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
        console.log('[MockEnvironment] Disconnecting environment sensor...');

        this.stopMonitoring();

        this.connected = false;
        this.initialized = false;

        console.log('[MockEnvironment] ✅ Disconnected');
    }

    /**
     * Update configuration
     */
    updateConfig(config: Partial<EnvironmentConfig>): void {
        this.config = { ...this.config, ...config };
        console.log('[MockEnvironment] Configuration updated:', this.config);
    }

    /**
     * Set base conditions (for testing)
     */
    setBaseConditions(temperature: number, humidity: number): void {
        console.log(`[MockEnvironment] Base conditions set: ${temperature}°C, ${humidity}% RH`);
        this.baseTemperature = temperature;
        this.baseHumidity = humidity;
        this.currentTemperature = temperature;
        this.currentHumidity = humidity;
    }

    // Private helper methods

    /**
     * Update simulation
     */
    private updateSimulation(): void {
        this.simulationTime += this.config.samplingInterval / 1000;

        // Simulate gradual temperature changes
        // Daily cycle: ±3°C variation over 24 hours
        const dailyCycle = Math.sin((this.simulationTime / 3600) * (2 * Math.PI / 24)) * 3;

        // Random fluctuations: ±0.3°C
        const tempNoise = (Math.random() - 0.5) * 0.6;

        this.currentTemperature = this.baseTemperature + dailyCycle + tempNoise;

        // Simulate humidity changes
        // Inverse correlation with temperature: as temp increases, humidity decreases slightly
        const humidityTempEffect = -dailyCycle * 2;

        // Random fluctuations: ±3% RH
        const humidityNoise = (Math.random() - 0.5) * 6;

        this.currentHumidity = this.baseHumidity + humidityTempEffect + humidityNoise;

        // Clamp to realistic ranges
        this.currentTemperature = Math.max(10, Math.min(40, this.currentTemperature));
        this.currentHumidity = Math.max(30, Math.min(95, this.currentHumidity));
    }

    /**
     * Record a reading to history
     */
    private recordReading(): void {
        const reading = this.getReading();

        this.history.push(reading);

        // Trim history if too large
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        }
    }

    /**
     * Calculate dew point
     * Magnus formula approximation
     */
    private calculateDewPoint(temp: number, humidity: number): number {
        const a = 17.27;
        const b = 237.7;

        const alpha = ((a * temp) / (b + temp)) + Math.log(humidity / 100);
        const dewPoint = (b * alpha) / (a - alpha);

        return parseFloat(dewPoint.toFixed(2));
    }

    /**
     * Delay helper with simulation speed adjustment
     */
    private delay(ms: number): Promise<void> {
        return TimeUtility.delay(ms);
    }

    /**
     * Reset for testing
     */
    reset(): void {
        this.stopMonitoring();
        this.connected = false;
        this.initialized = false;
        this.currentTemperature = this.baseTemperature;
        this.currentHumidity = this.baseHumidity;
        this.tempOffset = 0;
        this.humidityOffset = 0;
        this.history = [];
        this.simulationTime = 0;
        this.lastError = undefined;
        console.log('[MockEnvironment] Environment sensor reset');
    }
}

// Export singleton instance getter
export const getMockEnvironmentAPI = () => MockEnvironmentAPI.getInstance();
