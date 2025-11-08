// controllers/missionController.js
const db = require("../config/db");
const dayjs = require("dayjs");
const customParseFormat = require("dayjs/plugin/customParseFormat");
dayjs.extend(customParseFormat);

// Helper: format mission dates
function formatMission(m) {
  if (!m) return null;
  return {
    ...m,
    start_date: m.start_date ? dayjs(m.start_date).format("YYYY-MM-DD") : null,
    end_date: m.end_date ? dayjs(m.end_date).format("YYYY-MM-DD") : null,
    created_at: m.created_at
      ? dayjs(m.created_at).format("YYYY-MM-DD HH:mm")
      : null,
    updated_at: m.updated_at
      ? dayjs(m.updated_at).format("YYYY-MM-DD HH:mm")
      : null,
  };
}

// ----------------- Missions -----------------

// GET all upcoming missions (with NGO name)
const getAllMissions = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT 
         m.id, m.title, m.description, m.location_city, m.start_date, m.end_date, m.status, m.mission_type,
         m.contact_person, m.contact_phone, m.created_at, m.updated_at,
         u.user_id AS ngo_id, u.full_name AS ngo_name, u.email AS ngo_email
       FROM medical_missions m
       LEFT JOIN \`user\` u ON m.ngo_id = u.user_id
       WHERE m.end_date >= CURDATE()
       ORDER BY m.start_date ASC`
    );
    res.status(200).json({
      success: true,
      count: rows.length,
      data: rows.map(formatMission),
    });
  } catch (error) {
    console.error("getAllMissions:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching missions",
      error: error.message,
    });
  }
};

// GET mission by id (detailed)

// GET mission by id (detailed)
const getMissionById = async (req, res) => {
  try {
    const { mission_id } = req.params;

    // Fetch mission details
    const [[mission]] = await db.query(
      `SELECT * FROM medical_missions WHERE id = ?`,
      [mission_id]
    );

    if (!mission) {
      return res
        .status(404)
        .json({ success: false, message: "Mission not found" });
    }

    // Fetch volunteers assigned to this mission
    const [vols] = await db.query(
      `SELECT mv.user_id AS volunteer_id, u.full_name, u.email, dp.specialty
       FROM mission_volunteers mv
       JOIN \`user\` u ON mv.user_id = u.user_id
       LEFT JOIN doctor_profiles dp ON dp.user_id = mv.user_id
       WHERE mv.mission_id = ?`,
      [mission_id]
    );

    const [appts] = await db.query(
      `SELECT ma.id, ma.patient_id, u.full_name AS patient_name, ma.notes, ma.appointment_date
   FROM mission_appointments ma
   LEFT JOIN \`user\` u ON ma.patient_id = u.user_id
   WHERE ma.mission_id = ?`,
      [mission_id]
    );

    res.status(200).json({
      success: true,
      data: {
        mission: formatMission(mission), // your existing formatting function
        volunteers: vols,
        appointments: appts,
      },
    });
  } catch (error) {
    console.error("getMissionById:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching mission",
      error: error.message,
    });
  }
};

// const getMissionById = async (req, res) => {
//   try {
//     const { mission_id } = req.params;
//     const [[mission]] = await db.query(
//       `SELECT * FROM medical_missions WHERE id = ?`,
//       [mission_id]
//     );
//     if (!mission)
//       return res
//         .status(404)
//         .json({ success: false, message: "Mission not found" });
//     // fetch volunteers and appointments
//     const [vols] = await db.query(
//       `SELECT mv.volunteer_id, u.full_name, u.email, dp.specialty
//        FROM mission_volunteers mv
//        JOIN \`user\` u ON mv.volunteer_id = u.user_id
//        LEFT JOIN doctor_profiles dp ON dp.user_id = mv.volunteer_id
//        WHERE mv.mission_id = ?`,
//       [mission_id]
//     );
//     const [appts] = await db.query(
//       `SELECT ma.id, ma.patient_id, u.full_name AS patient_name, ma.notes, ma.created_at
//        FROM mission_appointments ma
//        LEFT JOIN \`user\` u ON ma.patient_id = u.user_id
//        WHERE ma.mission_id = ?`,
//       [mission_id]
//     );
//     res.status(200).json({
//       success: true,
//       data: {
//         mission: formatMission(mission),
//         volunteers: vols,
//         appointments: appts,
//       },
//     });
//   } catch (error) {
//     console.error("getMissionById:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error fetching mission",
//       error: error.message,
//     });
//   }
// };

