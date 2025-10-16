import pool from '../src/db_conn';

async function getAllSensors() {
    const query = 'SELECT sensor_id, name as sensor_name FROM sensors ORDER BY name';
    try {
        const result = await pool.query(query);
        return result.rows;
    } catch (error) {
        console.error('Error executing query:', error);
        throw error;
    }
}


export { getAllSensors };