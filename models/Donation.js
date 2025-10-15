import { DataTypes } from "sequelize";
import sequelize from "../config/db.js"; // adjust path
import DonorProfile from "./DonorProfile.js";
import SponsorshipCase from "./SponsorshipCase.js";

const Donation = sequelize.define(
  "Donation",
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    donor_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: DonorProfile,
        key: "user_id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
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
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      validate: {
        min: 0.01, // amount must be > 0
      },
    },
    payment_method: {
      type: DataTypes.ENUM(
        "CREDIT_CARD",
        "PAYPAL",
        "BANK_TRANSFER",
        "CASH"
      ),
      allowNull: false,
      defaultValue: "CASH",
    },
    transaction_ref: {
      type: DataTypes.STRING(100),
      unique: true,
      allowNull: true,
    },
    paid_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "donations",
    timestamps: false,
    indexes: [
      { name: "idx_donation_donor", fields: ["donor_id"] },
      { name: "idx_donation_case", fields: ["case_id"] },
      { name: "idx_donation_date", fields: ["paid_at"] },
    ],
  }
);

// ✅ Associations
DonorProfile.hasMany(Donation, { foreignKey: "donor_id", onDelete: "CASCADE" });
Donation.belongsTo(DonorProfile, { foreignKey: "donor_id", onDelete: "CASCADE" });

SponsorshipCase.hasMany(Donation, { foreignKey: "case_id", onDelete: "CASCADE" });
Donation.belongsTo(SponsorshipCase, { foreignKey: "case_id", onDelete: "CASCADE" });

export default Donation;
