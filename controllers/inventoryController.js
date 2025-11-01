const db = require("../config/db");
const dayjs = require("dayjs");

// ------------------ CREATE Inventory ------------------
const createInventory = async (req, res) => {
  try {
    const { item_id, quantity_available, expiration_date, location_city } =
      req.body;
    const owner_id = req.user.id;
    const role = req.user.role;

    const allowedRoles = ["DONOR", "PHARMACY", "HOSPITAL_STAFF"];
    if (!allowedRoles.includes(role)) {
      return res
        .status(403)
        .json({ success: false, message: "Unauthorized to add inventory" });
    }

    if (!item_id || !quantity_available || !location_city) {
      return res.status(400).json({
        success: false,
        message: "item_id, quantity_available, and location_city are required",
      });
    }

    await db.query(
      `INSERT INTO medication_inventory (owner_id, item_id, quantity_available, expiration_date, location_city)
       VALUES (?, ?, ?, ?, ?)`,
      [
        owner_id,
        item_id,
        quantity_available,
        expiration_date || null,
        location_city,
      ]
    );

    res
      .status(201)
      .json({ success: true, message: "Inventory item added successfully" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Error adding inventory", error });
  }
};

// ------------------ GET ALL Inventory ------------------
const getAllInventory = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT mi.*, u.full_name AS owner_name, i.name AS item_name
      FROM medication_inventory mi
      JOIN user u ON u.user_id = mi.owner_id
      JOIN items i ON i.id = mi.item_id
      ORDER BY mi.id DESC
    `);

    res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching inventory", error });
  }
};

// ------------------ GET Inventory by Owner ------------------
const getInventoryByOwner = async (req, res) => {
  try {
    const { owner_id } = req.params;
    const [rows] = await db.query(
      `
      SELECT mi.*, u.full_name AS owner_name, i.name AS item_name
      FROM medication_inventory mi
      JOIN user u ON u.user_id = mi.owner_id
      JOIN items i ON i.id = mi.item_id
      WHERE mi.owner_id = ?
      ORDER BY mi.id DESC
    `,
      [owner_id]
    );

    res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Error fetching inventory by owner",
      error,
    });
  }
};

// ------------------ UPDATE Inventory ------------------
const updateInventory = async (req, res) => {
  try {
    const { inventory_id } = req.params; // <-- use correct param name
    const { quantity_available, expiration_date, location_city, verified } =
      req.body;
    const owner_id = req.user.id; // logged-in user

    // Check if the inventory item exists and belongs to the user
    const [[item]] = await db.query(
      "SELECT * FROM medication_inventory WHERE id = ?",
      [inventory_id]
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Inventory item not found",
      });
    }

    if (item.owner_id !== owner_id) {
      return res.status(403).json({
        success: false,
        message: "You can only update your own inventory",
      });
    }

    // Update query
    const [result] = await db.query(
      `UPDATE medication_inventory 
       SET quantity_available = ?, expiration_date = ?, location_city = ?, verified = ?
       WHERE id = ?`,
      [
        quantity_available,
        expiration_date,
        location_city,
        verified,
        inventory_id,
      ]
    );

    // Fetch the updated record
    const [[updatedItem]] = await db.query(
      `
      SELECT mi.*, u.full_name AS owner_name, i.name AS item_name
      FROM medication_inventory mi
      JOIN user u ON u.user_id = mi.owner_id
      JOIN items i ON i.id = mi.item_id
      WHERE mi.id = ?
      `,
      [inventory_id]
    );

    res.status(200).json({
      success: true,
      message: "Inventory item updated successfully",
      data: updatedItem,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Error updating inventory",
      error,
    });
  }
};

// ------------------ DELETE Inventory ------------------
const deleteInventory = async (req, res) => {
  try {
    const { inventory_id } = req.params;
    const owner_id = req.user.id;

    const [[item]] = await db.query(
      "SELECT * FROM medication_inventory WHERE id = ?",
      [inventory_id]
    );
    if (!item)
      return res
        .status(404)
        .json({ success: false, message: "Inventory item not found" });
    if (item.owner_id !== owner_id) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own inventory",
      });
    }

    await db.query("DELETE FROM medication_inventory WHERE id = ?", [
      inventory_id,
    ]);

    res
      .status(200)
      .json({ success: true, message: "Inventory deleted successfully" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Error deleting inventory", error });
  }
};

module.exports = {
  createInventory,
  getAllInventory,
  getInventoryByOwner,
  updateInventory,
  deleteInventory,
};