// CREATE mission
const createMission = async (req, res) => {
  let conn;
  try {
    const {
      ngo_id,
      title,
      description,
      location_city,
      start_date,
      end_date,
      mission_type,
      contact_person,
      contact_phone,
    } = req.body;

    if (!ngo_id || !title || !location_city || !start_date) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: ngo_id, title, location_city, start_date",
      });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    const [result] = await conn.query(
      `INSERT INTO medical_missions 
        (ngo_id, title, description, location_city, start_date, end_date, mission_type, contact_person, contact_phone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ngo_id,
        title,
        description || null,
        location_city,
        start_date,
        end_date || null,
        mission_type || "GENERAL_CLINIC",
        contact_person || null,
        contact_phone || null,
      ]
    );

    const [[mission]] = await conn.query(
      `SELECT * FROM medical_missions WHERE id = ?`,
      [result.insertId]
    );
    await conn.commit();

    res.status(201).json({
      success: true,
      message: "Mission created successfully",
      data: formatMission(mission),
    });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error("createMission:", error);
    res.status(500).json({
      success: false,
      message: "Error creating mission",
      error: error.message,
    });
  } finally {
    if (conn) conn.release();
  }
};

// UPDATE mission (partial)
const updateMission = async (req, res) => {
  try {
    const { mission_id } = req.params;
    const allowed = [
      "title",
      "description",
      "location_city",
      "start_date",
      "end_date",
      "status",
      "mission_type",
      "contact_person",
      "contact_phone",
    ];
    const fields = [];
    const params = [];
    for (const k of allowed) {
      if (req.body[k] !== undefined) {
        fields.push(`${k} = ?`);
        params.push(req.body[k]);
      }
    }
    if (fields.length === 0)
      return res
        .status(400)
        .json({ success: false, message: "No fields to update" });
    params.push(mission_id);
    const [result] = await db.query(
      `UPDATE medical_missions SET ${fields.join(
        ", "
      )}, updated_at = NOW() WHERE id = ?`,
      params
    );
    if (result.affectedRows === 0)
      return res
        .status(404)
        .json({ success: false, message: "Mission not found" });
    const [[mission]] = await db.query(
      `SELECT * FROM medical_missions WHERE id = ?`,
      [mission_id]
    );
    res.status(200).json({
      success: true,
      message: "Mission updated",
      data: formatMission(mission),
    });
  } catch (error) {
    console.error("updateMission:", error);
    res.status(500).json({
      success: false,
      message: "Error updating mission",
      error: error.message,
    });
  }
};

// DELETE (soft cancel) mission
const cancelMission = async (req, res) => {
  try {
    const { mission_id } = req.params;
    const [result] = await db.query(
      `UPDATE medical_missions SET status = 'CANCELLED', updated_at = NOW() WHERE id = ?`,
      [mission_id]
    );
    if (result.affectedRows === 0)
      return res
        .status(404)
        .json({ success: false, message: "Mission not found" });
    res.status(200).json({ success: true, message: "Mission cancelled" });
  } catch (error) {
    console.error("cancelMission:", error);
    res.status(500).json({
      success: false,
      message: "Error cancelling mission",
      error: error.message,
    });
  }
};

// ----------------- Availability (doctor slots) -----------------
// Table assumed: availability_slots (id, doctor_id, start_at, end_at, is_booked, created_at, updated_at)

const createAvailability = async (req, res) => {
  try {
    const { doctor_id, start_at, end_at } = req.body;
    if (!doctor_id || !start_at || !end_at)
      return res.status(400).json({
        success: false,
        message: "doctor_id, start_at, end_at required",
      });

    // optional: check overlapping slots for same doctor
    const [overlap] = await db.query(
      `SELECT id FROM availability_slots WHERE doctor_id = ? AND NOT (end_at <= ? OR start_at >= ?)`,
      [doctor_id, start_at, end_at]
    );
    if (overlap.length > 0)
      return res
        .status(409)
        .json({ success: false, message: "Overlapping slot exists" });

    const [result] = await db.query(
      `INSERT INTO availability_slots (doctor_id, start_at, end_at, is_booked) VALUES (?, ?, ?, 0)`,
      [doctor_id, start_at, end_at]
    );
    const [[slot]] = await db.query(
      `SELECT * FROM availability_slots WHERE id = ?`,
      [result.insertId]
    );
    res
      .status(201)
      .json({ success: true, message: "Availability created", data: slot });
  } catch (error) {
    console.error("createAvailability:", error);
    res.status(500).json({
      success: false,
      message: "Error creating availability",
      error: error.message,
    });
  }
};

const listAvailability = async (req, res) => {
  try {
    const { doctor_id } = req.params;
    const [rows] = await db.query(
      `SELECT * FROM availability_slots WHERE doctor_id = ? AND end_at >= NOW() ORDER BY start_at ASC`,
      [doctor_id]
    );
    res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error("listAvailability:", error);
    res.status(500).json({
      success: false,
      message: "Error listing availability",
      error: error.message,
    });
  }
};

// ----------------- Volunteers listing -----------------
const listVolunteers = async (req, res) => {
  try {
    const { mission_id } = req.params;
    const [rows] = await db.query(
      `SELECT mv.user_id AS volunteer_id, u.full_name, u.email, mv.role, mv.joined_at
       FROM mission_volunteers mv
       JOIN \`user\` u ON mv.user_id = u.user_id
       WHERE mv.mission_id = ?`,
      [mission_id]
    );
    res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error("listVolunteers:", error);
    res.status(500).json({
      success: false,
      message: "Error listing volunteers",
      error: error.message,
    });
  }
};

