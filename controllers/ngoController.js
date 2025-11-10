// ngoController.js

const db = require("../config/db");
const dayjs = require("dayjs");
const customParseFormat = require("dayjs/plugin/customParseFormat");
dayjs.extend(customParseFormat);

// ===================== Helper Function =====================
function formatNgoDates(ngo) {
  if (!ngo) return null;
  return {
    ...ngo,
    created_at: ngo.created_at
      ? dayjs(ngo.created_at).format("YYYY-MM-DD HH:mm")
      : null,
    updated_at: ngo.updated_at
      ? dayjs(ngo.updated_at).format("YYYY-MM-DD HH:mm")
      : null,
  };
}

// ===================== NGO Profiles =====================

// GET all verified NGOs
const getAllVerifiedNgos = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT u.user_id, u.full_name, u.email, u.phone, n.registry_no, n.verified, n.created_at, n.updated_at
      FROM ngo_profiles n
      JOIN user u ON u.user_id = n.user_id
      WHERE n.verified = 1
      ORDER BY n.created_at DESC
    `);

    if (rows.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "No verified NGOs found" });

    const formatted = rows.map(formatNgoDates);

    res.status(200).json({
      success: true,
      message: "Verified NGOs retrieved successfully",
      count: formatted.length,
      data: formatted,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching NGOs", error });
  }
};

// GET NGO profile by user_id
const getNgoByUserId = async (req, res) => {
  try {
    const { user_id } = req.params;
    const [rows] = await db.query(
      `SELECT * FROM ngo_profiles WHERE user_id = ?`,
      [user_id]
    );
    if (rows.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "NGO profile not found" });

    const formatted = formatNgoDates(rows[0]);
    res.status(200).json({
      success: true,
      message: "NGO profile retrieved",
      data: formatted,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching NGO profile", error });
  }
};

// CREATE NGO profile
const createNgoProfile = async (req, res) => {
  let conn;
  try {
    const { user_id, registry_no } = req.body;
    if (!user_id)
      return res
        .status(400)
        .json({ success: false, message: "user_id is required" });

    conn = await db.getConnection();
    await conn.beginTransaction();

    const [existing] = await conn.query(
      `SELECT * FROM ngo_profiles WHERE user_id = ?`,
      [user_id]
    );
    if (existing.length > 0)
      return res
        .status(409)
        .json({ success: false, message: "NGO profile already exists" });

    await conn.query(
      `INSERT INTO ngo_profiles (user_id, registry_no, verified) VALUES (?, ?, 0)`,
      [user_id, registry_no || null]
    );

    const [[profile]] = await conn.query(
      `SELECT * FROM ngo_profiles WHERE user_id = ?`,
      [user_id]
    );
    await conn.commit();

    res.status(201).json({
      success: true,
      message: "NGO profile created successfully",
      data: formatNgoDates(profile),
    });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Error creating NGO profile", error });
  } finally {
    if (conn) conn.release();
  }
};

// UPDATE NGO profile
const updateNgoProfile = async (req, res) => {
  try {
    const { user_id } = req.params;
    const { registry_no, verified } = req.body;

    const updates = [];
    const values = [];

    if (registry_no !== undefined) {
      updates.push("registry_no = ?");
      values.push(registry_no);
    }
    if (verified !== undefined) {
      updates.push("verified = ?");
      values.push(verified ? 1 : 0);
    }

    if (updates.length === 0)
      return res
        .status(400)
        .json({ success: false, message: "No fields to update" });

    const [result] = await db.query(
      `UPDATE ngo_profiles SET ${updates.join(
        ", "
      )}, updated_at = NOW() WHERE user_id = ?`,
      [...values, user_id]
    );

    if (result.affectedRows === 0)
      return res
        .status(404)
        .json({ success: false, message: "NGO profile not found" });

    const [[updated]] = await db.query(
      `SELECT * FROM ngo_profiles WHERE user_id = ?`,
      [user_id]
    );

    res.status(200).json({
      success: true,
      message: "NGO profile updated",
      data: formatNgoDates(updated),
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Error updating NGO profile", error });
  }
};

// ===================== Medical Missions =====================

// GET all missions
const getAllMissions = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT * FROM medical_missions
      WHERE end_date >= NOW()
      ORDER BY start_date ASC
    `);
    res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching missions", error });
  }
};

// CREATE a new mission
const createMission = async (req, res) => {
  let conn;
  try {
    const { ngo_id, name, description, start_date, end_date, location } =
      req.body;
    if (!ngo_id || !name || !start_date || !end_date || !location) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    const [result] = await conn.query(
      `INSERT INTO medical_missions (ngo_id, name, description, start_date, end_date, location)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [ngo_id, name, description || null, start_date, end_date, location]
    );

    const [[mission]] = await conn.query(
      `SELECT * FROM medical_missions WHERE id = ?`,
      [result.insertId]
    );
    await conn.commit();

    res
      .status(201)
      .json({ success: true, message: "Mission created", data: mission });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Error creating mission", error });
  } finally {
    if (conn) conn.release();
  }
};

// ===================== Mission Volunteers =====================
const assignVolunteer = async (req, res) => {
  try {
    const { mission_id } = req.params;
    const { doctor_id } = req.body;
    if (!doctor_id)
      return res
        .status(400)
        .json({ success: false, message: "doctor_id required" });

    const [existing] = await db.query(
      `SELECT * FROM mission_volunteers WHERE mission_id = ? AND doctor_id = ?`,
      [mission_id, doctor_id]
    );
    if (existing.length > 0)
      return res
        .status(409)
        .json({ success: false, message: "Volunteer already assigned" });

    const [result] = await db.query(
      `INSERT INTO mission_volunteers (mission_id, doctor_id) VALUES (?, ?)`,
      [mission_id, doctor_id]
    );
    res.status(201).json({
      success: true,
      message: "Volunteer assigned",
      data: { mission_id, doctor_id },
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Error assigning volunteer", error });
  }
};

// ===================== Mission Appointments =====================
const bookAppointment = async (req, res) => {
  try {
    const { mission_id } = req.params;
    const { patient_id, notes } = req.body;
    if (!patient_id)
      return res
        .status(400)
        .json({ success: false, message: "patient_id required" });

    const [existing] = await db.query(
      `SELECT * FROM mission_appointments WHERE mission_id = ? AND patient_id = ?`,
      [mission_id, patient_id]
    );
    if (existing.length > 0)
      return res
        .status(409)
        .json({ success: false, message: "Appointment already exists" });

    const [result] = await db.query(
      `INSERT INTO mission_appointments (mission_id, patient_id, notes) VALUES (?, ?, ?)`,
      [mission_id, patient_id, notes || null]
    );
    res.status(201).json({
      success: true,
      message: "Appointment booked",
      data: { mission_id, patient_id, notes },
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Error booking appointment", error });
  }
};

// ===================== Mission Announcements =====================
const sendAnnouncement = async (req, res) => {
  try {
    const { mission_id } = req.params;
    const { message } = req.body;
    if (!message)
      return res
        .status(400)
        .json({ success: false, message: "Message is required" });

    const [result] = await db.query(
      `INSERT INTO mission_announcements (mission_id, message) VALUES (?, ?)`,
      [mission_id, message]
    );

    res.status(201).json({
      success: true,
      message: "Announcement sent",
      data: { mission_id, message },
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Error sending announcement", error });
  }
};

module.exports = {
  getAllVerifiedNgos,
  getNgoByUserId,
  createNgoProfile,
  updateNgoProfile,
};
