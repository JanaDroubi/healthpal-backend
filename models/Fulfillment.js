const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Fulfillment = sequelize.define('Fulfillment', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  requestId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  fulfilledBy: { type: DataTypes.STRING },
  items: { type: DataTypes.JSON },
  status: { type: DataTypes.ENUM('initiated','in-transit','delivered'), defaultValue: 'initiated' },
}, { timestamps: true });

module.exports = Fulfillment;
