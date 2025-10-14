const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const DoctorProfile = sequelize.define('DoctorProfile', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  specialization: { type: DataTypes.STRING },
  qualifications: { type: DataTypes.STRING },
  clinicAddress: { type: DataTypes.STRING },
  licenseNumber: { type: DataTypes.STRING },
}, { timestamps: true });

module.exports = DoctorProfile;
