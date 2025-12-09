const express = require('express');
const {
  bookConsultation,
  deleteConsultation,
  listMyConsultations,
  listConsultationsForAdmin,
  updatePendingConsultation,
  listDoctorConsultations,
  updateConsultationStatusByDoctor,
  updateConsultationByAdmin,
  listConsultationMessages
} = require('../controllers/consultationController');

const { requireAuth } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/authorizeRoles');

const router = express.Router();


// Book a consultation
router.post(
  '/',
  requireAuth,
  authorizeRoles('PATIENT', 'ADMIN'),
  bookConsultation
);

// View my consultations (Patient)
router.get(
  '/mine',
  requireAuth,
  authorizeRoles('PATIENT'),
  listMyConsultations
);

// View doctor consultations
router.get(
  '/doctor',
  requireAuth,
  authorizeRoles('DOCTOR'),
  listDoctorConsultations
);

// View all consultations (Admin)
router.get(
  '/',
  requireAuth,
  authorizeRoles('ADMIN'),
  listConsultationsForAdmin
);

// Update pending consultation (Patient)
router.put(
  '/:consultation_id',
  requireAuth,
  authorizeRoles('PATIENT'),
  updatePendingConsultation
);

// Update by Doctor
router.put(
  '/:consultation_id/status',
  requireAuth,
  authorizeRoles('DOCTOR'),
  updateConsultationStatusByDoctor
);

// Update by Admin
router.put(
  '/:consultation_id/admin',
  requireAuth,
  authorizeRoles('ADMIN'),
  updateConsultationByAdmin
);

// Consultation messages (any role)
router.get(
  '/:consultation_id/messages',
  requireAuth,
  authorizeRoles('PATIENT', 'DOCTOR', 'ADMIN'),
  listConsultationMessages
);

// Delete consultation
router.delete(
  '/:consultation_id',
  requireAuth,
  authorizeRoles('PATIENT', 'ADMIN'),
  deleteConsultation
);

module.exports = router;
