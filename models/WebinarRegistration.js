const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const WebinarRegistration = sequelize.define('WebinarRegistration', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  webinarId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  attendeeName: { type: DataTypes.STRING },
  attendeeEmail: { type: DataTypes.STRING },
  status: { type: DataTypes.ENUM('registered','attended','cancelled'), defaultValue: 'registered' },
}, { timestamps: true });

module.exports = WebinarRegistration;
