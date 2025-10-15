const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const User = require('./User'); // Make sure the User model path is correct

const PatientProfile = sequelize.define('PatientProfile', {
  user_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    references: {
      model: User,
      key: 'user_id',
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  },
  dob: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  gender: {
    type: DataTypes.ENUM('M', 'F'),
    allowNull: true,
  },
  blood_type: {
    type: DataTypes.ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'),
    allowNull: true,
  },
  height_cm: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    validate: {
      min: 0,
    },
  },
  weight_kg: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    validate: {
      min: 0,
    },
  },
  emergency_contact_phone: {
    type: DataTypes.STRING(30),
    allowNull: true,
  },
  country: {
    type: DataTypes.STRING(80),
    allowNull: true,
  },
  city: {
    type: DataTypes.STRING(80),
    allowNull: true,
  },
  marital_status: {
    type: DataTypes.ENUM('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED'),
    allowNull: true,
  },
  occupation: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  preferred_language: {
    type: DataTypes.STRING(10),
    allowNull: false,
    defaultValue: 'ar',
  },
  allergies_summary: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  chronic_conditions_summary: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  medical_history: {
    type: DataTypes.TEXT,
    allowNull: true,
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
  tableName: 'patient_profiles',
  timestamps: false, // manually handling timestamps
});


// ✅ Associations (must be defined after both models are initialized)
User.hasOne(PatientProfile, { foreignKey: 'user_id', onDelete: 'CASCADE' });
PatientProfile.belongsTo(User, { foreignKey: 'user_id', onDelete: 'CASCADE' });

module.exports = PatientProfile;