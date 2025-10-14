const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const NgoProfile = sequelize.define('NgoProfile', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  name: { type: DataTypes.STRING },
  registrationNumber: { type: DataTypes.STRING },
  address: { type: DataTypes.STRING },
}, { timestamps: true });

module.exports = NgoProfile;
