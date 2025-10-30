export type Sensor = {
    sensor_id: number | null;
    sensor_name: string;
    manufacturer: string;
    product_reference: string | null;
    description: string;
    hw_version: string | null;
    fw_version: string | null;
    mounting_height_m: number;
    notes: string | null;
};