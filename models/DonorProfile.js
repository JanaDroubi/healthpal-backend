const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const User = require('./User'); // Adjust the path to your User model if needed

const DonorProfile = sequelize.define('DonorProfile', {
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
  anonymity_pref: {
    type: DataTypes.ENUM('PUBLIC', 'ANON'),
    allowNull: false,
    defaultValue: 'PUBLIC',
  },
  preferred_donation_type: {
    type: DataTypes.ENUM('TREATMENT', 'MEDICINE', 'EQUIPMENT', 'GENERAL'),
    allowNull: false,
    defaultValue: 'GENERAL',
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
  tableName: 'donor_profiles',
  timestamps: false, // since we have manual created_at & updated_at
});

// ✅ Define associations
User.hasOne(DonorProfile, { foreignKey: 'user_id', onDelete: 'CASCADE' });
DonorProfile.belongsTo(User, { foreignKey: 'user_id', onDelete: 'CASCADE' });

module.exports = DonorProfile;
