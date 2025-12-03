import pool from "../db_conn";
import type { Sensor } from "../models/sensor";
import bleEventBus, { DetectionEvent } from "./bleEventBus";
import websocketService from "./websocket_service";

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

export async function checkSensorsExist(): Promise<boolean> {
    const query = `SELECT COUNT(*) FROM sensor`;
    const result = await pool.query(query);
    const count = parseInt(result.rows[0].count, 10);
    return count > 0;
}


export async function processBleDetectionEvent(payload: any): Promise<void> {
    const { detected, timestamp, raw } = payload ?? {};

    if (typeof detected !== "boolean") {
        throw new Error("Invalid payload: 'detected' must be a boolean.");
    }

    if (!Array.isArray(raw)) {
        throw new Error("Invalid payload: 'raw' must be an array.");
    }

    const event: DetectionEvent = {
        detected,
        timestamp:
            typeof timestamp === "string"
                ? timestamp
                : new Date().toISOString(),
        raw,
    };

    // Notify the rest of the system
    bleEventBus.emit("detection", event);

    // Broadcast to frontend listeners in real time
    websocketService.broadcastSensorDetection(event);


}
