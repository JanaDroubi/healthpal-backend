const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const User = require('./User'); // adjust path if needed

const NgoProfile = sequelize.define('NgoProfile', {
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
  registry_no: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  verified: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false, // equivalent to TINYINT(1) DEFAULT 0
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
  tableName: 'ngo_profiles',
  timestamps: false, // manually handled created_at & updated_at
});

// ✅ Define associations
User.hasOne(NgoProfile, { foreignKey: 'user_id', onDelete: 'CASCADE' });
NgoProfile.belongsTo(User, { foreignKey: 'user_id', onDelete: 'CASCADE' });

module.exports = NgoProfile;
