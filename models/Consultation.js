const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Consultation = sequelize.define('Consultation', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  patientId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  doctorId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  scheduledAt: { type: DataTypes.DATE },
  status: { type: DataTypes.ENUM('scheduled','completed','cancelled'), defaultValue: 'scheduled' },
  notes: { type: DataTypes.TEXT },
  mode: { type: DataTypes.ENUM('in-person','telehealth'), defaultValue: 'telehealth' },
}, { timestamps: true });

module.exports = Consultation;
