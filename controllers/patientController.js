// patientController.js

const db = require('../config/db');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);

// Helper Function — Format Dates Consistently
function formatPatientDates(patient) {
  if (!patient) return null;
  return {
    ...patient,
    dob: patient.dob ? dayjs(patient.dob).format('DD/MM/YYYY') : null,
    created_at: patient.created_at
      ? dayjs(patient.created_at).format('YYYY-MM-DD HH:mm')
      : null,
    updated_at: patient.updated_at
      ? dayjs(patient.updated_at).format('YYYY-MM-DD HH:mm')
      : null,
  };
}

//  GET all patient profiles ===========================================================================
const getAllPatients = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        u.user_id,
        u.full_name,
        u.email,
        u.phone,
        u.status,
        p.*
      FROM user u
      LEFT JOIN patient_profiles p ON u.user_id = p.user_id
      WHERE u.role = 'PATIENT' AND u.status = 'ACTIVE'
      ORDER BY u.created_at DESC
    `);

    if (rows.length === 0) {
      return res.status(404).send({
        success: false,
        message: 'No active patient profiles found',
      });
    }

    const formattedRows = rows.map(formatPatientDates);

    res.status(200).send({
      success: true,
      message: 'All patient profiles retrieved successfully',
      count: formattedRows.length,
      data: formattedRows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({
      success: false,
      message: 'Error fetching profiles',
      error,
    });
  }
};

// GET profile by user_id ===========================================================================
const getPatientByUserId = async (req, res) => {
  try {
    const { user_id } = req.params;

    if (req.user.role === "PATIENT" && req.user.id != user_id) {
      return res.status(403).send({
        success: false,
        message: "Access denied: you can only view your own profile",
      });
    }

    const [rows] = await db.query(
      `SELECT * FROM patient_profiles WHERE user_id = ?`,
      [user_id]
    );
    if (rows.length === 0)
      return res.status(404).send({ success: false, message: 'Profile not found' });

    const formatted = formatPatientDates(rows[0]);

    res.status(200).send({
      success: true,
      message: "Patient profile retrieved successfully",
      data: formatted,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({
      success: false,
      message: 'Error fetching profile',
      error,
    });
  }
};

// CREATE PATIENT PROFILE ===========================================================================
const createPatientProfile = async (req, res) => {
  let conn;
  try {
    const {
      user_id, dob, gender, blood_type, height_cm, weight_kg,
      emergency_contact_phone, country, city, marital_status,
      occupation, preferred_language, allergies_summary,
      chronic_conditions_summary, medical_history
    } = req.body;

    if (req.user.role === "PATIENT" && req.user.id != user_id) {
      return res.status(403).send({
        success: false,
        message: "Access denied: you can only create your own profile",
      });
    }

    if (!user_id) {
      return res.status(400).send({
        success: false,
        message: "User ID is required",
      });
    }

    const [[user]] = await db.query("SELECT user_id, role FROM user WHERE user_id = ?", [user_id]);
    if (!user) {
      return res.status(404).send({ success: false, message: "User not found" });
    }

    if (user.role !== "PATIENT") {
      return res.status(403).send({
        success: false,
        message: "Only users with role 'PATIENT' can have a patient profile",
      });
    }

    const [profileExists] = await db.query(
      "SELECT user_id FROM patient_profiles WHERE user_id = ?",
      [user_id]
    );
    if (profileExists.length > 0) {
      return res.status(409).send({
        success: false,
        message: "Patient profile already exists for this user",
      });
    }

    let formattedDob = null;
    if (dob) {
      const parsed = dayjs(dob, ['DD/MM/YYYY', 'YYYY-MM-DD'], true);
      if (!parsed.isValid()) {
        return res.status(400).send({
          success: false,
          message: "Invalid date format. Use DD/MM/YYYY or YYYY-MM-DD",
        });
      }
      formattedDob = parsed.format('YYYY-MM-DD');
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    await conn.query(
      `INSERT INTO patient_profiles (
        user_id, dob, gender, blood_type, height_cm, weight_kg, emergency_contact_phone,
        country, city, marital_status, occupation, preferred_language,
        allergies_summary, chronic_conditions_summary, medical_history
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id, formattedDob, gender, blood_type, height_cm, weight_kg, emergency_contact_phone,
        country, city, marital_status, occupation, preferred_language,
        allergies_summary, chronic_conditions_summary, medical_history
      ]
    );

    await conn.commit();

    const [[profile]] = await db.query(
      "SELECT * FROM patient_profiles WHERE user_id = ?",
      [user_id]
    );
    const formattedProfile = formatPatientDates(profile);

    return res.status(201).send({
      success: true,
      message: "Patient profile created successfully",
      data: formattedProfile,
    });

  } catch (error) {
    if (conn) await conn.rollback();
    console.error(error);
    res.status(500).send({
      success: false,
      message: "Error creating patient profile",
      error,
    });
  } finally {
    if (conn) conn.release();
  }
};

