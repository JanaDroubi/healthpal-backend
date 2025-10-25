const express = require("express");
const router = express.Router();
const {
  getAllEquipment,
  getEquipmentById,
  addEquipment,
  updateEquipment,
  deleteEquipment,
} = require("../controllers/equipmentController");

const { requireAuth } = require("../middleware/auth");
const { authorizeRoles } = require("../middleware/authorizeRoles");
const ROLES = require("../config/roles");

// ✅ Get all equipment - any authenticated user
router.get("/", requireAuth, getAllEquipment);

// ✅ Get one equipment by id - any authenticated user
router.get("/:id", requireAuth, getEquipmentById);

// ✅ Add new equipment - only ADMIN or HOSPITAL_STAFF
router.post(
  "/",
  requireAuth,
  authorizeRoles(ROLES.ADMIN, ROLES.HOSPITAL_STAFF),
  addEquipment
);

// ✅ Update equipment by id - only ADMIN or HOSPITAL_STAFF
router.put(
  "/:id",
  requireAuth,
  authorizeRoles(ROLES.ADMIN, ROLES.HOSPITAL_STAFF),
  updateEquipment
);

// ✅ Delete equipment by id - only ADMIN
router.delete(
  "/:id",
  requireAuth,
  authorizeRoles(ROLES.ADMIN),
  deleteEquipment
);

module.exports = router;
