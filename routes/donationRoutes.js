// routes/donationRoutes.js

const express = require('express');
const {
  createDonation,
  getAllDonations,
  getDonationsByDonor,
} = require('../controllers/donationController');

const { requireAuth } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/authorizeRoles');

const router = express.Router();

/**
 * ============================================================
 *  DONATIONS ROUTES
 * ============================================================
 */

//  Create a donation
// - Allowed: DONOR, ADMIN
// - Validates case status and donor profile
router.post('/', requireAuth, authorizeRoles('DONOR', 'ADMIN'), createDonation);

//  Get all donations (transparency / finance view)
// - Allowed: ADMIN, FINANCE_MANAGER
router.get('/', requireAuth, authorizeRoles('ADMIN', 'FINANCE_MANAGER'), getAllDonations);

//  Get donations by donor
// - DONOR: can view only their own
// - ADMIN / FINANCE_MANAGER: can view any donor via param
router.get('/donor/:id', requireAuth, authorizeRoles('DONOR', 'ADMIN', 'FINANCE_MANAGER'), getDonationsByDonor);

module.exports = router;

