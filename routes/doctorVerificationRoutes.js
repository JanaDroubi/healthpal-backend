const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/authorizeRoles');
const { verifyDoctorProfile, uploadDoctorDocuments, getPendingVerifications, getDoctorVerificationStatus } = require('../controllers/doctorVerificationController');

const router = express.Router();


// Upload doctor verification documents (doctor only)
router.post('/uploadDocuments/:doctor_id', requireAuth, authorizeRoles('DOCTOR'), uploadDoctorDocuments);

// Admin: verify or reject doctor profile
router.post('/verifyDoctor/:doctor_id', requireAuth, authorizeRoles('ADMIN'), verifyDoctorProfile);

// Admin: view all pending verifications
router.get('/pendingVerifications', requireAuth, authorizeRoles('ADMIN'), getPendingVerifications);

// Doctor or Admin: view current verification status
router.get('/status/:doctor_id', requireAuth, authorizeRoles('ADMIN', 'DOCTOR'), getDoctorVerificationStatus);

module.exports = router;
