import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";
import Invoice from "./Invoice.js";

const Receipt = sequelize.define(
  "Receipt",
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    invoice_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: Invoice,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    paid_amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      validate: {
        min: 0.01,
      },
    },
    payment_date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    payment_method: {
      type: DataTypes.ENUM("CREDIT_CARD", "PAYPAL", "BANK_TRANSFER", "CASH"),
      allowNull: false,
      defaultValue: "CASH",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "receipts",
    timestamps: false,
    indexes: [
      { name: "idx_receipt_invoice", fields: ["invoice_id"] },
      { name: "idx_receipt_date", fields: ["payment_date"] },
    ],
  }
);

// ✅ Associations
Invoice.hasMany(Receipt, { foreignKey: "invoice_id", onDelete: "CASCADE" });
Receipt.belongsTo(Invoice, { foreignKey: "invoice_id", onDelete: "CASCADE" });

export default Receipt;
