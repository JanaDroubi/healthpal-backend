const db = require("../config/db");

// ===== Medication Inventory =====
async function getAllMedications(req, res) {
  try {
    const [rows] = await db.query("SELECT * FROM medication_inventory");
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching medications" });
  }
}

async function requestMedication(req, res) {
  const { requester_id, item_id, quantity, urgency_level, notes } = req.body;
  try {
    const [result] = await db.query(
      `INSERT INTO supply_requests
            (requester_id, item_id, quantity, urgency_level, notes, status)
            VALUES (?, ?, ?, ?, ?, 'PENDING')`,
      [requester_id, item_id, quantity, urgency_level || "MEDIUM", notes || ""]
    );
    res.json({ message: "Supply request created", requestId: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error creating supply request" });
  }
}

async function fulfillRequest(req, res) {
  const { request_id, provider_user_id, provided_qty, notes } = req.body;
  try {
    const [result] = await db.query(
      `INSERT INTO fulfillments
            (request_id, provider_user_id, provided_qty, status, notes)
            VALUES (?, ?, ?, 'DELIVERED', ?)`,
      [request_id, provider_user_id, provided_qty, notes || ""]
    );

    await db.query("UPDATE supply_requests SET status = ? WHERE id = ?", [
      "FULFILLED",
      request_id,
    ]);

    res.json({ message: "Request fulfilled", fulfillmentId: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fulfilling request" });
  }
}

// ===== Equipment Inventory =====
async function getAllEquipment(req, res) {
  try {
    const [rows] = await db.query("SELECT * FROM equipment_inventory");
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching equipment" });
  }
}

async function addEquipment(req, res) {
  const {
    owner_id,
    item_id,
    condition,
    quantity_available,
    location_city,
    availability_status,
  } = req.body;
  try {
    const [result] = await db.query(
      `INSERT INTO equipment_inventory
            (owner_id, item_id, condition, quantity_available, location_city, availability_status)
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

module.exports = {
  getAllMedications,
  requestMedication,
  fulfillRequest,
  getAllEquipment,
  addEquipment,
};
