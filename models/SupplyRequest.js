const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const SupplyRequest = sequelize.define('SupplyRequest', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  requesterType: { type: DataTypes.ENUM('hospital','ngo','clinic'), defaultValue: 'clinic' },
  requesterId: { type: DataTypes.INTEGER.UNSIGNED },
  items: { type: DataTypes.JSON },
  status: { type: DataTypes.ENUM('pending','fulfilled','cancelled'), defaultValue: 'pending' },
}, { timestamps: true });

module.exports = SupplyRequest;
