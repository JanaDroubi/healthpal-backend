const express = require("express");
const router = express.Router();
const {
  getAllEquipment,
  getEquipmentById,
  addEquipment,
  updateEquipment,
  deleteEquipment,
} = require("../controllers/equipmentController");

// Get all equipment
router.get("/", getAllEquipment);

// Get one equipment by id
router.get("/:id", getEquipmentById);

// Add new equipment
router.post("/", addEquipment);

// Update equipment by id
router.put("/:id", updateEquipment);

// Delete equipment by id
router.delete("/:id", deleteEquipment);

module.exports = router;
