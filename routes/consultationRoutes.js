const express = require('express');
const { bookConsultation, deleteConsultation, listMyConsultations, listConsultationsForAdmin, updatePendingConsultation, listDoctorConsultations, updateConsultationStatusByDoctor, updateConsultationByAdmin } = require('../controllers/consultationController');
const { requireAuth } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/authorizeRoles');
const router = express.Router();
// TODO: implement consultation routes

// Consultation Book
router.post('/consultationsBook',requireAuth,authorizeRoles('PATIENT', 'ADMIN'),bookConsultation);

// Delete Booking 
router.delete('/deleteConsultations/:consultation_id',requireAuth,authorizeRoles('PATIENT', 'ADMIN'),deleteConsultation);

//view consultation
router.get('/viewPaitentConsultation',requireAuth,authorizeRoles('PATIENT'),listMyConsultations);

//view all Consultation for admin
router.get('/viewConsultation',requireAuth,authorizeRoles('ADMIN'),listConsultationsForAdmin);

// Update Pending Consultation For Paitent
router.put('/updatePendingConsultation/:consultation_id',requireAuth, authorizeRoles('PATIENT'), updatePendingConsultation);

//List of Doctor Consultations
router.get('/viewDoctorConsultation',requireAuth,authorizeRoles('DOCTOR'),listDoctorConsultations);

// Update By Doctor
router.put('/updateDoctorConsultation/:consultation_id',requireAuth, authorizeRoles('DOCTOR'), updateConsultationStatusByDoctor)

//Update By Admin
router.put('/updateConsultationByAdmin/:consultation_id',requireAuth, authorizeRoles('ADMIN'), updateConsultationByAdmin)


module.exports = router;
