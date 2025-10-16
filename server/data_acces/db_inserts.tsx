import pool from '../src/db_conn';

async function insertSensor(
    sensorName: string,
    manufacturer: string,
    product_reference: string,
    description: string,
    hv_version: string | null = null,
    lv_version: string | null = null,
    mounting_height: number,
    note: string | null = null
) {
    const query = `
        INSERT INTO sensors (sensor_name, manufacturer, product_reference, description, hv_version, lv_version, mounting_height, note)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
    const values = [
        sensorName,
        manufacturer,
        product_reference,
        description,
        hv_version ?? null,
        lv_version ?? null,
        mounting_height,
        note ?? null
    ];
    try {
        await pool.query(query, values);
    } catch (error) {
        console.error('Error executing query:', error);
        throw error;
    }
}

export { insertSensor };

