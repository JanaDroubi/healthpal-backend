const db = require('../config/db');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);

// Create Doctor Profile
const createDoctorProfile = async (req, res) => {
    try {
        const {
            email,
            university_name,
            graduation_year,
            gender,
            specialty,
            license_no,
            bio,
            hire_date,
            telehealth_enabled,
        } = req.body || {};

        if (!email || !license_no) {
            return res.status(400).send({
                success: false,
                message: "Email and license_no are required."
            });
        }

        const [users] = await db.query(
            "SELECT user_id, role, status FROM `user` WHERE email = ? LIMIT 1",
            [email]
        );

        if (users.length === 0) {
            return res.status(404).send({
                success: false,
                message: "User not found."
            });
        }

        const { user_id: targetUserId, role, status } = users[0];

        if (role !== "DOCTOR") {
            return res.status(403).send({
                success: false,
                message: "Only users with role 'DOCTOR' can have a doctor profile."
            });
        }

        const [exists] = await db.query(
            "SELECT user_id FROM doctor_profiles WHERE user_id = ?",
            [targetUserId]
        );

        if (exists.length > 0) {
            return res.status(409).send({
                success: false,
                message: "Doctor profile already exists for this user."
            });
        }

        const [licenseRows] = await db.query(
            "SELECT license_no FROM doctor_profiles WHERE license_no = ?",
            [license_no]
        );

        if (licenseRows.length > 0) {
            return res.status(409).send({
                success: false,
                message: "This license number is already used by another doctor."
            });
        }


        let hireDateISO = null;
        if (hire_date) {
            const parsed = dayjs(hire_date, ["DD/MM/YYYY", "YYYY-MM-DD"], true);
            if (!parsed.isValid()) {
                return res.status(400).send({
                    success: false,
                    message: "Invalid hire_date format. Use DD/MM/YYYY or YYYY-MM-DD."
                });
            }
            hireDateISO = parsed.format("YYYY-MM-DD");
        }


        await db.query(
            `INSERT INTO doctor_profiles (
        user_id, university_name, graduation_year, gender, specialty,
        license_no, bio, hire_date, telehealth_enabled
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                targetUserId,
                university_name || null,
                graduation_year || null,
                gender || null,
                specialty || null,
                license_no,
                bio || null,
                hireDateISO,
                telehealth_enabled ? 1 : 0

            ]
        );


        const [rows] = await db.query(
            "SELECT * FROM doctor_profiles WHERE user_id = ?",
            [targetUserId]
        );

        res.status(201).send({
            success: true,
            message: "Doctor profile created successfully.",
            data: rows[0]
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send({
            success: false,
            message: "Error creating doctor profile.",
            error
        });
    }
};


//update
const PROFILE_ALLOWED_FIELDS = new Set([
  'university_name',
  'graduation_year',
  'gender',
  'specialty',
  'license_no',        // ADMIN only (checked below)
  'bio',
  'hire_date',
  'telehealth_enabled',
  'verified'
]);

// Doctor can update these in `user`
const USER_FIELDS_DOCTOR = new Set(['phone', 'password']);

// Admin can update these in `user`
const USER_FIELDS_ADMIN = new Set(['full_name', 'email', 'phone', 'password', 'status']);

const updateDoctorProfile = async (req, res) => {
  let conn;
  try {
    const { user_id } = req.params;
    const input = req.body || {};

    // actor (from token)
    const actor = req.user || {};
    const actorRole = String(actor.role || '').trim().toUpperCase();
    const actorId = String(actor.id || '');

    // 0) Ensure target user exists and is DOCTOR
    const [[target]] = await db.query(
      'SELECT user_id, role, email FROM `user` WHERE user_id = ? LIMIT 1',
      [user_id]
    );
    if (!target) return res.status(404).send({ success: false, message: 'User not found.' });
    if (String(target.role || '').toUpperCase() !== 'DOCTOR') {
      return res.status(403).send({ success: false, message: 'Target user is not a DOCTOR.' });
    }

    // 1) Ownership: doctor can update only his own account (admin always allowed)
    if (actorRole === 'DOCTOR' && actorId !== String(user_id)) {
      return res.status(403).send({
        success: false,
        message: 'Doctors can only update their own profile.'
      });
    }

    // 2) Split inputs into profile vs user fields
    const profileFields = {};
    for (const k of Object.keys(input)) {
      if (PROFILE_ALLOWED_FIELDS.has(k)) profileFields[k] = input[k];
    }

    const userFields = {};
    const userAllowed = actorRole === 'ADMIN' ? USER_FIELDS_ADMIN : USER_FIELDS_DOCTOR;
    for (const k of Object.keys(input)) {
      if (userAllowed.has(k)) userFields[k] = input[k];
    }

    if (Object.keys(profileFields).length === 0 && Object.keys(userFields).length === 0) {
      return res.status(400).send({ success: false, message: 'No valid fields to update.' });
    }

    // 3) Validate/normalize profile fields
    // license_no: only ADMIN + duplicate check
    if (Object.prototype.hasOwnProperty.call(profileFields, 'license_no')) {
      if (actorRole !== 'ADMIN') {
        return res.status(403).send({
          success: false,
          message: 'Only ADMIN can update the license number.'
        });
      }
      profileFields.license_no = String(profileFields.license_no).trim();
      const [dup] = await db.query(
        'SELECT user_id FROM doctor_profiles WHERE license_no = ? AND user_id <> ?',
        [profileFields.license_no, user_id]
      );
      if (dup.length > 0) {
        return res.status(409).send({
          success: false,
          message: 'This license number is already used by another doctor.'
        });
      }
    }

    // graduation_year: 4-digit or null
    if (Object.prototype.hasOwnProperty.call(profileFields, 'graduation_year')) {
      const gy = profileFields.graduation_year;
      if (gy === null || gy === '') {
        profileFields.graduation_year = null;
      } else if (!/^\d{4}$/.test(String(gy).trim())) {
        return res.status(400).send({
          success: false,
          message: 'graduation_year must be a 4-digit year.'
        });
      } else {
        profileFields.graduation_year = String(gy).trim();
      }
    }

    // hire_date: accept DD/MM/YYYY or YYYY-MM-DD
    if (Object.prototype.hasOwnProperty.call(profileFields, 'hire_date')) {
      const v = profileFields.hire_date;
      if (v === null || v === '') {
        profileFields.hire_date = null;
      } else {
        const parsed = dayjs(v, ['DD/MM/YYYY', 'YYYY-MM-DD'], true);
        if (!parsed.isValid()) {
          return res.status(400).send({
            success: false,
            message: 'Invalid hire_date format. Use DD/MM/YYYY or YYYY-MM-DD.'
          });
        }
        profileFields.hire_date = parsed.format('YYYY-MM-DD');
      }
    }

    // booleans -> 0/1
    if (Object.prototype.hasOwnProperty.call(profileFields, 'telehealth_enabled')) {
      profileFields.telehealth_enabled =
        profileFields.telehealth_enabled === true ||
        String(profileFields.telehealth_enabled).toLowerCase() === 'true'
          ? 1
          : 0;
    }
    if (Object.prototype.hasOwnProperty.call(profileFields, 'verified')) {
      profileFields.verified =
        profileFields.verified === true ||
        String(profileFields.verified).toLowerCase() === 'true'
          ? 1
          : 0;
    }

    // 4) Validate/normalize user fields
    if (Object.prototype.hasOwnProperty.call(userFields, 'email')) {
      if (actorRole !== 'ADMIN') {
        return res.status(403).send({ success: false, message: 'Only ADMIN can update email.' });
      }
      userFields.email = String(userFields.email || '').trim().toLowerCase();
      if (!userFields.email) {
        return res.status(400).send({ success: false, message: 'Email cannot be empty.' });
      }
      const [emailDup] = await db.query(
        'SELECT user_id FROM `user` WHERE email = ? AND user_id <> ?',
        [userFields.email, user_id]
      );
      if (emailDup.length > 0) {
        return res.status(409).send({ success: false, message: 'Email already exists.' });
      }
    }

    if (Object.prototype.hasOwnProperty.call(userFields, 'status')) {
      if (actorRole !== 'ADMIN') {
        return res.status(403).send({ success: false, message: 'Only ADMIN can update status.' });
      }
      const st = String(userFields.status || '').toUpperCase();
      if (!['ACTIVE', 'INACTIVE'].includes(st)) {
        return res.status(400).send({
          success: false,
          message: "status must be 'ACTIVE' or 'INACTIVE'."
        });
      }
      userFields.status = st;
    }

    if (Object.prototype.hasOwnProperty.call(userFields, 'password')) {
      const pwd = String(userFields.password || '');
      if (pwd.length < 6) {
        return res.status(400).send({
          success: false,
          message: 'Password must be at least 6 characters.'
        });
      }
      userFields.password_hash = await bcrypt.hash(pwd, 10);
      delete userFields.password; // never store raw password
    }

    // 5) Execute within a transaction
    conn = await db.getConnection();
    await conn.beginTransaction();

    // Update profile (if any fields)
    if (Object.keys(profileFields).length > 0) {
      const setClause = Object.keys(profileFields).map(k => `${k} = ?`).join(', ');
      const values = Object.values(profileFields);

      const [updP] = await conn.query(
        `UPDATE doctor_profiles SET ${setClause} WHERE user_id = ?`,
        [...values, user_id]
      );
      if (updP.affectedRows === 0) {
        // if trying to update profile that doesn't exist
        await conn.rollback();
        return res.status(404).send({
          success: false,
          message: 'Doctor profile not found.'
        });
      }
    }

    // Update user (if any fields)
    if (Object.keys(userFields).length > 0) {
      const setUser = Object.keys(userFields).map(k => {
        // map password_hash column name
        return `${k === 'password_hash' ? 'password_hash' : k} = ?`;
      }).join(', ');
      const valsUser = Object.values(userFields);

      await conn.query(
        `UPDATE \`user\` SET ${setUser}, updated_at = NOW() WHERE user_id = ?`,
        [...valsUser, user_id]
      );
    }

    await conn.commit();

    // 6) return updated combined data
    const [[userRow]] = await db.query(
      'SELECT user_id, full_name, email, phone, role, status, created_at, updated_at FROM `user` WHERE user_id = ?',
      [user_id]
    );
    const [[profileRow]] = await db.query(
      'SELECT * FROM doctor_profiles WHERE user_id = ?',
      [user_id]
    );

    return res.status(200).send({
      success: true,
      message: 'Doctor profile/user updated successfully.',
      data: {
        user: userRow,
        profile: profileRow ? {
          ...profileRow,
          hire_date: profileRow.hire_date ? dayjs(profileRow.hire_date).format('YYYY-MM-DD') : null,
          telehealth_enabled: !!profileRow.telehealth_enabled,
          verified: !!profileRow.verified
        } : null
      }
    });

  } catch (error) {
    if (conn) { try { await conn.rollback(); } catch (_) {} }
    console.error(error);
    return res.status(500).send({
      success: false,
      message: 'Error updating doctor profile/user.',
      error
    });
  } finally {
    if (conn) conn.release();
  }
};

