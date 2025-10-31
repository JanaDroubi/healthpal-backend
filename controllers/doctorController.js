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

//get doctor by id
const getDoctorById = async (req, res) => {
  try {
    const { user_id } = req.params;

    const actor = req.user || {};
    const actorRole = String(actor.role || '').trim().toUpperCase();
    const actorId = String(actor.id || '');

    if (actorRole === 'DOCTOR' && actorId !== String(user_id)) {
      return res.status(403).send({
        success: false,
        message: 'Doctors can only view their own profile.'
      });
    }

    const [rows] = await db.query(
      `
      SELECT 
        u.user_id,
        u.full_name,
        u.email,
        u.phone,
        u.status,
        u.role,
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
      FROM \`user\` u
      LEFT JOIN doctor_profiles dp ON u.user_id = dp.user_id
      WHERE u.user_id = ? AND u.role = 'DOCTOR' AND u.status = 'ACTIVE'
      `,
      [user_id]
    );

    if (rows.length === 0) {
      return res.status(404).send({
        success: false,
        message: 'Doctor not found.'
      });
    }

    const doc = rows[0];

    
    doc.telehealth_enabled = !!doc.telehealth_enabled;
    doc.verified = !!doc.verified;
    doc.hire_date = doc.hire_date ? dayjs(doc.hire_date).format('YYYY-MM-DD') : null;

    return res.status(200).send({
      success: true,
      message: 'Doctor profile retrieved successfully.',
      data: doc
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send({
      success: false,
      message: 'Error fetching doctor profile.',
      error
    });
  }
};

//////////////////////////// feature one //////////////////////////////


// ===== helpers =====
function parseDateTime(input) {
  // نقبل: "YYYY-MM-DD HH:mm" أو "YYYY-MM-DDTHH:mm" أو ISO
  const formats = ['YYYY-MM-DD HH:mm', 'YYYY-MM-DDTHH:mm', dayjs.ISO_8601];
  for (const f of formats) {
    const d = dayjs(input, f, true);
    if (d.isValid()) return d;
  }
  return dayjs.invalid();
}

async function ensureDoctorActive(doctorId) {
  const [[row]] = await db.query(
    'SELECT user_id, role, status FROM `user` WHERE user_id = ? LIMIT 1',
    [doctorId]
  );
  if (!row) return { ok: false, code: 404, msg: 'Doctor user not found.' };
  if (String(row.role || '').toUpperCase() !== 'DOCTOR')
    return { ok: false, code: 403, msg: 'Target user is not a DOCTOR.' };
  if (String(row.status || '').toUpperCase() !== 'ACTIVE')
    return { ok: false, code: 403, msg: 'Doctor is not ACTIVE.' };
  return { ok: true };
}

// Add availability slot
const createAvailabilitySlot = async (req, res) => {
  try {
    const { doctor_id } = req.params;

    const actor = req.user || {};
    const actorRole = String(actor.role || '').trim().toUpperCase();
    const actorId = String(actor.id || '');

    if (actorRole === 'DOCTOR' && actorId !== String(doctor_id)) {
      return res.status(403).json({
        success: false,
        message: 'Doctors can only add their own availability.'
      });
    }

    const okDoc = await ensureDoctorActive(doctor_id);
    if (!okDoc.ok) return res.status(okDoc.code).json({ success: false, message: okDoc.msg });

    const { start_at, end_at } = req.body || {};
    const start = parseDateTime(start_at);
    const end   = parseDateTime(end_at);

    if (!start.isValid() || !end.isValid()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid datetime format. Use YYYY-MM-DD HH:mm (24h) or ISO.'
      });
    }
    if (!start.isBefore(end)) {
      return res.status(400).json({
        success: false,
        message: 'start_at must be before end_at.'
      });
    }

    if (start.isBefore(dayjs())) {
      return res.status(400).json({
        success: false,
        message: 'start_at must be in the future.'
      });
    }

    const [overlap] = await db.query(
      `SELECT id FROM availability_slots
       WHERE doctor_id = ?
         AND start_at < ?
         AND end_at   > ?
       LIMIT 1`,
      [
        doctor_id,
        end.format('YYYY-MM-DD HH:mm:ss'),
        start.format('YYYY-MM-DD HH:mm:ss')
      ]
    );
    if (overlap.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'This slot overlaps an existing availability.'
      });
    }

    const [ins] = await db.query(
      `INSERT INTO availability_slots (doctor_id, start_at, end_at, is_booked)
       VALUES (?, ?, ?, 0)`,
      [
        doctor_id,
        start.format('YYYY-MM-DD HH:mm:ss'),
        end.format('YYYY-MM-DD HH:mm:ss')
      ]
    );

    const [[row]] = await db.query('SELECT * FROM availability_slots WHERE id = ?', [ins.insertId]);

    return res.status(201).json({
      success: true,
      message: 'Availability slot created.',
      data: row
    });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Exact same slot already exists for this doctor.'
      });
    }
    console.error(err);
    return res.status(500).json({ success: false, message: 'Error creating availability slot.', error: err });
  }
};


