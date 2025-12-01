//donorRoutes.js 
const express = require('express');
const {
  createDonorProfile,
  getAllDonors,
  getDonorById,
  updateDonorProfile,
  deleteDonor
} = require('../controllers/donorController');

const { requireAuth } = require("../middleware/auth");
const { authorizeRoles } = require("../middleware/authorizeRoles");

const router = express.Router();

// CREATE
router.post('/', requireAuth, authorizeRoles("ADMIN", "DONOR"), createDonorProfile);

// READ
router.get('/', requireAuth, authorizeRoles("ADMIN"), getAllDonors);
router.get('/:user_id', requireAuth, authorizeRoles("ADMIN", "DONOR"), getDonorById);

// UPDATE
router.put('/:user_id', requireAuth, authorizeRoles("ADMIN", "DONOR"), updateDonorProfile);

// DELETE (soft)
router.delete('/:user_id', requireAuth, authorizeRoles("ADMIN", "DONOR"), deleteDonor);

module.exports = router;
