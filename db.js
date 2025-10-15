require('dotenv').config();  // โหลดค่า environment variables

const mysql = require('mysql2/promise');

// สร้าง connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || '3306',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'club_db',
});

// ตัวอย่างการใช้งาน async/await เพื่อเชื่อมต่อ
async function connectDatabase() {
  try {
    const connection = await pool.getConnection();
    console.log("You are connected!");
    connection.release();  // ปล่อยการเชื่อมต่อหลังใช้งาน
  } catch (err) {
    console.error("Connection failed:", err);
  }
}

connectDatabase();  // เรียกใช้งานฟังก์ชัน

module.exports = pool;
