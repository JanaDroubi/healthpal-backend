const db = require('../config/db');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);


// GET all patient profiles
const getAllPatients = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM patient_profiles');

        if (rows.length === 0) {
            return res.status(404).send({
                success: false,
                message: 'No patient profiles found',
            });
        }

        // تنسيق التواريخ لكل سجل
        const formattedRows = rows.map(row => ({
            ...row,
            dob: row.dob ? dayjs(row.dob).format('DD/MM/YYYY') : null,
            created_at: row.created_at
                ? dayjs(row.created_at).format('YYYY-MM-DD HH:mm')
                : null,
            updated_at: row.updated_at
                ? dayjs(row.updated_at).format('YYYY-MM-DD HH:mm')
                : null,
        }));

        res.status(200).send({
            success: true,
            message: 'All patient profiles retrieved successfully',
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

// GET profile by user_id
const getPatientByUserId = async (req, res) => {
    try {
        const { user_id } = req.params;
        const [rows] = await db.query('SELECT * FROM patient_profiles WHERE user_id = ?', [user_id]);
        if (rows.length === 0) return res.status(404).send({ success: false, message: 'Profile not found' });

        const row = rows[0];

        // عرض بصيغة DD/MM/YYYY بالعربي
        row.dob = row.dob ? dayjs(row.dob).format('DD/MM/YYYY') : null;
        row.created_at = row.created_at ? dayjs(row.created_at).format('YYYY-MM-DD HH:mm') : null;
        row.updated_at = row.updated_at ? dayjs(row.updated_at).format('YYYY-MM-DD HH:mm') : null;

        res.status(200).send({ success: true, data: row });
    } catch (error) {
        console.error(error);
        res.status(500).send({ success: false, message: 'Error fetching profile', error });
    }
};

// CREATE PATIENT PROFILE
const createPatientProfile = async (req, res) => {
  try {
    const {
      user_id, dob, gender, blood_type, height_cm, weight_kg,
      emergency_contact_phone, country, city, marital_status,
      occupation, preferred_language, allergies_summary,
      chronic_conditions_summary, medical_history
    } = req.body;

    if (!user_id) {
      return res.status(400).send({
        success: false,
        message: "User ID is required"
      });
    }

    // 1️⃣ تأكد أن اليوزر موجود
    const [userRows] = await db.query("SELECT user_id, role FROM user WHERE user_id = ?", [user_id]);
    if (userRows.length === 0) {
      return res.status(404).send({ success: false, message: "User not found" });
    }

    // 2️⃣ تأكد أن اليوزر دوره PATIENT
    const user = userRows[0];
    if (user.role !== "PATIENT") {
      return res.status(403).send({
        success: false,
        message: "Only users with role 'PATIENT' can have a patient profile"
      });
    }

    // 3️⃣ تأكد ما عنده بروفايل مسبقاً
    const [profileExists] = await db.query(
      "SELECT user_id FROM patient_profiles WHERE user_id = ?",
      [user_id]
    );
    if (profileExists.length > 0) {
      return res.status(409).send({
        success: false,
        message: "Patient profile already exists for this user"
      });
    }

    // 🧩 4️⃣ صيغة التاريخ: حول "DD/MM/YYYY" إلى "YYYY-MM-DD"
    let formattedDob = null;
    if (dob) {
      const [day, month, year] = dob.split('/');
      formattedDob = `${year}-${month}-${day}`;
    }

    // 5️⃣ إنشاء البروفايل
    await db.query(
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

    return res.status(201).send({
      success: true,
      message: "Patient profile created successfully",
      user_id
    });

  } catch (error) {
    console.error(error);
    return res.status(500).send({
      success: false,
      message: "Error creating patient profile",
      error,
    });
  }
};

// UPDATE patient profile (partial update)
const updatePatientProfile = async (req, res) => {
    try {
        const { user_id } = req.params;
        const fields = { ...req.body };

        if (Object.keys(fields).length === 0) {
            return res.status(400).send({
                success: false,
                message: 'No fields to update'
            });
        }

        // ✅ تحويل التاريخ إذا كان بالصيغة DD/MM/YYYY
        if (fields.dob) {
            // نحاول نقرأه كتاريخ بصيغة DD/MM/YYYY أولًا
            const parsed = dayjs(fields.dob, ['DD/MM/YYYY', 'YYYY-MM-DD'], true);

            if (parsed.isValid()) {
                fields.dob = parsed.format('YYYY-MM-DD'); // الشكل المناسب لقاعدة البيانات
            } else {
                return res.status(400).send({
                    success: false,
                    message: 'Invalid date format. Use DD/MM/YYYY or YYYY-MM-DD'
                });
            }
        }


        const setClause = Object.keys(fields)
            .map(f => `${f} = ?`)
            .join(', ');
        const values = Object.values(fields);

        const [result] = await db.query(
            `UPDATE patient_profiles SET ${setClause} WHERE user_id = ?`,
            [...values, user_id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).send({
                success: false,
                message: 'Profile not found'
            });
        }

        res.status(200).send({
            success: true,
            message: 'Profile updated successfully'
        });
    } catch (error) {
        console.error(error);
        res.status(500).send({
            success: false,
            message: 'Error updating profile',
            error
        });
    }
};

// DELETE profile
const deletePatient = async (req, res) => {
    try {
        const { user_id } = req.params;
        const [result] = await db.query('DELETE FROM patient_profiles WHERE user_id = ?', [user_id]);
        if (result.affectedRows === 0)
            return res.status(404).send({ success: false, message: 'Profile not found' });
        res.status(200).send({ success: true, message: 'Profile deleted successfully' });
    } catch (error) {
        res.status(500).send({ success: false, message: 'Error deleting profile', error });
    }
};

module.exports = {
    getAllPatients,
    getPatientByUserId,
    createPatientProfile,
    updatePatientProfile,
    deletePatient
};
