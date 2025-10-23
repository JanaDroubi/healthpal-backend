const mySqlPool = require("../../config/db"); // point to db.js

async function testConnection() {
  try {
    const connection = await mySqlPool.getConnection();
    console.log("✅ Database connection successful!");

    const [rows] = await connection.query("SHOW TABLES;");
    console.log("Tables in database:");
    console.table(rows);

    connection.release();
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
  }
}

testConnection();
