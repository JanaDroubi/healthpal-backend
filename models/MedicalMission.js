import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";
import NgoProfile from "./NgoProfile.js";

const MedicalMission = sequelize.define(
  "MedicalMission",
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    ngo_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: { model: NgoProfile, key: "user_id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    title: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    location_city: { type: DataTypes.STRING(100), allowNull: false },
    start_date: { type: DataTypes.DATE, allowNull: false },
    end_date: { type: DataTypes.DATE, allowNull: true },
    status: {
      type: DataTypes.ENUM("PLANNED","ONGOING","COMPLETED","CANCELLED"),
      allowNull: false,
      defaultValue: "PLANNED",
    },
    mission_type: {
      type: DataTypes.ENUM("SURGICAL","DENTAL","EYE","GENERAL_CLINIC","REHAB","OTHER"),
      allowNull: false,
      defaultValue: "GENERAL_CLINIC",
    },
    contact_person: { type: DataTypes.STRING(150), allowNull: true },
    contact_phone: { type: DataTypes.STRING(30), allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    tableName: "medical_missions",
    timestamps: false,
    hooks: {
      beforeUpdate: (mission) => { mission.updated_at = new Date(); },
    },
  }
);

NgoProfile.hasMany(MedicalMission, { foreignKey: "ngo_id" });
MedicalMission.belongsTo(NgoProfile, { foreignKey: "ngo_id" });

export default MedicalMission;
