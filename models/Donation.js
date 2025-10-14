const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Donation = sequelize.define('Donation', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  donorId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  caseId: { type: DataTypes.INTEGER.UNSIGNED },
  amount: { type: DataTypes.DECIMAL(12,2), allowNull: false },
  currency: { type: DataTypes.STRING, defaultValue: 'USD' },
  status: { type: DataTypes.ENUM('pending','completed','failed'), defaultValue: 'pending' },
  metadata: { type: DataTypes.JSON },
}, { timestamps: true });

module.exports = Donation;
