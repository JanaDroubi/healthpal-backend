const express = require("express");
const router = express.Router();

const {
  createInventory,
  getAllInventory,
  getInventoryByOwner,
  updateInventory,
  deleteInventory,
} = require("../controllers/inventoryController");

const { requireAuth } = require("../middleware/auth");
const { authorizeRoles } = require("../middleware/authorizeRoles");
const ROLES = require("../constants/roles");

// ✅ Get all inventory - any authenticated user
router.get("/", requireAuth, getAllInventory);

// ✅ Get inventory by owner - any authenticated user
router.get("/owner/:owner_id", requireAuth, getInventoryByOwner);

// ✅ Add new inventory item - only ADMIN, PHARMACY, HOSPITAL_STAFF, DONOR
router.post(
  "/",
  requireAuth,
  authorizeRoles(
    ROLES.ADMIN,
    ROLES.PHARMACY,
    ROLES.HOSPITAL_STAFF,
    ROLES.DONOR
  ),
  createInventory
);

// ✅ Update inventory item by id - only the owner
router.put("/:inventory_id", requireAuth, updateInventory);

// ✅ Delete inventory item by id - only the owner
router.delete("/:inventory_id", requireAuth, deleteInventory);

module.exports = router;
