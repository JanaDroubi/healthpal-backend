// routes/sponsorshipRoutes.js

const express = require('express');
const {
  createCase,
  getAllCases,
  getCaseById,
  updateCase,
  changeCaseStatus,
  deleteCase
} = require('../controllers/sponsorshipController');

const { requireAuth } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/authorizeRoles');

const router = express.Router();

/**
 * =============================================
 *  SPONSORSHIP CASE ROUTES
 * =============================================
 */

//  Create a new sponsorship case
// - Allowed: ADMIN, DOCTOR (for patients), PATIENT (for themselves)
router.post('/create', requireAuth, authorizeRoles('ADMIN', 'DOCTOR', 'PATIENT'), createCase);

//  Get all sponsorship cases
// - ADMIN/DOCTOR: all
// - PATIENT: only their own
// - DONOR: only OPEN / FUNDED
router.get('/all', requireAuth, authorizeRoles('ADMIN', 'DOCTOR', 'PATIENT', 'DONOR'), getAllCases);

//  Get single sponsorship case by ID (detailed view) 
router.get('/view/:id', requireAuth, authorizeRoles('ADMIN', 'DOCTOR', 'PATIENT', 'DONOR'), getCaseById);

//  Update sponsorship case details
// - Allowed: ADMIN, DOCTOR, PATIENT (own + PENDING)
router.put('/update/:id', requireAuth, authorizeRoles('ADMIN', 'DOCTOR', 'PATIENT'), updateCase);

//  Change sponsorship case status
// - Allowed: ADMIN (and optionally FINANCE_MANAGER)
router.patch('/status/:id', requireAuth, authorizeRoles('ADMIN', 'FINANCE_MANAGER'), changeCaseStatus);

//  Delete or deactivate sponsorship case
// - Allowed: ADMIN, DOCTOR, PATIENT (own + PENDING)
router.delete('/delete/:id', requireAuth, authorizeRoles('ADMIN', 'DOCTOR', 'PATIENT'), deleteCase);

module.exports = router;
