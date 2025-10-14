const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Receipt = sequelize.define('Receipt', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  invoiceId: { type: DataTypes.INTEGER.UNSIGNED },
  amount: { type: DataTypes.DECIMAL(12,2), allowNull: false },
  method: { type: DataTypes.ENUM('card','bank','cash','other'), defaultValue: 'card' },
}, { timestamps: true });

module.exports = Receipt;
