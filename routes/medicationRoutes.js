const express = require("express");
const router = express.Router();
const medicationController = require("../controllers/medicationController");

// Medication routes
router.get("/medications", medicationController.getAllMedications);
router.post("/medications/request", medicationController.requestMedication);
router.post("/medications/fulfill", medicationController.fulfillRequest);

// Equipment routes
router.get("/equipment", medicationController.getAllEquipment);
router.post("/equipment/add", medicationController.addEquipment);

module.exports = router;