//get all doctors
// Get All Doctors
const getAllDoctors = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        u.user_id,
        u.full_name,
        u.email,
        u.phone,
        u.role,
        u.status,
        dp.university_name,
        dp.graduation_year,
        dp.gender,
        dp.specialty,
        dp.license_no,
        dp.bio,
        dp.hire_date,
        dp.telehealth_enabled,
        dp.verified,
        dp.created_at,
        dp.updated_at
      FROM user u
      LEFT JOIN doctor_profiles dp ON u.user_id = dp.user_id
      WHERE u.role = 'DOCTOR' AND u.status = 'ACTIVE'
      ORDER BY u.created_at DESC
    `);

    if (rows.length === 0) {
      return res.status(404).send({
        success: false,
        message: 'No active doctors found.'
      });
    }

    // ✅ Format + normalize
    const formattedRows = rows.map(doc => ({
      ...doc,
      hire_date: doc.hire_date
        ? dayjs(doc.hire_date).format('YYYY-MM-DD')
        : null,
      telehealth_enabled: !!doc.telehealth_enabled,
      verified: !!doc.verified
    }));

    res.status(200).send({
      success: true,
      message: 'All active doctors retrieved successfully.',
      count: formattedRows.length,
      data: formattedRows
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({
      success: false,
      message: 'Error fetching doctors.',
      error
    });
  }
};


// Deactivate doctor: delete profile + set user.status = 'INACTIVE' (transactional)
const deactivateDoctor = async (req, res) => {
  const { user_id } = req.params;
  let conn;
  try {
    // 1) ensure user exists and is a DOCTOR
    const [[u]] = await db.query(
      'SELECT user_id, role, status FROM `user` WHERE user_id = ? LIMIT 1',
      [user_id]
    );
    if (!u) {
      return res.status(404).send({ success: false, message: 'User not found.' });
    }
    if (String(u.role || '').toUpperCase() !== 'DOCTOR') {
      return res.status(403).send({ success: false, message: 'Target user is not a DOCTOR.' });
    }

    // 2) begin transaction
    conn = await db.getConnection();
    await conn.beginTransaction();

    // 3) delete doctor profile (if exists)
    const [delProfile] = await conn.query(
      'DELETE FROM doctor_profiles WHERE user_id = ?',
      [user_id]
    );

    // 4) set user as INACTIVE
    const [updUser] = await conn.query(
      "UPDATE `user` SET status = 'INACTIVE', updated_at = NOW() WHERE user_id = ?",
      [user_id]
    );

    await conn.commit();

    return res.status(200).send({
      success: true,
      message: 'Doctor profile deleted and user set to INACTIVE.',
      meta: {
        profile_deleted_rows: delProfile.affectedRows,
        user_updated_rows: updUser.affectedRows,
        was_already_inactive: String(u.status || '').toUpperCase() === 'INACTIVE'
      }
    });
  } catch (error) {
    if (conn) {
      try { await conn.rollback(); } catch (_) {}
    }
    console.error(error);
    return res.status(500).send({
      success: false,
      message: 'Error deactivating doctor and deleting profile.',
      error
    });
  } finally {
    if (conn) conn.release();
  }
};




module.exports = { createDoctorProfile, updateDoctorProfile, getAllDoctors, deactivateDoctor };
