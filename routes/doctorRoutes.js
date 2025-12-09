const express = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  createDoctorProfile,
  updateDoctorProfile,
  getAllDoctors,
  deactivateDoctor,
  getDoctorById,
  createAvailabilitySlot,
  listAvailabilityForDoctor,
  listAllAvailability,
  deleteAvailabilitySlot,
  updateAvailabilitySlot
} = require('../controllers/doctorController');

const { authorizeRoles } = require("../middleware/authorizeRoles");

const router = express.Router();


// Create doctor profile
router.post(
  '/',
  requireAuth,
  authorizeRoles('DOCTOR'),
  createDoctorProfile
);

// Get all doctors (Admin only)
router.get(
  '/',
  requireAuth,
  authorizeRoles('ADMIN'),
  getAllDoctors
);

// Update doctor profile
router.put(
  '/:user_id',
  requireAuth,
  authorizeRoles('DOCTOR', 'ADMIN'),
  updateDoctorProfile
);

// Deactivate doctor
router.delete(
  '/:user_id',
  requireAuth,
  authorizeRoles('ADMIN'),
  deactivateDoctor
);


// List ALL availability slots (Admin only)
router.get(
  '/availability-slots',
  requireAuth,
  authorizeRoles('ADMIN'),
  listAllAvailability
);

// Create availability slot (Doctor/Admin)
router.post(
  '/:doctor_id/availability-slots',
  requireAuth,
  authorizeRoles('ADMIN', 'DOCTOR'),
  createAvailabilitySlot
);

// List availability slots for ONE doctor
router.get(
  '/:doctor_id/availability-slots',
  requireAuth,
  authorizeRoles('DOCTOR', 'ADMIN'),
  listAvailabilityForDoctor
);

// Update availability slot
router.put(
  '/:doctor_id/availability-slots/:slot_id',
  requireAuth,
  authorizeRoles('DOCTOR', 'ADMIN'),
  updateAvailabilitySlot
);

// Delete availability slot
router.delete(
  '/:doctor_id/availability-slots/:slot_id',
  requireAuth,
  authorizeRoles('DOCTOR', 'ADMIN'),
  deleteAvailabilitySlot
);

//GET DOCTOR BY ID  

router.get(
  '/:user_id',
  requireAuth,
  authorizeRoles('ADMIN', 'DOCTOR'),
  getDoctorById
);

module.exports = router;
