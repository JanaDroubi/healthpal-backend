import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";
import User from "./User.js";

const Webinar = sequelize.define(
  "Webinar",
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    host_user_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: {
        model: User,
        key: "user_id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    starts_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    ends_at: {
      type: DataTypes.DATE,
      allowNull: false,
      validate: {
        isAfterStart(value) {
          if (this.starts_at && value < this.starts_at) {
            throw new Error("ends_at must be greater than or equal to starts_at");
          }
        },
      },
    },
    is_online: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    location: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    max_attendees: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    current_attendees: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        maxCapacity(value) {
          if (this.max_attendees !== null && value > this.max_attendees) {
            throw new Error("current_attendees cannot exceed max_attendees");
          }
        },
      },
    },
    description: {
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
    tableName: "webinars",
    timestamps: false,
    indexes: [
      { name: "idx_webinar_time", fields: ["starts_at"] },
      { name: "idx_webinar_host", fields: ["host_user_id"] },
    ],
    hooks: {
      beforeUpdate: (webinar) => {
        webinar.updated_at = new Date();
      },
    },
  }
);

// ✅ Associations
User.hasMany(Webinar, { foreignKey: "host_user_id", onDelete: "SET NULL" });
Webinar.belongsTo(User, { foreignKey: "host_user_id", onDelete: "SET NULL" });

export default Webinar;
