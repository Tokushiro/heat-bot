import { IGridTestAPI } from '../interfaces/IGridTestAPI';
import { MockGridTestAPI } from '../implementations/mock/MockGridTestAPI';
import { RealGridTestAPI } from '../implementations/real/RealGridTestAPI';

/**
 * Grid Test API Factory
 *
 * Creates the appropriate grid test implementation based on configuration.
 * Uses singleton pattern to ensure only one instance exists.
 *
 * Environment Variables:
 * - USE_MOCK_GRIDTEST: Set to 'true' to use mock implementation (default)
 * - GRIDTEST_ROBOT_PORT: Serial port for real robot (e.g., '/dev/ttyUSB2' or 'COM3')
 *
 * Note: Real implementation will communicate through SerialManager,
 * similar to the robot API implementation.
 */
export class GridTestAPIFactory {
    private static instance: IGridTestAPI | null = null;

    /**
     * Get grid test API instance
     * Returns mock or real implementation based on environment
     */
    public static getGridTestAPI(): IGridTestAPI {
        if (this.instance) {
            return this.instance;
        }

        const useMock = process.env.USE_MOCK_GRIDTEST !== 'false';

        if (useMock) {
            console.log('='.repeat(60));
            console.log('🤖 MOCK GRID TEST MODE');
            console.log('Using MockGridTestAPI - No real robot will be controlled');
            console.log('Simulating grid-based detector coverage testing');
            console.log('Integration with mock stand and environment sensors');
            console.log('='.repeat(60));
            this.instance = MockGridTestAPI.getInstance();
        } else {
            console.log('='.repeat(60));
            console.log('🤖 REAL GRID TEST MODE');
            console.log('Using RealGridTestAPI - Connecting to robot hardware');
            console.log('Port:', process.env.GRIDTEST_ROBOT_PORT || '/dev/ttyUSB2');
            console.log('Communication through SerialManager');
            console.log('='.repeat(60));
            this.instance = RealGridTestAPI.getInstance();
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
        return process.env.USE_MOCK_GRIDTEST !== 'false';
    }
}
