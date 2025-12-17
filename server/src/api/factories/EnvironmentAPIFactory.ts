import { IEnvironmentAPI } from '../interfaces/IEnvironmentAPI';
import { MockEnvironmentAPI } from '../implementations/mock/MockEnvironmentAPI';
import { RealEnvironmentAPI } from '../implementations/real/RealEnvironmentAPI';

export class EnvironmentAPIFactory {
    private static instance: IEnvironmentAPI | null = null;

    /**
     * Get environment API instance
     * Returns mock or real implementation based on environment
     */
    public static getEnvironmentAPI(): IEnvironmentAPI {
        if (this.instance) {
            return this.instance;
        }

        const useMock = process.env.USE_MOCK_ENVIRONMENT !== 'false';

        if (useMock) {
            console.log('='.repeat(60));
            console.log('🌡️  MOCK ENVIRONMENT MODE');
            console.log('Using MockEnvironmentAPI - No real sensors will be accessed');
            console.log('Simulating temperature and humidity with realistic variations');
            console.log('='.repeat(60));
            this.instance = MockEnvironmentAPI.getInstance();
        } else {
            console.log('='.repeat(60));
            console.log('🌡️  REAL ENVIRONMENT MODE');
            console.log('Using RealEnvironmentAPI - Connecting to hardware');
            console.log('Port:', process.env.ENVIRONMENT_PORT || '/dev/i2c-1');
            console.log('Sensor:', process.env.ENVIRONMENT_SENSOR_TYPE || 'DHT22');
            console.log('='.repeat(60));
            this.instance = RealEnvironmentAPI.getInstance();
        }

        return this.instance;
    }

    /**
     * Reset factory (for testing purposes)
     */
    public static reset(): void {
        this.instance = null;
    }

    /**
     * Check if using mock mode
     */
    public static isMockMode(): boolean {
        return process.env.USE_MOCK_ENVIRONMENT !== 'false';
    }
}
