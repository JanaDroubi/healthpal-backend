const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const EquipmentInventory = sequelize.define('EquipmentInventory', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  itemId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  serialNumber: { type: DataTypes.STRING },
  quantity: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
  status: { type: DataTypes.ENUM('available','in-use','maintenance','decommissioned'), defaultValue: 'available' },
}, { timestamps: true });

module.exports = EquipmentInventory;
