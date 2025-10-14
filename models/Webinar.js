const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Webinar = sequelize.define('Webinar', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  scheduledAt: { type: DataTypes.DATE },
  capacity: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 100 },
}, { timestamps: true });

module.exports = Webinar;
