import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";
import User from "./User.js";
import Item from "./Item.js";

const MedicationInventory = sequelize.define(
  "MedicationInventory",
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
    quantity_available: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    expiration_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    location_city: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    tableName: "medication_inventory",
    timestamps: false,
  }
);

// ✅ Associations
User.hasMany(MedicationInventory, { foreignKey: "owner_id" });
MedicationInventory.belongsTo(User, { foreignKey: "owner_id" });

Item.hasMany(MedicationInventory, { foreignKey: "item_id" });
MedicationInventory.belongsTo(Item, { foreignKey: "item_id" });

export default MedicationInventory;
