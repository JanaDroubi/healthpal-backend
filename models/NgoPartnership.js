import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";
import NgoProfile from "./NgoProfile.js";

const NgoPartnership = sequelize.define(
  "NgoPartnership",
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    ngo_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: { model: NgoProfile, key: "user_id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    partnership_type: {
      type: DataTypes.ENUM("MISSION_SUPPORT","SUPPLY","TRAINING","DONATION","OTHER"),
      allowNull: false,
      defaultValue: "MISSION_SUPPORT",
    },
    agreement_date: { type: DataTypes.DATE, allowNull: true },
    status: {
      type: DataTypes.ENUM("ACTIVE","INACTIVE","EXPIRED"),
      allowNull: false,
      defaultValue: "ACTIVE",
    },
    notes: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    tableName: "ngo_partnerships",
    timestamps: false,
  }
);

NgoProfile.hasMany(NgoPartnership, { foreignKey: "ngo_id" });
NgoPartnership.belongsTo(NgoProfile, { foreignKey: "ngo_id" });

export default NgoPartnership;
