const mysql = require("mysql2/promise");

console.log("Connecting to DB:", {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  database: process.env.DB_NAME
});

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 60000, // 60 seconds - valid option
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
  // Removed: acquireTimeout and timeout (deprecated in mysql2)
});

// Test query
(async () => {
  try {
    const [rows1] = await pool.query("SHOW TABLES LIKE 'batches'");
    console.log("DB Test - batches table found:", rows1.length > 0);

    const [rows2] = await pool.query("SELECT 1 FROM batches LIMIT 1");
    console.log("DB Test - SELECT FROM batches SUCCESS");

    const [rows3] = await pool.query("SELECT 1 FROM treks LIMIT 1");
    console.log("DB Test - SELECT FROM treks SUCCESS");
  } catch (e) {
    console.error("DB Test - error:", e.message);
  }
})();

module.exports = pool;
