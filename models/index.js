const { sequelize } = require('../config/db');

// 🧩 استيراد جميع الموديلات
const User = require('./User');
const PatientProfile = require('./PatientProfile');
const DoctorProfile = require('./DoctorProfile');
const DonorProfile = require('./DonorProfile');
const NgoProfile = require('./NgoProfile');
const Consultation = require('./Consultation');
const SponsorshipCase = require('./SponsorshipCase');
const Donation = require('./Donation');
const Invoice = require('./Invoice');
const Receipt = require('./Receipt');
const Item = require('./Item');
const MedicationInventory = require('./MedicationInventory');
const EquipmentInventory = require('./EquipmentInventory');
const SupplyRequest = require('./SupplyRequest');
const Fulfillment = require('./Fulfillment');
const Guide = require('./Guide');
const Webinar = require('./Webinar');
const WebinarRegistration = require('./WebinarRegistration');

// ==================================================
// 🧠 تعريف العلاقات بين الجداول
// ==================================================

// 🔹 علاقات المستخدمين (Profiles)
User.hasOne(PatientProfile, { foreignKey: 'userId' });
PatientProfile.belongsTo(User, { foreignKey: 'userId' });

User.hasOne(DoctorProfile, { foreignKey: 'userId' });
DoctorProfile.belongsTo(User, { foreignKey: 'userId' });

User.hasOne(DonorProfile, { foreignKey: 'userId' });
DonorProfile.belongsTo(User, { foreignKey: 'userId' });

User.hasOne(NgoProfile, { foreignKey: 'userId' });
NgoProfile.belongsTo(User, { foreignKey: 'userId' });

// 🔹 الاستشارات (Consultations)
PatientProfile.hasMany(Consultation, { foreignKey: 'patientId' });
Consultation.belongsTo(PatientProfile, { foreignKey: 'patientId' });

DoctorProfile.hasMany(Consultation, { foreignKey: 'doctorId' });
Consultation.belongsTo(DoctorProfile, { foreignKey: 'doctorId' });

// 🔹 التبرعات (Donations)
SponsorshipCase.hasMany(Donation, { foreignKey: 'caseId' });
Donation.belongsTo(SponsorshipCase, { foreignKey: 'caseId' });

Donation.belongsTo(DonorProfile, { foreignKey: 'donorId' });
DonorProfile.hasMany(Donation, { foreignKey: 'donorId' });

// 🔹 الفواتير والإيصالات (Invoices & Receipts)
Invoice.hasMany(Receipt, { foreignKey: 'invoiceId' });
Receipt.belongsTo(Invoice, { foreignKey: 'invoiceId' });

// 🔹 العناصر والمخزون (Items & Inventories)
Item.hasMany(MedicationInventory, { foreignKey: 'itemId' });
MedicationInventory.belongsTo(Item, { foreignKey: 'itemId' });

Item.hasMany(EquipmentInventory, { foreignKey: 'itemId' });
EquipmentInventory.belongsTo(Item, { foreignKey: 'itemId' });

// 🔹 الطلبات والتوريد (Supply & Fulfillment)
SupplyRequest.hasMany(Fulfillment, { foreignKey: 'requestId' });
Fulfillment.belongsTo(SupplyRequest, { foreignKey: 'requestId' });

// 🔹 الندوات (Webinars)
Webinar.hasMany(WebinarRegistration, { foreignKey: 'webinarId' });
WebinarRegistration.belongsTo(Webinar, { foreignKey: 'webinarId' });

// ==================================================
// ✅ تصدير جميع النماذج لتُستخدم في باقي الملفات
// ==================================================
module.exports = {
  sequelize,
  User,
  PatientProfile,
  DoctorProfile,
  DonorProfile,
  NgoProfile,
  Consultation,
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
};
