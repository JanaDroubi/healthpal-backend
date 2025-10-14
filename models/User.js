const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.ENUM('admin','patient','doctor','donor','ngo'), allowNull: false, defaultValue: 'patient' },
  phone: { type: DataTypes.STRING },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { timestamps: true });

module.exports = User;
