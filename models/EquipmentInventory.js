import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";
import User from "./User.js";
import Item from "./Item.js";

const EquipmentInventory = sequelize.define(
  "EquipmentInventory",
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    owner_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: User,
        key: "user_id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    item_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: Item,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    condition: {
      type: DataTypes.ENUM("NEW", "USED", "NEEDS_REPAIR"),
      defaultValue: "USED",
    },
    quantity_available: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    location_city: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    availability_status: {
      type: DataTypes.ENUM("AVAILABLE", "RESERVED", "OUT_OF_STOCK"),
      defaultValue: "AVAILABLE",
    },
  },
  {
    tableName: "equipment_inventory",
    timestamps: false,
  }
);

// ✅ Associations
User.hasMany(EquipmentInventory, { foreignKey: "owner_id" });
EquipmentInventory.belongsTo(User, { foreignKey: "owner_id" });

Item.hasMany(EquipmentInventory, { foreignKey: "item_id" });
EquipmentInventory.belongsTo(Item, { foreignKey: "item_id" });

export default EquipmentInventory;
