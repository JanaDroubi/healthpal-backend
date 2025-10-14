const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Invoice = sequelize.define('Invoice', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  number: { type: DataTypes.STRING, unique: true },
  total: { type: DataTypes.DECIMAL(12,2), defaultValue: 0 },
  status: { type: DataTypes.ENUM('unpaid','paid','cancelled'), defaultValue: 'unpaid' },
}, { timestamps: true });

module.exports = Invoice;
