const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const DonorProfile = sequelize.define('DonorProfile', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  organization: { type: DataTypes.STRING },
  address: { type: DataTypes.STRING },
}, { timestamps: true });

module.exports = DonorProfile;
