const express = require('express');
const router = express.Router();
const { requireAuth } = require("../middleware/auth");
const { authorizeRoles } = require("../middleware/authorizeRoles");
const { addRecoveryUpdate, getRecoveryUpdatesByCase } = require('../controllers/recoveryUpdatesController');

/**
 * ==========================================================
 * Recovery Updates Routes
 * ==========================================================
 */

//  Add a recovery update (Patient / Doctor / Admin only)
router.post('/add', requireAuth, authorizeRoles('PATIENT', 'DOCTOR', 'ADMIN'), addRecoveryUpdate);

//  Get all updates for a specific case
router.get('/get/:case_id', requireAuth, authorizeRoles('ADMIN', 'DOCTOR', 'PATIENT', 'DONOR'), getRecoveryUpdatesByCase);

module.exports = router;
