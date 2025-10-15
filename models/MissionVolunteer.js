import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";
import User from "./User.js";
import MedicalMission from "./MedicalMission.js";

const MissionVolunteer = sequelize.define(
  "MissionVolunteer",
  {
    mission_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      primaryKey: true,
      references: { model: MedicalMission, key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    user_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      primaryKey: true,
      references: { model: User, key: "user_id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    role: {
      type: DataTypes.ENUM("DOCTOR","NURSE","TRANSLATOR","VOLUNTEER","COORDINATOR"),
      allowNull: false,
      defaultValue: "VOLUNTEER",
    },
    joined_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    tableName: "mission_volunteers",
    timestamps: false,
  }
);

User.belongsToMany(MedicalMission, {
  through: MissionVolunteer,
  foreignKey: "user_id",
  otherKey: "mission_id",
});
MedicalMission.belongsToMany(User, {
  through: MissionVolunteer,
  foreignKey: "mission_id",
  otherKey: "user_id",
});

export default MissionVolunteer;
