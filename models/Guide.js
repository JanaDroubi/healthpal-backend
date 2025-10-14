const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Guide = sequelize.define('Guide', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING, allowNull: false },
  content: { type: DataTypes.TEXT },
  published: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { timestamps: true });

module.exports = Guide;
