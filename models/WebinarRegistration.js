import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";
import User from "./User.js";
import Webinar from "./Webinar.js";

const WebinarRegistration = sequelize.define(
  "WebinarRegistration",
  {
    webinar_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      primaryKey: true,
      references: {
        model: Webinar,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    user_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      primaryKey: true,
      references: {
        model: User,
        key: "user_id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    registered_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "webinar_registrations",
    timestamps: false,
    indexes: [{ name: "idx_webreg_user", fields: ["user_id", "webinar_id"] }],
  }
);

// ✅ Associations
User.belongsToMany(Webinar, {
  through: WebinarRegistration,
  foreignKey: "user_id",
  otherKey: "webinar_id",
});
Webinar.belongsToMany(User, {
  through: WebinarRegistration,
  foreignKey: "webinar_id",
  otherKey: "user_id",
});

// ✅ Hooks to mimic triggers
WebinarRegistration.addHook("beforeCreate", async (registration, options) => {
  const webinar = await Webinar.findByPk(registration.webinar_id, { lock: true, transaction: options.transaction });
  if (webinar.max_attendees !== null && webinar.current_attendees >= webinar.max_attendees) {
    throw new Error("Registration rejected: webinar is at capacity");
  }
});

WebinarRegistration.addHook("afterCreate", async (registration, options) => {
  await Webinar.increment("current_attendees", {
    by: 1,
    where: { id: registration.webinar_id },
    transaction: options.transaction,
  });
});

WebinarRegistration.addHook("afterDestroy", async (registration, options) => {
  await Webinar.decrement("current_attendees", {
    by: 1,
    where: { id: registration.webinar_id },
    transaction: options.transaction,
  });
});

Webinar.addHook("beforeUpdate", async (webinar, options) => {
  if (
    webinar.max_attendees !== null &&
    webinar.current_attendees > webinar.max_attendees
  ) {
    throw new Error(
      "max_attendees cannot be less than current_attendees"
    );
  }
});

export default WebinarRegistration;
