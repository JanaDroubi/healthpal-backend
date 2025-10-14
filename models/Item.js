const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Item = sequelize.define('Item', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  category: { type: DataTypes.STRING },
  description: { type: DataTypes.TEXT },
}, { timestamps: true });

module.exports = Item;
