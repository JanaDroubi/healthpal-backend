const express = require('express');
const {
  createReceipt,
  getAllReceipts,
  getReceiptById
} = require('../controllers/receiptController');

const { requireAuth } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/authorizeRoles');

const router = express.Router();

/**
 * ===========================================================
 *  RECEIPTS ROUTES
 * ===========================================================
 */

// Create a new receipt (manual payment)
// Allowed: ADMIN, FINANCE_MANAGER
router.post('/', requireAuth, authorizeRoles('ADMIN', 'FINANCE_MANAGER'), createReceipt);

// Get all receipts (role-aware)
router.get('/', requireAuth, authorizeRoles('ADMIN', 'FINANCE_MANAGER', 'PATIENT'), getAllReceipts);

// Get single receipt
router.get('/:id', requireAuth, authorizeRoles('ADMIN', 'FINANCE_MANAGER', 'PATIENT'), getReceiptById);

module.exports = router;
