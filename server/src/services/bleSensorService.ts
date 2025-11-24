import EventEmitter from 'events';
import noble, {
    Peripheral,
    Characteristic,
} from '@abandonware/noble';

export interface DetectionEvent {
    detected: boolean;
    timestamp: Date;
    raw: Buffer;
}

type BleSensorServiceEvents = {
    detection: (event: DetectionEvent) => void;
    connected: () => void;
    disconnected: () => void;
    error: (err: Error) => void;
};

class TypedEmitter<T> extends EventEmitter {
    override on<K extends keyof T>(eventName: K, listener: T[K]): this {
        return super.on(eventName as string, listener as any);
    }

    override off<K extends keyof T>(eventName: K, listener: T[K]): this {
        return super.off(eventName as string, listener as any);
    }

    override emit<K extends keyof T>(
        eventName: K,
        ...args: T[K] extends (...a: infer P) => any ? P : never
    ): boolean {
        return super.emit(eventName as string, ...args);
    }
}

class BleSensorService extends TypedEmitter<BleSensorServiceEvents> {
    private readonly targetMac: string;
    private readonly serviceUuid?: string;
    private readonly charUuid?: string;

    private connectedPeripheral: Peripheral | null = null;
    private detectionChar: Characteristic | null = null;
    private started = false;

    constructor() {
        super();

        this.targetMac = (process.env.BLE_SENSOR_MAC || '').toLowerCase();
        this.serviceUuid = process.env.BLE_SERVICE_UUID?.toLowerCase();
        this.charUuid = process.env.BLE_CHAR_UUID?.toLowerCase();

        if (!this.targetMac) {
            throw new Error('BLE_SENSOR_MAC is not set in environment.');
        }

        noble.on('stateChange', this.handleStateChange);
        noble.on('discover', this.handleDiscover);
    }

    public async start(): Promise<void> {
        this.started = true;
        if (noble.state === 'poweredOn') {
            await this.startScanning();
        }
    }

    public async stop(): Promise<void> {
        this.started = false;
        await noble.stopScanningAsync().catch(() => {});
        if (this.connectedPeripheral) {
            this.connectedPeripheral.disconnect();
            this.connectedPeripheral = null;
        }
    }


    private handleStateChange = async (state: string) => {
        if (!this.started) return;

        if (state === 'poweredOn') {
            await this.startScanning();
        } else {
            await noble.stopScanningAsync().catch(() => {});
        }
    };

    private startScanning = async () => {
        const serviceUuids = this.serviceUuid ? [this.serviceUuid] : [];

        try {
            await noble.startScanningAsync(serviceUuids, false); // false = no duplicates
            console.log('[BLE] Scanning for sensor...', {
                mac: this.targetMac,
                serviceUuids,
            });
        } catch (err) {
            console.error('[BLE] Failed to start scanning', err);
            this.emit('error', err as Error);
        }
    };

    private handleDiscover = async (peripheral: Peripheral) => {
        const mac = (peripheral.address || '').toLowerCase();

        const id = (peripheral.id || '').toLowerCase();

        if (mac !== this.targetMac && id !== this.targetMac) {
            return;
        }

        console.log('[BLE] Found target sensor, connecting...', {
            mac,
            id,
            localName: peripheral.advertisement.localName,
        });

        await noble.stopScanningAsync().catch(() => {});

        peripheral.once('disconnect', () => {
            console.warn('[BLE] Sensor disconnected');
            this.connectedPeripheral = null;
            this.detectionChar = null;
            this.emit('disconnected');

            // try to re-scan if service is still started
            if (this.started) {
                this.startScanning().catch(console.error);
            }
        });

        try {
            await peripheral.connectAsync();
            this.connectedPeripheral = peripheral;
            this.emit('connected');

            await this.setupNotification(peripheral);
        } catch (err) {
            console.error('[BLE] Failed to connect or setup notifications', err);
            this.emit('error', err as Error);

            if (this.started) {
                this.startScanning().catch(console.error);
            }
        }
    };

    private async setupNotification(peripheral: Peripheral) {
        const services = await peripheral.discoverServicesAsync(
            this.serviceUuid ? [this.serviceUuid] : []
        );

        if (services.length === 0) {
            throw new Error('No matching BLE services found on sensor');
        }

        const service = services[0];

        const characteristics = await service.discoverCharacteristicsAsync(
            this.charUuid ? [this.charUuid] : []
        );

        if (characteristics.length === 0) {
            throw new Error('No matching BLE characteristics found on sensor');
        }

        const char = characteristics[0];
        this.detectionChar = char;

        char.on('data', (data: Buffer, isNotification: boolean) => {
            if (!isNotification) return;
            this.handleDetectionData(data);
        });

        await char.subscribeAsync();
        console.log('[BLE] Subscribed to detection characteristic');
    }


    private handleDetectionData(data: Buffer) {

        const byte = data[0];

        const detected = byte === 1;

        const event: DetectionEvent = {
            detected,
            timestamp: new Date(),
            raw: data,
        };

        this.emit('detection', event);
    }
}


const bleSensorService = new BleSensorService();
export default bleSensorService;
