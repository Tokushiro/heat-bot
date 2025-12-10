import { IHeatingAPI } from '../interfaces/IHeatingAPI';
import { MockHeatingAPI } from '../implementations/mock/MockHeatingAPI';
import { RealHeatingAPI } from '../implementations/real/RealHeatingAPI';

/**
 * Heating API Factory
 *
 * Creates the appropriate heating controller implementation based on environment configuration.
 * Uses singleton pattern to ensure only one instance exists.
 *
 * Environment Variables:
 * - USE_MOCK_HEATING: Set to 'true' to use mock implementation (default)
 * - HEATING_PORT: Serial/communication port for real heating hardware
 */
export class HeatingAPIFactory {
    private static instance: IHeatingAPI | null = null;

    /**
     * Get heating API instance
     * Returns mock or real implementation based on environment
     */
    public static getHeatingAPI(): IHeatingAPI {
        if (this.instance) {
            return this.instance;
        }

        const useMock = process.env.USE_MOCK_HEATING !== 'false';

        if (useMock) {
            console.log('='.repeat(60));
            console.log('🔥 MOCK HEATING MODE');
            console.log('Using MockHeatingAPI - No real hardware will be accessed');
            console.log('Simulating thermal manikin with 3 zones (Head/Body/Legs)');
            console.log('='.repeat(60));
            this.instance = MockHeatingAPI.getInstance();
        } else {
            console.log('='.repeat(60));
            console.log('🔥 REAL HEATING MODE');
            console.log('Using RealHeatingAPI - Connecting to hardware');
            console.log('Port:', process.env.HEATING_PORT || '/dev/ttyUSB1');
            console.log('='.repeat(60));
            this.instance = RealHeatingAPI.getInstance();
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
        return process.env.USE_MOCK_HEATING !== 'false';
    }
}
