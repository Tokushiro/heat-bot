import { IStandAPI } from '../interfaces/IStandAPI';
import { MockStandAPI } from '../implementations/mock/MockStandAPI';
import { RealStandAPI } from '../implementations/real/RealStandAPI';


export class StandAPIFactory {
    private static instance: IStandAPI | null = null;

    /**
     * Get stand API instance
     * Returns mock or real implementation based on environment
     */
    public static getStandAPI(): IStandAPI {
        if (this.instance) {
            return this.instance;
        }

        const useMock = process.env.USE_MOCK_STAND !== 'false';

        if (useMock) {
            console.log('='.repeat(60));
            console.log('🔄 MOCK STAND MODE');
            console.log('Using MockStandAPI - No real hardware will be accessed');
            console.log('='.repeat(60));
            this.instance = MockStandAPI.getInstance();
        } else {
            console.log('='.repeat(60));
            console.log('⚙️  REAL STAND MODE');
            console.log('Using RealStandAPI - Connecting to hardware');
            console.log('Port:', process.env.STAND_SERIAL_PORT || '/dev/ttyUSB0');
            console.log('='.repeat(60));
            this.instance = RealStandAPI.getInstance();
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
        return process.env.USE_MOCK_STAND !== 'false';
    }
}
