const express = require("express");
const {
  listPendingMedicationRequests,
  getMedicationRequestById,
  getRequestsByPatient,
  fulfillMedicationRequest,
  cancelMedicationRequest,
} = require("../controllers/medicationDeliveryController");

const { authorizeRoles } = require("../middleware/authorizeRoles");
const { authenticate } = require("../middleware/authMiddleware");

const router = express.Router();

// Base URL: /api/medication-requests

// GET all pending medication requests (any authenticated user with proper roles)
router.get(
  "/",
  authenticate,
  authorizeRoles("PATIENT", "VOLUNTEER", "NGO", "ADMIN"),
  listPendingMedicationRequests
);

// GET a single medication request by ID
router.get("/:id", authenticate, getMedicationRequestById);

// GET medication requests by patient (PATIENT, ADMIN)
router.get(
  "/patient/:patient_id",
  authenticate,
  authorizeRoles("PATIENT", "ADMIN"),
  getRequestsByPatient
);

// POST: fulfill a medication request (VOLUNTEER or NGO)
router.post(
  "/fulfill",
  authenticate,
  authorizeRoles("VOLUNTEER", "NGO"),
  fulfillMedicationRequest
);

// DELETE: cancel a medication request (PATIENT or ADMIN)
router.delete(
  "/:request_id",
  authenticate,
  authorizeRoles("PATIENT", "ADMIN"),
  cancelMedicationRequest
);

module.exports = router; // ✅ CommonJS export
