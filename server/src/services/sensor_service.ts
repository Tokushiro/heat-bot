import pool from "../db_conn";
import type { Sensor } from "../models/sensor";

export async function insertSensor(sensor: Sensor): Promise<void> {
    const {
        sensor_name,
        manufacturer,
        product_reference,
        description,
        hw_version,
        fw_version,
        mounting_height_m,
        notes,
    } = sensor;

    const query = `
    INSERT INTO sensor
      (name, manufacturer, product_reference, description, hw_version, sw_version, mounting_height, note)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8)
  `;

    const values = [
        sensor_name,
        manufacturer,
        product_reference ?? null,
        description,
        hw_version ?? null,
        fw_version ?? null,
        mounting_height_m,
        notes ?? null,
    ];

    await pool.query(query, values); 
}
