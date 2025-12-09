//aiReviewRoutes
const express = require("express");
const { analyzeMedicalSymptomsFast, analyzeLabResults, generateMedicationSuggestion} = require("../controllers/aiController");


const router = express.Router();


router.post("/analyze", analyzeMedicalSymptomsFast);
router.post("/lab", analyzeLabResults);
router.post("/suggestion", generateMedicationSuggestion);


module.exports = router;
