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
router.post('/create', requireAuth, authorizeRoles("ADMIN", "DONOR"), createDonorProfile);

// READ
router.get('/getall', requireAuth, authorizeRoles("ADMIN"), getAllDonors);
router.get('/view/:user_id', requireAuth, authorizeRoles("ADMIN", "DONOR"), getDonorById);

// UPDATE
router.put('/update/:user_id', requireAuth, authorizeRoles("ADMIN", "DONOR"), updateDonorProfile);

// DELETE (soft)
router.delete('/delete/:user_id', requireAuth, authorizeRoles("ADMIN", "DONOR"), deleteDonor);

module.exports = router;
