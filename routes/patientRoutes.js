// patientRoutes.js

const express = require('express');
const {
  getAllPatients,
  getPatientByUserId,
  createPatientProfile,
  updatePatientProfile,
  deletePatient,
  getPatientsStats,
  listAvailableForPatients
} = require('../controllers/patientController');

const { requireAuth } = require("../middleware/auth");
const { authorizeRoles } = require("../middleware/authorizeRoles");




const router = express.Router();

// GET all patients
router.get('/getallpatients', requireAuth, authorizeRoles("ADMIN", "DOCTOR"), getAllPatients);

// GET profile by user_id
router.get('/viewpatientprofile/:user_id', requireAuth, authorizeRoles("ADMIN", "DOCTOR", "PATIENT"), getPatientByUserId);

// CREATE profile
router.post('/createpatient', requireAuth, authorizeRoles("ADMIN", "PATIENT"), createPatientProfile);

// UPDATE profile
router.put('/updatepatient/:user_id', requireAuth, authorizeRoles("ADMIN", "PATIENT"), updatePatientProfile);

// DELETE profile
router.delete('/deletepatient/:user_id', requireAuth, authorizeRoles("ADMIN", "PATIENT"), deletePatient);

// GET patient statistics
router.get('/stats', requireAuth, authorizeRoles("ADMIN"), getPatientsStats);

////////////////// feature one //////////////////
//get all available slot of doctors
router.get(
  '/availability-slots',
  requireAuth,
  authorizeRoles('PATIENT', 'ADMIN'),
  listAvailableForPatients
);
////////////////// end feature one //////////////////



module.exports = router;
