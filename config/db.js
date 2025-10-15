// config/database.js
const { Sequelize } = require('sequelize');
require('dotenv').config();

// config/database.js
const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'healthpal_db',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '123456789',
  {
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
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

// Test connection
sequelize.authenticate()
  .then(() => console.log('✅ Database connected'))
  .catch(err => console.error('❌ Unable to connect:', err));

module.exports = sequelize; // export the **instance**, not { sequelize, Sequelize }
