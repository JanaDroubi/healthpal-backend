import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";
import SupplyRequest from "./SupplyRequest.js";
import User from "./User.js";

const Fulfillment = sequelize.define(
  "Fulfillment",
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    request_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: SupplyRequest,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    provider_user_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: User,
        key: "user_id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    provided_qty: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    status: {
      type: DataTypes.ENUM("PENDING", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED"),
      allowNull: false,
      defaultValue: "PENDING",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "fulfillments",
    timestamps: false,
    indexes: [
      { name: "idx_fulfill_request_status", fields: ["request_id", "status"] },
      { name: "idx_fulfill_provider", fields: ["provider_user_id"] },
    ],
    hooks: {
      beforeUpdate: (record) => {
        record.updated_at = new Date();
      },
    },
  }
);

// ✅ Associations
SupplyRequest.hasMany(Fulfillment, { foreignKey: "request_id", onDelete: "CASCADE" });
Fulfillment.belongsTo(SupplyRequest, { foreignKey: "request_id", onDelete: "CASCADE" });

User.hasMany(Fulfillment, { foreignKey: "provider_user_id", onDelete: "CASCADE" });
Fulfillment.belongsTo(User, { foreignKey: "provider_user_id", onDelete: "CASCADE" });

export default Fulfillment;
