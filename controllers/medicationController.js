// controllers/medicationController.js
import db from "../config/db.js";
import dayjs from "dayjs";

// ======= Helpers =======
function isValidDate(dateStr) {
  const d = dayjs(dateStr, ["YYYY-MM-DD", "DD/MM/YYYY"], true);
  return d.isValid();
}

// ======= CRUD =======

// Get all medications
export const getAllMedications = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM medication_inventory ORDER BY expiration_date ASC"
    );
    return res
      .status(200)
      .json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Error fetching medications.",
      error: err,
    });
  }
};

// Get medication by ID
export const getMedicationById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(
      "SELECT * FROM medication_inventory WHERE id = ?",
      [id]
    );
    if (rows.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Medication not found." });
    return res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Error fetching medication.",
      error: err,
    });
  }
};

// Add medication
export const addMedication = async (req, res) => {
  try {
    const {
      owner_id,
      item_id,
      quantity_available,
      expiration_date,
      location_city,
      verified,
    } = req.body;

    if (!owner_id || !item_id || !quantity_available) {
      return res.status(400).json({
        success: false,
        message: "owner_id, item_id and quantity_available are required.",
      });
    }

    let expDate = null;
    if (expiration_date) {
      if (!isValidDate(expiration_date)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid expiration_date format." });
      }
      expDate = dayjs(expiration_date).format("YYYY-MM-DD");
    }

    const [result] = await db.query(
      `INSERT INTO medication_inventory (owner_id, item_id, quantity_available, expiration_date, location_city, verified)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        owner_id,
        item_id,
        quantity_available,
        expDate,
        location_city || null,
        verified ? 1 : 0,
      ]
    );

    const [[newMed]] = await db.query(
      "SELECT * FROM medication_inventory WHERE id = ?",
      [result.insertId]
    );
    return res
      .status(201)
      .json({ success: true, message: "Medication added.", data: newMed });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Error adding medication.",
      error: err,
    });
  }
};

// Update medication
export const updateMedication = async (req, res) => {
  try {
    const { id } = req.params;
    const input = req.body || {};

    // Validate expiration_date if provided
    if (input.expiration_date && !isValidDate(input.expiration_date)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid expiration_date format." });
    }

    const fields = [];
    const values = [];
    for (const key of [
      "owner_id",
      "item_id",
      "quantity_available",
      "expiration_date",
      "location_city",
      "verified",
    ]) {
      if (input[key] !== undefined) {
        fields.push(`${key} = ?`);
        if (key === "expiration_date") {
          values.push(dayjs(input[key]).format("YYYY-MM-DD"));
        } else if (key === "verified") {
          values.push(input[key] ? 1 : 0);
        } else {
          values.push(input[key]);
        }
      }
    }

    if (fields.length === 0)
      return res
        .status(400)
        .json({ success: false, message: "No valid fields to update." });

    const [result] = await db.query(
      `UPDATE medication_inventory SET ${fields.join(", ")} WHERE id = ?`,
      [...values, id]
    );
    if (result.affectedRows === 0)
      return res
        .status(404)
        .json({ success: false, message: "Medication not found." });

    const [[updatedMed]] = await db.query(
      "SELECT * FROM medication_inventory WHERE id = ?",
      [id]
    );
    return res.status(200).json({
      success: true,
      message: "Medication updated.",
      data: updatedMed,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Error updating medication.",
      error: err,
    });
  }
};

// Delete medication
export const deleteMedication = async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.query(
      "DELETE FROM medication_inventory WHERE id = ?",
      [id]
    );
    if (result.affectedRows === 0)
      return res
        .status(404)
        .json({ success: false, message: "Medication not found." });
    return res
      .status(200)
      .json({ success: true, message: "Medication deleted." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Error deleting medication.",
      error: err,
    });
  }
};

// ======= Advanced Queries =======

// Get expired medications
export const getExpiredMedications = async (req, res) => {
  try {
    const today = dayjs().format("YYYY-MM-DD");
    const [rows] = await db.query(
      "SELECT * FROM medication_inventory WHERE expiration_date < ? ORDER BY expiration_date ASC",
      [today]
    );
    return res
      .status(200)
      .json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Error fetching expired medications.",
      error: err,
    });
  }
};

// Get medications by owner
export const getMedicationsByOwner = async (req, res) => {
  try {
    const { owner_id } = req.params;
    const [rows] = await db.query(
      "SELECT * FROM medication_inventory WHERE owner_id = ? ORDER BY expiration_date ASC",
      [owner_id]
    );
    return res
      .status(200)
      .json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Error fetching medications by owner.",
      error: err,
    });
  }
};

// Get medications by location city
export const getMedicationsByLocation = async (req, res) => {
  try {
    const { city } = req.params;
    const [rows] = await db.query(
      "SELECT * FROM medication_inventory WHERE location_city = ? ORDER BY expiration_date ASC",
      [city]
    );
    return res
      .status(200)
      .json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Error fetching medications by location.",
      error: err,
    });
  }
};
