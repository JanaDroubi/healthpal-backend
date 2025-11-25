const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/authorizeRoles');
const {
  createVaccinationRecord,
  getPatientVaccinationHistory,
  getUpcomingVaccinations,
  getVaccinationReminders,
  generateVaccinationCertificate,
  updateVaccinationRecord,
  deleteVaccinationRecord,
  getAllVaccines,
  createVaccine,
  searchVaccinesExternal,
  getVaccineSafetyInfo
} = require('../controllers/vaccinationController');

const router = express.Router();



// Create 
router.post(
  '/records',
  requireAuth,
  authorizeRoles('DOCTOR', 'ADMIN'),
  createVaccinationRecord
);


router.get(
  '/patients/:patient_id/history',
  requireAuth,
  authorizeRoles('PATIENT', 'DOCTOR', 'ADMIN'),
  getPatientVaccinationHistory
);

router.get(
  '/patients/:patient_id/upcoming',
  requireAuth,
  authorizeRoles('PATIENT', 'DOCTOR', 'ADMIN'),
  getUpcomingVaccinations
);

router.get(
  '/patients/:patient_id/reminders',
  requireAuth,
  authorizeRoles('PATIENT', 'DOCTOR', 'ADMIN'),
  getVaccinationReminders
);

router.get(
  '/patients/:patient_id/certificate/:vaccine_id',
  requireAuth,
  authorizeRoles('PATIENT', 'DOCTOR', 'ADMIN'),
  generateVaccinationCertificate
);
router.put(
'/records/:record_id',
requireAuth,
authorizeRoles('DOCTOR', 'ADMIN'),
updateVaccinationRecord
);

router.delete(
'/records/:record_id',
requireAuth,
authorizeRoles('ADMIN'),
deleteVaccinationRecord
);

router.get(
'/vaccines',
requireAuth,
getAllVaccines
);

router.post(
'/vaccines',
requireAuth,
authorizeRoles('ADMIN'),
createVaccine
);

router.get(
'/external/search',
requireAuth,
searchVaccinesExternal
);

router.get(
'/external/safety/:vaccine_name',
requireAuth,
getVaccineSafetyInfo
);


module.exports = router;