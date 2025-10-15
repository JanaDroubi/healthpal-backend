import { DataTypes } from "sequelize";
import sequelize from "../config/db.js"; // adjust path
import SponsorshipCase from "./SponsorshipCase.js";

const Invoice = sequelize.define(
  "Invoice",
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    case_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: SponsorshipCase,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    hospital_name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      validate: {
        min: 0.01, // amount must be greater than 0
      },
    },
    issued_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    due_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("UNPAID", "PARTIALLY_PAID", "PAID", "CANCELLED"),
      allowNull: false,
      defaultValue: "UNPAID",
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
    tableName: "invoices",
    timestamps: false, // manually handling created_at & updated_at
    indexes: [
      {
        name: "idx_invoice_case_status",
        fields: ["case_id", "status"],
      },
    ],
    hooks: {
      beforeUpdate: (invoice) => {
        invoice.updated_at = new Date();
      },
    },
  }
);

// ✅ Associations
SponsorshipCase.hasMany(Invoice, { foreignKey: "case_id", onDelete: "CASCADE" });
Invoice.belongsTo(SponsorshipCase, { foreignKey: "case_id", onDelete: "CASCADE" });

export default Invoice;
