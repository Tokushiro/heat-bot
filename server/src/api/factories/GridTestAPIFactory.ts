import { IGridTestAPI } from '../interfaces/IGridTestAPI';
import { MockGridTestAPI } from '../implementations/mock/MockGridTestAPI';
import { RealGridTestAPI } from '../implementations/real/RealGridTestAPI';


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