// UPDATE patient profile ===========================================================================
const PROFILE_ALLOWED_FIELDS = new Set([
  'dob', 'gender', 'blood_type', 'height_cm', 'weight_kg',
  'emergency_contact_phone', 'country', 'city',
  'marital_status', 'occupation', 'preferred_language',
  'allergies_summary', 'chronic_conditions_summary', 'medical_history'
]);

const updatePatientProfile = async (req, res) => {
  try {
    const { user_id } = req.params;

    if (req.user.role === "PATIENT" && req.user.id != user_id) {
      return res.status(403).send({
        success: false,
        message: "Access denied: you can only update your own profile",
      });
    }

    const fields = {};
    for (const key in req.body) {
      if (PROFILE_ALLOWED_FIELDS.has(key)) fields[key] = req.body[key];
    }

    if (Object.keys(fields).length === 0) {
      return res.status(400).send({
        success: false,
        message: 'No valid fields to update',
      });
    }

    if (fields.dob) {
      const parsed = dayjs(fields.dob, ['DD/MM/YYYY', 'YYYY-MM-DD'], true);
      if (parsed.isValid()) {
        fields.dob = parsed.format('YYYY-MM-DD');
      } else {
        return res.status(400).send({
          success: false,
          message: 'Invalid date format. Use DD/MM/YYYY or YYYY-MM-DD',
        });
      }
    }

    const setClause = Object.keys(fields)
      .map(key => `${key} = ?`)
      .join(', ');
    const values = Object.values(fields);

    const [result] = await db.query(
      `UPDATE patient_profiles SET ${setClause} WHERE user_id = ?`,
      [...values, user_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).send({
        success: false,
        message: 'Profile not found',
      });
    }

    const [[updated]] = await db.query(
      "SELECT * FROM patient_profiles WHERE user_id = ?",
      [user_id]
    );
    const formatted = formatPatientDates(updated);

    res.status(200).send({
      success: true,
      message: 'Profile updated successfully',
      data: formatted,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({
      success: false,
      message: 'Error updating profile',
      error,
    });
  }
};

// DELETE patient (Soft delete -> make INACTIVE) ===========================================================================
const deletePatient = async (req, res) => {
  let conn;
  try {
    const { user_id } = req.params;

   
    if (req.user.role === "PATIENT" && req.user.id != user_id) {
      return res.status(403).send({
        success: false,
        message: "Access denied: you can only delete your own profile",
      });
    }

    
    const [[user]] = await db.query(
      "SELECT user_id, role, status FROM `user` WHERE user_id = ? LIMIT 1",
      [user_id]
    );

    if (!user) {
      return res.status(404).send({ success: false, message: "User not found" });
    }

    if (String(user.role).toUpperCase() !== "PATIENT") {
      return res.status(403).send({
        success: false,
        message: "Target user is not a patient",
      });
    }

    
    conn = await db.getConnection();
    await conn.beginTransaction();

    
    const [delProfile] = await conn.query(
      "DELETE FROM patient_profiles WHERE user_id = ?",
      [user_id]
    );

    
    const [updUser] = await conn.query(
      "UPDATE `user` SET status = 'INACTIVE', updated_at = NOW() WHERE user_id = ?",
      [user_id]
    );

    await conn.commit();

    return res.status(200).send({
      success: true,
      message: "Patient profile deleted and user set to INACTIVE.",
      meta: {
        profile_deleted_rows: delProfile.affectedRows,
        user_updated_rows: updUser.affectedRows,
        was_already_inactive: String(user.status || '').toUpperCase() === 'INACTIVE'
      }
    });

  } catch (error) {
    if (conn) {
      try { await conn.rollback(); } catch (_) {}
    }
    console.error(error);
    res.status(500).send({
      success: false,
      message: "Error deactivating patient and deleting profile",
      error,
    });
  } finally {
    if (conn) conn.release();
  }
};


//  GET patient statistics ===========================================================================
const getPatientsStats = async (req, res) => {
  try {
    const [[{ totalPatients }]] = await db.query(`
      SELECT COUNT(*) AS totalPatients FROM patient_profiles
    `);

    const [cityRows] = await db.query(`
      SELECT city, COUNT(*) AS count
      FROM patient_profiles
      WHERE city IS NOT NULL AND city != ''
      GROUP BY city
      ORDER BY count DESC
    `);

    const byCity = {};
    cityRows.forEach(row => (byCity[row.city] = row.count));

    const [genderRows] = await db.query(`
      SELECT gender, COUNT(*) AS count
      FROM patient_profiles
      WHERE gender IS NOT NULL
      GROUP BY gender
    `);

    const byGender = {};
    genderRows.forEach(row => (byGender[row.gender] = row.count));

    res.status(200).send({
      success: true,
      message: "Patient statistics retrieved successfully",
      data: { totalPatients, byCity, byGender },
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({
      success: false,
      message: "Error fetching patient statistics",
      error,
    });
  }
};

module.exports = {
  getAllPatients,
  getPatientByUserId,
  createPatientProfile,
  updatePatientProfile,
  deletePatient,
  getPatientsStats,
};
