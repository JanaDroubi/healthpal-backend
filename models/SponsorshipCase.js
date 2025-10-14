const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const SponsorshipCase = sequelize.define('SponsorshipCase', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  targetAmount: { type: DataTypes.DECIMAL(12,2), defaultValue: 0 },
  status: { type: DataTypes.ENUM('open','funded','closed'), defaultValue: 'open' },
}, { timestamps: true });

module.exports = SponsorshipCase;