// ----------------- Appointments list per mission -----------------
const listAppointments = async (req, res) => {
  try {
    const { mission_id } = req.params;
    const [rows] = await db.query(
      `SELECT ma.id, ma.patient_id, u.full_name AS patient_name, ma.notes, ma.appointment_date
       FROM mission_appointments ma
       LEFT JOIN \`user\` u ON ma.patient_id = u.user_id
       WHERE ma.mission_id = ? ORDER BY ma.appointment_date DESC`,
      [mission_id]
    );
    res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error("listAppointments:", error);
    res.status(500).json({
      success: false,
      message: "Error listing appointments",
      error: error.message,
    });
  }
};

// ===================== Mission Appointments =====================
const bookAppointment = async (req, res) => {
  try {
    const { mission_id } = req.params;
    const { patient_id, doctor_id, appointment_date, notes } = req.body;

    if (!patient_id || !doctor_id || !appointment_date) {
      return res.status(400).json({
        success: false,
        message: "patient_id, doctor_id, and appointment_date are required",
      });
    }

    // Check mission exists and not cancelled
    const [[mission]] = await db.query(
      `SELECT id, status FROM medical_missions WHERE id = ?`,
      [mission_id]
    );
    if (!mission)
      return res
        .status(404)
        .json({ success: false, message: "Mission not found" });
    if (mission.status === "CANCELLED")
      return res.status(400).json({
        success: false,
        message: "Cannot book on a cancelled mission",
      });

    // Insert appointment
    const [result] = await db.query(
      `INSERT INTO mission_appointments (mission_id, patient_id, doctor_id, appointment_date, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [mission_id, patient_id, doctor_id, appointment_date, notes || null]
    );

    res.status(201).json({
      success: true,
      message: "Appointment booked successfully",
      data: {
        id: result.insertId,
        mission_id,
        patient_id,
        doctor_id,
        appointment_date,
        notes,
      },
    });
  } catch (error) {
    console.error("bookAppointment:", error);
    res.status(500).json({
      success: false,
      message: "Error booking appointment",
      error: error.message,
    });
  }
};

// ----------------- Announcements -----------------
const sendAnnouncement = async (req, res) => {
  try {
    const { mission_id } = req.params;
    const { message, target_audience } = req.body;

    if (!message)
      return res
        .status(400)
        .json({ success: false, message: "message is required" });

    // Default to 'ALL' if target_audience is not provided
    const audience = target_audience || "ALL";

    const [result] = await db.query(
      `INSERT INTO mission_announcements (mission_id, message, target_audience, published_at) VALUES (?, ?, ?, NOW())`,
      [mission_id, message, audience]
    );

    res.status(201).json({
      success: true,
      message: "Announcement created",
      data: {
        id: result.insertId,
        mission_id,
        message,
        target_audience: audience,
      },
    });
  } catch (error) {
    console.error("sendAnnouncement:", error);
    res.status(500).json({
      success: false,
      message: "Error creating announcement",
      error: error.message,
    });
  }
};

// ===================== Mission Volunteers =====================
const assignVolunteer = async (req, res) => {
  try {
    const { mission_id } = req.params;
    const { volunteer_id } = req.body;

    if (!volunteer_id)
      return res
        .status(400)
        .json({ success: false, message: "volunteer_id is required" });

    // Check if already assigned
    const [existing] = await db.query(
      `SELECT * FROM mission_volunteers WHERE mission_id = ? AND user_id = ?`,
      [mission_id, volunteer_id]
    );

    if (existing.length > 0)
      return res
        .status(409)
        .json({ success: false, message: "Volunteer already assigned" });

    // Insert new assignment
    await db.query(
      `INSERT INTO mission_volunteers (mission_id, user_id, role) VALUES (?, ?, 'VOLUNTEER')`,
      [mission_id, volunteer_id]
    );

    res.status(201).json({
      success: true,
      message: "Volunteer assigned successfully",
      data: { mission_id, volunteer_id },
    });
  } catch (error) {
    console.error("assignVolunteer:", error);
    res.status(500).json({
      success: false,
      message: "Error assigning volunteer",
      error: error.message,
    });
  }
};

module.exports = {
  getAllMissions,
  getMissionById,
  createMission,
  updateMission,
  cancelMission,
  createAvailability,
  listAvailability,
  assignVolunteer,
  listVolunteers,
  listAppointments,
  bookAppointment,
  sendAnnouncement,
};
