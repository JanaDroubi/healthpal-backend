import { Sequelize } from "sequelize";
import dotenv from "dotenv";
dotenv.config();

// 1️⃣ Initialize Sequelize
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: "mysql", // or 'postgres' if you're using PostgreSQL
    logging: false,
    define: {
      timestamps: false, // we manage created_at / updated_at manually
    },
  }
);

// 2️⃣ Import all models
import User from "./User.js";
import PatientProfile from "./PatientProfile.js";
import DoctorProfile from "./DoctorProfile.js";
import DonorProfile from "./DonorProfile.js";
import NgoProfile from "./NgoProfile.js";

import SponsorshipCase from "./SponsorshipCase.js";
import Donation from "./Donation.js";
import Invoice from "./Invoice.js";
import Receipt from "./Receipt.js";

import Item from "./Item.js";
import MedicationInventory from "./MedicationInventory.js";
import EquipmentInventory from "./EquipmentInventory.js";

import SupplyRequest from "./SupplyRequest.js";
import Fulfillment from "./Fulfillment.js";

import Guide from "./Guide.js";
import Webinar from "./Webinar.js";
import WebinarRegistration from "./WebinarRegistration.js";

import TherapySession from "./TherapySession.js";

import SupportGroup from "./SupportGroup.js";
import SupportGroupMember from "./SupportGroupMember.js";

import NgoPartnership from "./NgoPartnership.js";
import MedicalMission from "./MedicalMission.js";
import MissionVolunteer from "./MissionVolunteer.js";
import MissionAppointment from "./MissionAppointment.js";
import MissionAnnouncement from "./MissionAnnouncement.js";

// 3️⃣ Export Sequelize instance and models
const db = {
  sequelize,
  Sequelize,
  User,
  PatientProfile,
  DoctorProfile,
  DonorProfile,
  NgoProfile,
  SponsorshipCase,
  Donation,
  Invoice,
  Receipt,
  Item,
  MedicationInventory,
  EquipmentInventory,
  SupplyRequest,
  Fulfillment,
  Guide,
  Webinar,
  WebinarRegistration,
  TherapySession,
  SupportGroup,
  SupportGroupMember,
  NgoPartnership,
  MedicalMission,
  MissionVolunteer,
  MissionAppointment,
  MissionAnnouncement,
};

// 4️⃣ Test the connection
sequelize
  .authenticate()
  .then(() => console.log("✅ Database connected successfully"))
  .catch((err) => console.error("❌ Unable to connect to DB:", err));

export default db;
