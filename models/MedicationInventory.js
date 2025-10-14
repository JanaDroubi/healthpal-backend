const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Item = require('./Item'); // Assuming the Item model is in the same directory

const MedicationInventory = sequelize.define('MedicationInventory', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  itemId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: Item,  // This is the referenced model
      key: 'id'     // This is the referenced column (Item.id)
    },
    onDelete: 'CASCADE',  // Optional: Delete related records when an item is deleted
    onUpdate: 'CASCADE'   // Optional: Update related records when an item is updated
  },
  batchNumber: { type: DataTypes.STRING },
  quantity: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
  expiryDate: { type: DataTypes.DATEONLY },
}, { timestamps: true });

module.exports = MedicationInventory;