// list of availability slot for a doctor
const listAvailabilityForDoctor = async (req, res) => {
  try {
    const { doctor_id } = req.params;

    // التحقق من صاحب التوكن
    const actor = req.user || {};
    const actorRole = String(actor.role || '').trim().toUpperCase();
    const actorId = String(actor.id || '');

    if (actorRole === 'DOCTOR' && actorId !== String(doctor_id)) {
      return res.status(403).json({ success: false, message: 'Doctors can only view their own availability.' });
    }

    // تأكد الطبيب موجود و ACTIVE
    const okDoc = await ensureDoctorActive(doctor_id);
    if (!okDoc.ok) return res.status(okDoc.code).json({ success: false, message: okDoc.msg });

    // فلاتر اختيارية
    const { from, to } = req.query;
    let limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
    let offset = Math.max(parseInt(req.query.offset || '0', 10), 0);

    let where = 'a.doctor_id = ?';
    const params = [doctor_id];

    if (from) {
      const f = dayjs(from, ['YYYY-MM-DD', dayjs.ISO_8601], true);
      if (!f.isValid()) return res.status(400).json({ success: false, message: 'Invalid from date.' });
      // أي فتحة تمتد بعد بداية المدى
      where += ' AND a.end_at >= ?';
      params.push(f.startOf('day').format('YYYY-MM-DD HH:mm:ss'));
    }

    if (to) {
      const t = dayjs(to, ['YYYY-MM-DD', dayjs.ISO_8601], true);
      if (!t.isValid()) return res.status(400).json({ success: false, message: 'Invalid to date.' });
      // أي فتحة تبدأ قبل نهاية المدى
      where += ' AND a.start_at <= ?';
      params.push(t.endOf('day').format('YYYY-MM-DD HH:mm:ss'));
    }

    const [rows] = await db.query(
      `SELECT 
         a.id, a.doctor_id, a.start_at, a.end_at, a.is_booked,
         u.full_name AS doctor_name, u.email AS doctor_email
       FROM availability_slots a
       JOIN \`user\` u ON u.user_id = a.doctor_id
       WHERE ${where}
       ORDER BY a.start_at ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Error fetching availability.', error: err });
  }
};

// list of availability slot for all doctor
const listAllAvailability = async (req, res) => {
  try {
    const actor = req.user || {};
    const actorRole = String(actor.role || '').trim().toUpperCase();

    if (actorRole !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Admins only.' });
    }

    const { doctor_id, from, to } = req.query;
    let limit = Math.min(parseInt(req.query.limit || '200', 10), 1000);
    let offset = Math.max(parseInt(req.query.offset || '0', 10), 0);

    const whereParts = ['u.role = "DOCTOR"']; // نضمن إنها دكاترة
    const params = [];

    if (doctor_id) {
      whereParts.push('a.doctor_id = ?');
      params.push(doctor_id);
    }

    if (from) {
      const f = dayjs(from, ['YYYY-MM-DD', dayjs.ISO_8601], true);
      if (!f.isValid()) return res.status(400).json({ success: false, message: 'Invalid from date.' });
      whereParts.push('a.end_at >= ?');
      params.push(f.startOf('day').format('YYYY-MM-DD HH:mm:ss'));
    }

    if (to) {
      const t = dayjs(to, ['YYYY-MM-DD', dayjs.ISO_8601], true);
      if (!t.isValid()) return res.status(400).json({ success: false, message: 'Invalid to date.' });
      whereParts.push('a.start_at <= ?');
      params.push(t.endOf('day').format('YYYY-MM-DD HH:mm:ss'));
    }

    const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const [rows] = await db.query(
      `SELECT 
         a.id, a.doctor_id, a.start_at, a.end_at, a.is_booked,
         u.full_name AS doctor_name, u.email AS doctor_email, u.status AS doctor_status
       FROM availability_slots a
       JOIN \`user\` u ON u.user_id = a.doctor_id
       ${where}
       ORDER BY a.start_at ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Error fetching availability (admin).', error: err });
  }
};

// DELETE slot
const deleteAvailabilitySlot = async (req, res) => {
  try {
    const { doctor_id, slot_id } = req.params;
    const actor = req.user || {};
    const actorRole = String(actor.role || '').trim().toUpperCase();
    const actorId = String(actor.id || '');

    if (actorRole === 'DOCTOR' && actorId !== String(doctor_id)) {
      return res.status(403).json({
        success: false,
        message: 'Doctors can only delete their own slots.'
      });
    }

    const [[slot]] = await db.query(
      'SELECT * FROM availability_slots WHERE id = ? AND doctor_id = ?',
      [slot_id, doctor_id]
    );

    if (!slot) {
      return res.status(404).json({
        success: false,
        message: 'Slot not found for this doctor.'
      });
    }

    if (slot.is_booked !== 0) {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete this slot because it is already booked.'
      });
    }

    const [del] = await db.query(
      'DELETE FROM availability_slots WHERE id = ?',
      [slot_id]
    );

    if (del.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Slot not found or already deleted.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Availability slot deleted successfully.'
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Error deleting availability slot.',
      error: err
    });
  }
};

//update slot
const updateAvailabilitySlot = async (req, res) => {
  let conn;
  try {
    const { doctor_id, slot_id } = req.params;
    const actor = req.user || {};
    const actorRole = String(actor.role || '').trim().toUpperCase();
    const actorId = String(actor.id || '');

    const { start_at, end_at, is_booked } = req.body || {};

    // require at least one field to update
    if (typeof start_at === 'undefined' && typeof end_at === 'undefined' && typeof is_booked === 'undefined') {
      return res.status(400).json({
        success: false,
        message: 'No fields to update. Provide start_at and/or end_at (and admins may set is_booked).'
      });
    }

    // doctors cannot change is_booked
    if (actorRole === 'DOCTOR' && typeof is_booked !== 'undefined') {
      return res.status(403).json({
        success: false,
        message: 'Doctors are not allowed to change is_booked.'
      });
    }

    // doctor may only operate on his own doctor_id
    if (actorRole === 'DOCTOR' && actorId !== String(doctor_id)) {
      return res.status(403).json({
        success: false,
        message: 'Doctors can only update their own slots.'
      });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    // lock and fetch current slot
    const [slotRows] = await conn.query(
      'SELECT * FROM availability_slots WHERE id = ? FOR UPDATE',
      [slot_id]
    );
    if (slotRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Slot not found.' });
    }
    const slot = slotRows[0];

    // ensure slot belongs to provided doctor_id
    if (String(slot.doctor_id) !== String(doctor_id)) {
      await conn.rollback();
      return res.status(403).json({ success: false, message: 'Slot does not belong to this doctor.' });
    }

    // if actor is DOCTOR ensure slot not booked
    if (actorRole === 'DOCTOR' && Number(slot.is_booked) === 1) {
      await conn.rollback();
      return res.status(403).json({ success: false, message: 'Cannot modify a booked slot.' });
    }

    // parse and validate new start/end times (if provided), otherwise use existing
    let newStart = slot.start_at ? dayjs(slot.start_at) : null;
    let newEnd = slot.end_at ? dayjs(slot.end_at) : null;

    if (typeof start_at !== 'undefined' && start_at !== null && start_at !== '') {
      const p = dayjs(start_at, ['YYYY-MM-DD HH:mm', 'YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD'], true);
      if (!p.isValid()) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'Invalid start_at format. Use YYYY-MM-DD HH:mm or YYYY-MM-DD HH:mm:ss.' });
      }
      newStart = p;
    }

    if (typeof end_at !== 'undefined' && end_at !== null && end_at !== '') {
      const p = dayjs(end_at, ['YYYY-MM-DD HH:mm', 'YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD'], true);
      if (!p.isValid()) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'Invalid end_at format. Use YYYY-MM-DD HH:mm or YYYY-MM-DD HH:mm:ss.' });
      }
      newEnd = p;
    }

    // require both start and end (either existing or provided)
    if (!newStart || !newEnd) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: 'Both start_at and end_at must be present (either existing or in request body).'
      });
    }

    // ensure start < end
    if (!newStart.isBefore(newEnd)) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: 'start_at must be before end_at.'
      });
    }

    // do not allow slot entirely in the past
    const [[nowRow]] = await conn.query('SELECT NOW() AS nowts');
    const now = dayjs(nowRow.nowts);
    if (newEnd.isBefore(now)) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: 'Cannot set slot entirely in the past.'
      });
    }

    // check overlap with other slots for same doctor (exclude current slot)
    const [overlap] = await conn.query(
      `SELECT id FROM availability_slots
         WHERE doctor_id = ?
           AND id <> ?
           AND start_at < ?
           AND end_at   > ?
         LIMIT 1`,
      [doctor_id, slot_id, newEnd.format('YYYY-MM-DD HH:mm:ss'), newStart.format('YYYY-MM-DD HH:mm:ss')]
    );
    if (overlap.length > 0) {
      await conn.rollback();
      return res.status(409).json({
        success: false,
        message: 'New time overlaps with another availability slot for this doctor.'
      });
    }

    // build update fields
    const updates = [];
    const params = [];

    updates.push('start_at = ?');
    params.push(newStart.format('YYYY-MM-DD HH:mm:ss'));

    updates.push('end_at = ?');
    params.push(newEnd.format('YYYY-MM-DD HH:mm:ss'));

    // admin may change is_booked if provided
    let willSetIsBooked = null; // null = not provided, otherwise 0/1
    if (actorRole === 'ADMIN' && typeof is_booked !== 'undefined') {
      const ib = (is_booked === true || String(is_booked).toLowerCase() === 'true' || String(is_booked) === '1') ? 1 : 0;
      updates.push('is_booked = ?');
      params.push(ib);
      willSetIsBooked = ib;
    }


    params.push(slot_id);

    // perform the update
    const sql = `UPDATE availability_slots SET ${updates.join(', ')} WHERE id = ?`;
    const [updResult] = await conn.query(sql, params);

    // default canceled count
    let canceledCount = 0;

    // If admin explicitly changed is_booked from 1 -> 0, cancel related consultations
    if (actorRole === 'ADMIN' && willSetIsBooked !== null) {
      const prevBooked = Number(slot.is_booked) === 1;
      const newBooked = willSetIsBooked === 1;

      if (prevBooked && !newBooked) {
        // cancel consultations in  CONFIRMED
        const [cancelRes] = await conn.query(
          `UPDATE consultations
             SET status = 'CANCELLED'
           WHERE slot_id = ?
             AND status IN ('CONFIRMED')`,
          [slot_id]
        );
        // mysql returns affectedRows in OkPacket
        canceledCount = cancelRes && (cancelRes.affectedRows || 0);
      }
    }

    // fetch updated slot
    const [[updatedRow]] = await conn.query('SELECT * FROM availability_slots WHERE id = ?', [slot_id]);

    await conn.commit();

    return res.status(200).json({
      success: true,
      message: 'Slot updated successfully.',
      data: updatedRow,
      meta: {
        canceled_consultations: canceledCount
      }
    });
  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (_) {} }
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Error updating slot.',
      error: err
    });
  } finally {
    if (conn) conn.release();
  }
};

//////////////////////////// end feature one //////////////////////////////


module.exports = { createDoctorProfile, updateDoctorProfile, 
  getAllDoctors, deactivateDoctor , getDoctorById,createAvailabilitySlot, 
  listAvailabilityForDoctor , listAllAvailability , deleteAvailabilitySlot ,
updateAvailabilitySlot};
