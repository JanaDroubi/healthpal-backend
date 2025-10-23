const db = require("../config/db");

// GET all equipment
async function getAllEquipment(req, res) {
  try {
    const [rows] = await db.query("SELECT * FROM equipment_inventory");
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching equipment" });
  }
}

// GET single equipment by ID
async function getEquipmentById(req, res) {
  const { id } = req.params;
  try {
    const [rows] = await db.query(
      "SELECT * FROM equipment_inventory WHERE id = ?",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Equipment not found" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching equipment" });
  }
}

// ADD new equipment
async function addEquipment(req, res) {
  const {
    owner_id,
    item_id,
    condition,
    quantity_available,
    location_city,
    availability_status,
  } = req.body;

  if (!owner_id || !item_id || !quantity_available) {
    return res.status(400).json({
      message: "owner_id, item_id, and quantity_available are required",
    });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO equipment_inventory
       (owner_id, item_id, \`condition\`, quantity_available, location_city, availability_status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        owner_id,
        item_id,
        condition || "USED",
        quantity_available,
        location_city || "",
        availability_status || "AVAILABLE",
      ]
    );

    res.json({ message: "Equipment added", equipmentId: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error adding equipment" });
  }
}

// UPDATE equipment by ID

// UPDATE equipment by ID
async function updateEquipment(req, res) {
  try {
    const { id } = req.params;
    const body = req.body || {};

    if (!id) {
      return res.status(400).json({ message: "Missing equipment ID" });
    }

    const {
      condition: newCondition,
      quantity_available,
      location_city,
      availability_status,
    } = body;

    // Build dynamic query only with fields provided
    const fields = [];
    const values = [];

    if (newCondition !== undefined) {
      fields.push("`condition` = ?"); // backticks required
      values.push(newCondition);
    }
    if (quantity_available !== undefined) {
      fields.push("quantity_available = ?");
      values.push(quantity_available);
    }
    if (location_city !== undefined) {
      fields.push("location_city = ?");
      values.push(location_city);
    }
    if (availability_status !== undefined) {
      fields.push("availability_status = ?");
      values.push(availability_status);
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    values.push(id); // for WHERE clause
    const query = `UPDATE equipment_inventory SET ${fields.join(
      ", "
    )} WHERE id = ?`;

    const [result] = await db.query(query, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Equipment not found" });
    }

    res.json({ message: "Equipment updated successfully" });
  } catch (error) {
    console.error("❌ Error updating equipment:", error);
    res.status(500).json({ message: "Error updating equipment" });
  }
}

module.exports = { updateEquipment };

// DELETE equipment by ID
async function deleteEquipment(req, res) {
  const { id } = req.params;

  try {
    const [result] = await db.query(
      "DELETE FROM equipment_inventory WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Equipment not found" });
    }

    res.json({ message: "Equipment deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error deleting equipment" });
  }
}

module.exports = {
  getAllEquipment,
  getEquipmentById,
  addEquipment,
  updateEquipment,
  deleteEquipment,
};
