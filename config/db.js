const { Sequelize } = require('sequelize');
require('dotenv').config();


const sequelize = new Sequelize(
  process.env.DB_NAME || 'healthpal_db1',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '123456789',   // <-- changed from DB_PASS
  {
    host: process.env.DB_HOST || '127.0.0.1',
    dialect: 'mysql',
    logging: false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  }
);


// Test the connection to the database
async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('Database connected...');
  } catch (err) {
    console.error('Unable to connect to database:', err);
  }
}

testConnection(); // Call the testConnection function to verify database connection

module.exports = { sequelize, Sequelize };
