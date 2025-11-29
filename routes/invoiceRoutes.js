const express = require('express');
const {
  createInvoice,
  getAllInvoices,
  getInvoiceById,
  updateInvoice,
  cancelInvoice
} = require('../controllers/invoiceController');

const { requireAuth } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/authorizeRoles');

const router = express.Router();

/*
 * ===========================================================
 *  INVOICES ROUTES
 * ===========================================================
 */

// Create new invoice
// Allowed: ADMIN, DOCTOR, FINANCE_MANAGER
router.post('/', requireAuth, authorizeRoles('ADMIN', 'DOCTOR', 'FINANCE_MANAGER'), createInvoice);

// Get all invoices (role-aware)
router.get('/', requireAuth, authorizeRoles('ADMIN', 'FINANCE_MANAGER', 'DOCTOR', 'PATIENT'), getAllInvoices);

// Get single invoice by ID
router.get('/:id', requireAuth, authorizeRoles('ADMIN', 'FINANCE_MANAGER', 'DOCTOR', 'PATIENT'), getInvoiceById);

// Update invoice info (e.g., description, due_date)
// Allowed: ADMIN, FINANCE_MANAGER only
router.put('/:id', requireAuth, authorizeRoles('ADMIN', 'FINANCE_MANAGER'), updateInvoice);

// Cancel invoice (soft delete)
// Allowed: ADMIN, FINANCE_MANAGER
router.patch('/:id', requireAuth, authorizeRoles('ADMIN', 'FINANCE_MANAGER'), cancelInvoice);

module.exports = router;
