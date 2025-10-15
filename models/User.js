const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const User = sequelize.define('User', {
  user_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  },
  full_name: {
    type: DataTypes.STRING(150),
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  phone: {
    type: DataTypes.STRING(30),
    allowNull: true,
  },
  role: {
    type: DataTypes.ENUM(
      'PATIENT',
      'DOCTOR',
      'THERAPIST',
      'TRANSLATOR',
      'DONOR',
      'NGO',
      'MISSION_COORDINATOR',
      'VOLUNTEER',
      'COURIER',
      'PHARMACY',
      'HOSPITAL_STAFF',
      'CONTENT_EDITOR',
      'ALERT_MANAGER',
      'FINANCE_MANAGER',
      'MODERATOR',
      'AUDITOR',
      'ADMIN'
    ),
    allowNull: false,
    defaultValue: 'PATIENT',
  },
  status: {
    type: DataTypes.ENUM('ACTIVE', 'INACTIVE'),
    allowNull: false,
    defaultValue: 'ACTIVE',
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'users', // 👈 Matches your SQL table name
  timestamps: false,  // 👈 We manually define created_at & updated_at
});

module.exports = User;