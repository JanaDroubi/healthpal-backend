const { DataTypes } = require('sequelize');
const sequelize = require('../config/db'); // <- instance

const SponsorshipCase = sequelize.define('SponsorshipCase', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  patient_id: { type: DataTypes.BIGINT, allowNull: false },
  title: { type: DataTypes.STRING(200), allowNull: false },
  description: { type: DataTypes.TEXT },
  category: { 
    type: DataTypes.ENUM('SURGERY','CANCER','DIALYSIS','REHAB','OTHER'), 
    allowNull: false 
  },
  target_amount: { type: DataTypes.DECIMAL(12,2), allowNull: false },
  raised_amount: { type: DataTypes.DECIMAL(12,2), allowNull: false, defaultValue: 0 },
  goal_deadline: { type: DataTypes.DATE },
  status: { 
    type: DataTypes.ENUM('OPEN','FUNDED','CLOSED'), 
    allowNull: false, 
    defaultValue: 'OPEN' 
  },
}, {
  tableName: 'sponsorship_cases',
  timestamps: true,
});

module.exports = SponsorshipCase;
