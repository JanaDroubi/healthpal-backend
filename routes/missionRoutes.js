// routes/meissionRoutes.js
const express = require("express");
const router = express.Router();

const {
  getAllMissions,
  getMissionById,
  createMission,
  updateMission,
  cancelMission,
  createAvailability,
  listAvailability,
  assignVolunteer,
  listVolunteers,
  listAppointments,
  bookAppointment,
  sendAnnouncement,
} = require("../controllers/missionController");

const { requireAuth } = require("../middleware/auth");
const { authorizeRoles } = require("../middleware/authorizeRoles");

// Missions
router.get(
  "/missions/getall",
  requireAuth,
  authorizeRoles("ADMIN", "NGO", "MISSION_COORDINATOR"),
  getAllMissions
);
router.get(
  "/missions/view/:mission_id",
  requireAuth,
  authorizeRoles("ADMIN", "NGO", "MISSION_COORDINATOR"),
  getMissionById
);
router.post(
  "/missions/create",
  requireAuth,
  authorizeRoles("ADMIN", "NGO", "MISSION_COORDINATOR"),
  createMission
);
router.put(
  "/missions/update/:mission_id",
  requireAuth,
  authorizeRoles("ADMIN", "NGO", "MISSION_COORDINATOR"),
  updateMission
);
router.delete(
  "/missions/cancel/:mission_id",
  requireAuth,
  authorizeRoles("ADMIN", "NGO", "MISSION_COORDINATOR"),
  cancelMission
);

// Availability (doctors)
router.post(
  "/availability/create",
  requireAuth,
  authorizeRoles("DOCTOR", "NGO", "ADMIN"),
  createAvailability
);
router.get(
  "/availability/:doctor_id",
  requireAuth,
  authorizeRoles("ADMIN", "DOCTOR", "NGO", "VOLUNTEER"),
  listAvailability
);

// Volunteers
router.get(
  "/missions/:mission_id/volunteers",
  requireAuth,
  authorizeRoles("ADMIN", "NGO", "MISSION_COORDINATOR"),
  listVolunteers
);
router.post(
  "/missions/:mission_id/volunteers/assign",
  requireAuth,
  authorizeRoles("ADMIN", "NGO", "MISSION_COORDINATOR"),
  assignVolunteer
);

// Appointments
router.post(
  "/missions/:mission_id/appointments/book",
  requireAuth,
  authorizeRoles("VOLUNTEER", "NGO", "ADMIN"),
  bookAppointment
);
router.get(
  "/missions/:mission_id/appointments",
  requireAuth,
  authorizeRoles("ADMIN", "NGO", "VOLUNTEER"),
  listAppointments
);

// Announcements
router.post(
  "/missions/:mission_id/announcements/send",
  requireAuth,
  authorizeRoles("ADMIN", "NGO", "MISSION_COORDINATOR"),
  sendAnnouncement
);

module.exports = router;
