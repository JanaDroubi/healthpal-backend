const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const User = require('./User'); // Adjust path as needed

const DoctorProfile = sequelize.define('DoctorProfile', {
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
  university_name: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  graduation_year: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 1950,
      max: new Date().getFullYear(), // optional safety check
    },
  },
  gender: {
    type: DataTypes.ENUM('M', 'F'),
    allowNull: true,
  },
  specialty: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  license_no: {
    type: DataTypes.STRING(100),
    allowNull: true,
    unique: true,
  },
  bio: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  hire_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  telehealth_enabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  verified: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
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
  tableName: 'doctor_profiles',
  timestamps: false, // Using custom created_at & updated_at
});

// ✅ Define associations
User.hasOne(DoctorProfile, { foreignKey: 'user_id', onDelete: 'CASCADE' });
DoctorProfile.belongsTo(User, { foreignKey: 'user_id', onDelete: 'CASCADE' });

module.exports = DoctorProfile;
