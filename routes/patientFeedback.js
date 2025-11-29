const express = require('express');
const router = express.Router();
const { requireAuth } = require("../middleware/auth");
const { authorizeRoles } = require("../middleware/authorizeRoles");
const { addPatientFeedback, getFeedbackByCase } = require('../controllers/patientFeedbackController');

/**
 * ==========================================================
 * Patient Feedback Routes
 * ==========================================================
 */

//  Add feedback (only by patient for completed cases)
router.post('/', requireAuth, authorizeRoles('PATIENT'), addPatientFeedback);

//  Get feedback for a specific case
router.get('/:case_id', requireAuth, authorizeRoles('ADMIN', 'DOCTOR', 'DONOR', 'PATIENT'), getFeedbackByCase);

module.exports = router;
