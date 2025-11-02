const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { createDoctorProfile, updateDoctorProfile, getAllDoctors, deactivateDoctor, getDoctorById, createAvailabilitySlot, listAvailabilityForDoctor, listAllAvailability, deleteAvailabilitySlot, updateAvailabilitySlot } = require('../controllers/doctorController');
const { authorizeRoles } = require("../middleware/authorizeRoles");


const router = express.Router();
//creat profile
router.post(
  '/',
  requireAuth,
  authorizeRoles('DOCTOR'),
  createDoctorProfile
);
//update profile
router.put(
  '/:user_id',
  requireAuth,
  authorizeRoles('DOCTOR', 'ADMIN'),
  updateDoctorProfile
);
//get all doctors
router.get(
  '/',
  requireAuth,
  authorizeRoles('ADMIN'),
  getAllDoctors
);
//Deactivate doctor: delete profile + set user.status = 'INACTIVE' (transactional)
router.delete(
  '/:user_id',
  requireAuth,
  authorizeRoles('ADMIN'),
  deactivateDoctor
);
//get by id 
router.get(
  '/:user_id',
  requireAuth,
  authorizeRoles('ADMIN', 'DOCTOR'),
  getDoctorById
);
///////////feature one//////////
//createAvailabilitySlot
router.post(
  '/:doctor_id/availability-slots',
  requireAuth,
  authorizeRoles('ADMIN', 'DOCTOR'),
  createAvailabilitySlot
);
// list of availability slot for a doctor
router.get(
  '/:doctor_id/availability-slots',
  requireAuth,
  authorizeRoles('DOCTOR', 'ADMIN'),
  listAvailabilityForDoctor
);
// list of availability slot for all doctor
router.get(
  '/availability-slots',
  requireAuth,
  authorizeRoles('ADMIN'),
  listAllAvailability
);
// DELETE slot
router.delete(
  '/:doctor_id/availability-slots/:slot_id',
  requireAuth,
  authorizeRoles('DOCTOR', 'ADMIN'),
  deleteAvailabilitySlot
);
// Update Slot
router.put(
  '/:doctor_id/availability-slots/:slot_id',
  requireAuth,
  authorizeRoles('DOCTOR', 'ADMIN'),
  updateAvailabilitySlot
);
///////end feature one /////////

module.exports = router;
