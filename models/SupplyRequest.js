import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";
import User from "./User.js";
import Item from "./Item.js";

const SupplyRequest = sequelize.define(
  "SupplyRequest",
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    requester_id: {
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
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
      },
    },
    urgency_level: {
      type: DataTypes.ENUM("LOW", "MEDIUM", "HIGH"),
      defaultValue: "MEDIUM",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("PENDING", "MATCHED", "FULFILLED", "CANCELLED"),
      defaultValue: "PENDING",
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "supply_requests",
    timestamps: false,
  }
);

// ✅ Associations
User.hasMany(SupplyRequest, { foreignKey: "requester_id" });
SupplyRequest.belongsTo(User, { foreignKey: "requester_id" });

Item.hasMany(SupplyRequest, { foreignKey: "item_id" });
SupplyRequest.belongsTo(Item, { foreignKey: "item_id" });

export default SupplyRequest;
