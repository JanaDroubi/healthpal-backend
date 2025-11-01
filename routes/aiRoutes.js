const express = require("express");
const { analyzeMedicalSymptomsFast, analyzeLabResults, generateMedicationSuggestion} = require("../controllers/aiController");
const { requireAuth } = require("../middleware/auth");
const { authorizeRoles } = require("../middleware/authorizeRoles");

const router = express.Router();

// Only doctors, patients, or admins can use it
router.post("/analyze", analyzeMedicalSymptomsFast);
router.post("/lab", analyzeLabResults);
router.post("/suggestion", generateMedicationSuggestion);


module.exports = router;
