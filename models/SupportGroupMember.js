import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";
import User from "./User.js";
import SupportGroup from "./SupportGroup.js";

const SupportGroupMember = sequelize.define(
  "SupportGroupMember",
  {
    group_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      primaryKey: true,
      references: {
        model: SupportGroup,
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
    joined_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    role: {
      type: DataTypes.ENUM("MEMBER", "FACILITATOR"),
      allowNull: false,
      defaultValue: "MEMBER",
    },
  },
  {
    tableName: "support_group_members",
    timestamps: false,
  }
);

// ✅ Associations
User.belongsToMany(SupportGroup, {
  through: SupportGroupMember,
  foreignKey: "user_id",
  otherKey: "group_id",
});
SupportGroup.belongsToMany(User, {
  through: SupportGroupMember,
  foreignKey: "group_id",
  otherKey: "user_id",
});

export default SupportGroupMember;
