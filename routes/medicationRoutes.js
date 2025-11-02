const express = require("express");
const {
  getAllMedications,
  getMedicationById,
  addMedication,
  updateMedication,
  deleteMedication,
  getExpiredMedications,
  getMedicationsByOwner,
  getMedicationsByLocation,
} = require("../controllers/medicationController");

const { authorizeRoles } = require("../middleware/authorizeRoles");
const { authenticate } = require("../middleware/authMiddleware");

const router = express.Router();

// Base URL: /api/medication

// GET all medications (any authenticated user)
router.get("/", authenticate, getAllMedications);

// GET a single medication by ID
router.get("/:id", authenticate, getMedicationById);

// GET expired medications (ADMIN only)
router.get(
  "/expired/list",
  authenticate,
  authorizeRoles("ADMIN"),
  getExpiredMedications
);

// GET medications by owner (DOCTOR, ADMIN)
router.get(
  "/owner/:owner_id",
  authenticate,
  authorizeRoles("DOCTOR", "ADMIN"),
  getMedicationsByOwner
);

// GET medications by city/location (any authenticated user)
router.get("/location/:city", authenticate, getMedicationsByLocation);

// POST: add medication (DOCTOR or ADMIN)
router.post(
  "/",
  authenticate,
  authorizeRoles("DOCTOR", "ADMIN"),
  addMedication
);

// PUT: update medication (DOCTOR or ADMIN)
router.put(
  "/:id",
  authenticate,
  authorizeRoles("DOCTOR", "ADMIN"),
  updateMedication
);

// DELETE: remove medication (ADMIN only)
router.delete("/:id", authenticate, authorizeRoles("ADMIN"), deleteMedication);

module.exports = router; // ✅ Use module.exports for CommonJS
