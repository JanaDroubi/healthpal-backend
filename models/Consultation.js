const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const PatientProfile = require('./PatientProfile');       // adjust path as needed
const DoctorProfile = require('./DoctorProfile');         // adjust path as needed
const AvailabilitySlot = require('./AvailabilitySlot');   // adjust path as needed

const Consultation = sequelize.define('Consultation', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  },
  patient_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
    references: {
      model: PatientProfile,
      key: 'user_id',
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  },
  doctor_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
    references: {
      model: DoctorProfile,
      key: 'user_id',
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  },
  slot_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
    references: {
      model: AvailabilitySlot,
      key: 'id',
    },
    onUpdate: 'SET NULL',
    onDelete: 'SET NULL',
  },
  status: {
    type: DataTypes.ENUM(
      'PENDING',
      'CONFIRMED',
      'IN_PROGRESS',
      'COMPLETED',
      'CANCELLED'
    ),
    allowNull: false,
    defaultValue: 'PENDING',
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  mode: {
    type: DataTypes.ENUM('VIDEO', 'AUDIO', 'ASYNC_MSG'),
    allowNull: false,
    defaultValue: 'AUDIO',
  },
  low_bandwidth: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false, // matches TINYINT DEFAULT 0
  },
  started_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  ended_at: {
    type: DataTypes.DATE,
    allowNull: true,
    validate: {
      isAfterStart(value) {
        if (this.started_at && value && value < this.started_at) {
          throw new Error('ended_at must be after started_at');
        }
      },
    },
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'consultations',
  timestamps: false, // handled manually with created_at & updated_at
  indexes: [
    { name: 'idx_consult_doctor_status', fields: ['doctor_id', 'status', 'created_at'] },
    { name: 'idx_consult_patient_status', fields: ['patient_id', 'status', 'created_at'] },
    { name: 'idx_consult_slot_time', fields: ['slot_id', 'started_at'] },
  ],
});

// ✅ Define associations
PatientProfile.hasMany(Consultation, { foreignKey: 'patient_id', onDelete: 'CASCADE' });
Consultation.belongsTo(PatientProfile, { foreignKey: 'patient_id', onDelete: 'CASCADE' });

DoctorProfile.hasMany(Consultation, { foreignKey: 'doctor_id', onDelete: 'CASCADE' });
Consultation.belongsTo(DoctorProfile, { foreignKey: 'doctor_id', onDelete: 'CASCADE' });

AvailabilitySlot.hasOne(Consultation, { foreignKey: 'slot_id', onDelete: 'SET NULL' });
Consultation.belongsTo(AvailabilitySlot, { foreignKey: 'slot_id', onDelete: 'SET NULL' });

module.exports = Consultation;