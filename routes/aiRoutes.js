// aiReviewRoutes
const express = require("express");
const { analyzeMedicalSymptomsFast, analyzeLabResults, generateMedicationSuggestion } = require("../controllers/aiController");
const { requireAuth } = require("../middleware/auth");
const { authorizeRoles } = require("../middleware/authorizeRoles");

const router = express.Router();

// Patient endpoints (must include token and must be PATIENT)
router.post("/analyze", requireAuth, authorizeRoles("PATIENT"), analyzeMedicalSymptomsFast);
router.post("/lab", requireAuth, authorizeRoles("PATIENT"), analyzeLabResults);
router.post("/suggestion", requireAuth, authorizeRoles("PATIENT"), generateMedicationSuggestion);

module.exports = router;//
