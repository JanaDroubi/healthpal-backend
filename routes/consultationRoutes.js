const express = require('express');
const { bookConsultation, deleteConsultation, listMyConsultations, listConsultationsForAdmin, updatePendingConsultation, listDoctorConsultations, updateConsultationStatusByDoctor, updateConsultationByAdmin } = require('../controllers/consultationController');
const { requireAuth } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/authorizeRoles');
const router = express.Router();

// Consultation Book
router.post(
    '/',
    requireAuth,
    authorizeRoles('PATIENT', 'ADMIN'),
    bookConsultation
);
// Delete Booking 
router.delete(
    '/:consultation_id',
    requireAuth,
    authorizeRoles('PATIENT', 'ADMIN'),
    deleteConsultation
);
//view consultation
router.get(
    '/mine',
    requireAuth,
    authorizeRoles('PATIENT'),
    listMyConsultations
);
//view all Consultation for admin
router.get(
    '/',
    requireAuth,
    authorizeRoles('ADMIN'),
    listConsultationsForAdmin
);
// Update Pending Consultation For Paitent
router.put(
    '/:consultation_id',
    requireAuth,
    authorizeRoles('PATIENT'),
    updatePendingConsultation
);
//List of Doctor Consultations
router.get(
    '/doctor',
    requireAuth,
    authorizeRoles('DOCTOR'),
    listDoctorConsultations
);

// Update By Doctor
router.put(
    '/:consultation_id/status',
    requireAuth,
    authorizeRoles('DOCTOR'),
    updateConsultationStatusByDoctor
);
//Update By Admin
router.put(
    '/:consultation_id/admin',
    requireAuth,
    authorizeRoles('ADMIN'),
    updateConsultationByAdmin
);

//msgs
router.get(
    '/:consultation_id/messages',
    requireAuth,
    authorizeRoles('PATIENT', 'DOCTOR', 'ADMIN'),
    listMyConsultations
);


module.exports = router;
