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

export async function getAllSensors(): Promise<Sensor[]> {
    const query = `
    SELECT
      sensor_id,
      name AS sensor_name,
      manufacturer,
      product_reference,
      description,
      hw_version,
      sw_version,
      mounting_height,
      note
    FROM
      sensor
  `;

    const result = await pool.query(query);
    return result.rows.map((row) => ({
        sensor_id: row.sensor_id,
        sensor_name: row.sensor_name,
        manufacturer: row.manufacturer,
        product_reference: row.product_reference,
        description: row.description,
        hw_version: row.hw_version,
        fw_version: row.sw_version,
        mounting_height_m: row.mounting_height,
        notes: row.note,
    }));
}