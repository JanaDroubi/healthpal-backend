const express = require('express');
const {
  getAllPatients,
  getPatientByUserId,
  createPatientProfile,
  updatePatientProfile,
  deletePatient
} = require('../controllers/patientController');

const router = express.Router();

// GET all patients
router.get('/getallpatients', getAllPatients);

// GET profile by user_id
router.get('/getpatient/:user_id', getPatientByUserId);

// CREATE profile
router.post('/createpatient', createPatientProfile);

// UPDATE profile
router.put('/updatepatient/:user_id', updatePatientProfile);

// DELETE profile
router.delete('/deletepatient/:user_id', deletePatient);

module.exports = router;
