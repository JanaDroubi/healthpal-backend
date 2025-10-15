import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";
import User from "./User.js";
import SupportGroupMember from "./SupportGroupMember.js";

const SupportGroup = sequelize.define(
  "SupportGroup",
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    topic: {
      type: DataTypes.ENUM(
        "PTSD",
        "GRIEF",
        "CHRONIC_ILLNESS",
        "DISABILITY",
        "LOSS",
        "GENERAL"
      ),
      allowNull: false,
      defaultValue: "GENERAL",
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
    tableName: "support_groups",
    timestamps: false,
    hooks: {
      beforeUpdate: (group) => {
        group.updated_at = new Date();
      },
    },
  }
);

export default SupportGroup;
