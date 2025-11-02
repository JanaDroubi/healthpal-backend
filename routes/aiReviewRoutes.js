const express = require("express");
const router = express.Router();
const {
  getAIAnalysesByType,
  getAIAnalysisDetails,
  reviewAIAnalysis,
  getPatientAIResults
} = require("../controllers/aiReviewController");

const { requireAuth } = require("../middleware/auth");
const { authorizeRoles } = require("../middleware/authorizeRoles");

// Doctor endpoints
router.get("/doctor/all/:type", requireAuth, authorizeRoles("DOCTOR", "ADMIN"), getAIAnalysesByType);
router.get("/doctor/details/:type/:id", requireAuth, authorizeRoles("DOCTOR", "ADMIN"), getAIAnalysisDetails);
router.post("/doctor/review", requireAuth, authorizeRoles("DOCTOR", "ADMIN"), reviewAIAnalysis);

// Patient endpoint
router.get("/patient/:patient_id/:type", requireAuth, authorizeRoles("PATIENT", "DOCTOR", "ADMIN"), getPatientAIResults);

module.exports = router;
