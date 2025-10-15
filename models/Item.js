import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Item = sequelize.define(
  "Item",
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    type: {
      type: DataTypes.ENUM("MEDICATION", "EQUIPMENT"),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    unit: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
  },
  {
    tableName: "items",
    timestamps: false,
    indexes: [],
    uniqueKeys: {
      unique_type_name: {
        fields: ["type", "name"],
      },
    },
  }
);

export default Item;