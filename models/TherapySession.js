import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";
import PatientProfile from "./PatientProfile.js";
import DoctorProfile from "./DoctorProfile.js";

const TherapySession = sequelize.define(
  "TherapySession",
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    patient_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: PatientProfile,
        key: "user_id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    therapist_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: DoctorProfile,
        key: "user_id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    mode: {
      type: DataTypes.ENUM("VIDEO", "AUDIO", "CHAT"),
      allowNull: false,
      defaultValue: "CHAT",
    },
    scheduled_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    started_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    ended_at: {
      type: DataTypes.DATE,
      allowNull: true,
      validate: {
        isAfterStart(value) {
          if (this.started_at && value && value < this.started_at) {
            throw new Error("ended_at must be after started_at");
          }
        },
      },
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(
        "PENDING",
        "CONFIRMED",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED"
      ),
      allowNull: false,
      defaultValue: "PENDING",
    },
    anonymous: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
    },
  },
  {
    tableName: "therapy_sessions",
    timestamps: false,
    indexes: [{ name: "idx_therapy_status", fields: ["status", "scheduled_at"] }],
    hooks: {
      beforeUpdate: (session) => {
        session.updated_at = new Date();
      },
    },
  }
);

// ✅ Associations
PatientProfile.hasMany(TherapySession, { foreignKey: "patient_id" });
TherapySession.belongsTo(PatientProfile, { foreignKey: "patient_id" });

DoctorProfile.hasMany(TherapySession, { foreignKey: "therapist_id" });
TherapySession.belongsTo(DoctorProfile, { foreignKey: "therapist_id" });

export default TherapySession;
