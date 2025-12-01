// routes/ngoRoutes.js
const express = require("express");
const {
  getAllVerifiedNgos,
  getNgoByUserId,
  createNgoProfile,
  updateNgoProfile,
  getAllMissions,
  createMission,
  assignVolunteer,
  bookAppointment,
  sendAnnouncement,
} = require("../controllers/ngoController");

const { requireAuth } = require("../middleware/auth");
const { authorizeRoles } = require("../middleware/authorizeRoles");

const router = express.Router();

// ===================== NGO PROFILES =====================

// CREATE NGO profile
router.post(
  "/",
  requireAuth,
  authorizeRoles("ADMIN", "NGO"),
  createNgoProfile
);

// READ all verified NGOs
router.get(
  "/",
  requireAuth,
  authorizeRoles("ADMIN", "NGO"),
  getAllVerifiedNgos
);

// READ single NGO by user_id
router.get(
  "/:user_id",
  requireAuth,
  authorizeRoles("ADMIN", "NGO"),
  getNgoByUserId
);

// UPDATE NGO profile
router.put(
  "/:user_id",
  requireAuth,
  authorizeRoles("ADMIN", "NGO"),
  updateNgoProfile
);

module.exports = router;
