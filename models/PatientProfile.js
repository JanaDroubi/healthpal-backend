const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const PatientProfile = sequelize.define('PatientProfile', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  dob: { type: DataTypes.DATEONLY },
  gender: { type: DataTypes.ENUM('male','female','other') },
  address: { type: DataTypes.STRING },
  medicalHistory: { type: DataTypes.TEXT },
}, { timestamps: true });

module.exports = PatientProfile;
