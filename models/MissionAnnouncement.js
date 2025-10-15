import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";
import MedicalMission from "./MedicalMission.js";

const MissionAnnouncement = sequelize.define(
  "MissionAnnouncement",
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    mission_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: { model: MedicalMission, key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    message: { type: DataTypes.TEXT, allowNull: false },
    target_audience: {
      type: DataTypes.ENUM("ALL","PATIENTS","DOCTORS","VOLUNTEERS"),
      allowNull: false,
      defaultValue: "ALL",
    },
    published_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    tableName: "mission_announcements",
    timestamps: false,
  }
);

MedicalMission.hasMany(MissionAnnouncement, { foreignKey: "mission_id" });
MissionAnnouncement.belongsTo(MedicalMission, { foreignKey: "mission_id" });

export default MissionAnnouncement;
