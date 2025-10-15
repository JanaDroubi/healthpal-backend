const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const DoctorProfile = require('./DoctorProfile'); // adjust path as needed

const AvailabilitySlot = sequelize.define('AvailabilitySlot', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
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
  start_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  end_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  is_booked: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false, // equivalent to TINYINT(1) DEFAULT 0
  },
}, {
  tableName: 'availability_slots',
  timestamps: false, // table has no created_at/updated_at
  indexes: [
    {
      fields: ['doctor_id', 'start_at'], // matches SQL index
    },
  ],
});

// ✅ Define associations
DoctorProfile.hasMany(AvailabilitySlot, { foreignKey: 'doctor_id', onDelete: 'CASCADE' });
AvailabilitySlot.belongsTo(DoctorProfile, { foreignKey: 'doctor_id', onDelete: 'CASCADE' });

module.exports = AvailabilitySlot;
