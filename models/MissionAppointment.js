import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";
import MedicalMission from "./MedicalMission.js";
import PatientProfile from "./PatientProfile.js";
import DoctorProfile from "./DoctorProfile.js";

const MissionAppointment = sequelize.define(
  "MissionAppointment",
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    mission_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: { model: MedicalMission, key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    patient_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: { model: PatientProfile, key: "user_id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    doctor_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: { model: DoctorProfile, key: "user_id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    appointment_date: { type: DataTypes.DATE, allowNull: false },
    notes: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    tableName: "mission_appointments",
    timestamps: false,
  }
);

MedicalMission.hasMany(MissionAppointment, { foreignKey: "mission_id" });
MissionAppointment.belongsTo(MedicalMission, { foreignKey: "mission_id" });

PatientProfile.hasMany(MissionAppointment, { foreignKey: "patient_id" });
MissionAppointment.belongsTo(PatientProfile, { foreignKey: "patient_id" });

DoctorProfile.hasMany(MissionAppointment, { foreignKey: "doctor_id" });
MissionAppointment.belongsTo(DoctorProfile, { foreignKey: "doctor_id" });

export default MissionAppointment;
