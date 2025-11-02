
const db = require('../config/db');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);

//  Book Consultation For Paitent //
const ACTIVE_PATIENT_STATUSES = ['ACTIVE'];
async function ensureUser(id, role, mustBeActive = true) {
  const [[u]] = await db.query(
    'SELECT user_id, role, status FROM `user` WHERE user_id = ? LIMIT 1',
    [id]
  );
  if (!u) return { ok: false, code: 404, msg: 'User not found.' };
  if (String(u.role || '').toUpperCase() !== role.toUpperCase())
    return { ok: false, code: 403, msg: `Target user is not a ${role}.` };
  if (mustBeActive && !ACTIVE_PATIENT_STATUSES.includes(String(u.status || '').toUpperCase()))
    return { ok: false, code: 403, msg: `User is not ACTIVE.` };
  return { ok: true, user: u };
}
const ALLOWED_STATUSES_FOR_CONFLICT = ['PENDING', 'CONFIRMED', 'IN_PROGRESS'];
const bookConsultation = async (req, res) => {
  let conn;
  try {
    const actor = req.user || {};
    const actorRole = String(actor.role || '').trim().toUpperCase();
    const actorId = String(actor.id || '');

    const { slot_id, mode = 'VIDEO', low_bandwidth = 0 } = req.body || {};
    const slotId = slot_id;
    if (!slotId) {
      return res.status(400).json({ success: false, message: 'slot_id is required.' });
    }

    // حدد الـ patient
    let patientId;
    if (actorRole === 'PATIENT') {
      patientId = actorId;
    } else if (actorRole === 'ADMIN') {
      const { patient_id } = req.body || {};
      if (!patient_id) {
        return res.status(400).json({ success: false, message: 'patient_id is required for admin booking.' });
      }
      patientId = String(patient_id);
    } else {
      return res.status(403).json({ success: false, message: 'Only PATIENT or ADMIN can book a consultation.' });
    }

    // تأكد أن المستخدم فعلاً مريض وفعّال
    const okPatient = await ensureUser(patientId, 'PATIENT', true);
    if (!okPatient.ok) {
      return res.status(okPatient.code).json({ success: false, message: okPatient.msg });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    // جبنا السلوْت بقفل
    const [slotRows] = await conn.query(
      'SELECT * FROM availability_slots WHERE id = ? FOR UPDATE',
      [slotId]
    );
    if (slotRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Slot not found.' });
    }
    const slot = slotRows[0];

    // لو السلوْت محجوز، انتهى
    if (Number(slot.is_booked) === 1) {
      await conn.rollback();
      return res.status(409).json({ success: false, message: 'Slot already booked.' });
    }

    // لا تسمح بحجز سلوْت منتهي
    const [[nowRow]] = await conn.query('SELECT NOW() AS nowts');
    const now = new Date(nowRow.nowts);
    if (new Date(slot.end_at) <= now) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Cannot book past slots.' });
    }

    // تأكد أن الطبيب فعّال
    const okDoctor = await ensureUser(slot.doctor_id, 'DOCTOR', true);
    if (!okDoctor.ok) {
      await conn.rollback();
      return res.status(okDoctor.code).json({ success: false, message: okDoctor.msg });
    }

    // 🔐 منطق التعارض على مستوى السلوْت:
    // بما أننا لا نضع is_booked=1 أثناء الـ PENDING، نسمح بوجود عدة PENDING لنفس السلوْت.
    // لكن لو يوجد استشارة CONFIRMED أو IN_PROGRESS لنفس السلوْت، نمنع الحجز.
    const SLOT_HARD_CONFLICT_STATUSES = ['CONFIRMED', 'IN_PROGRESS'];
    const [slotHardBusy] = await conn.query(
      `SELECT id FROM consultations
        WHERE slot_id = ?
          AND status IN (${SLOT_HARD_CONFLICT_STATUSES.map(() => '?').join(',')})
        LIMIT 1`,
      [slotId, ...SLOT_HARD_CONFLICT_STATUSES]
    );
    if (slotHardBusy.length > 0) {
      await conn.rollback();
      return res.status(409).json({
        success: false,
        message: 'This slot is already reserved by a confirmed/ongoing consultation.'
      });
    }

    // 👤 منطق التعارض لذات المريض: منع تقاطع حجوزاته (PENDING/CONFIRMED/IN_PROGRESS)
    const PATIENT_CONFLICT_STATUSES = ['PENDING', 'CONFIRMED', 'IN_PROGRESS'];
    const [conflicts] = await conn.query(
      `SELECT c.id
         FROM consultations c
         JOIN availability_slots s ON s.id = c.slot_id
        WHERE c.patient_id = ?
          AND c.status IN (${PATIENT_CONFLICT_STATUSES.map(() => '?').join(',')})
          AND s.start_at < ?
          AND s.end_at   > ?
        LIMIT 1`,
      [patientId, ...PATIENT_CONFLICT_STATUSES, slot.end_at, slot.start_at]
    );
    if (conflicts.length > 0) {
      await conn.rollback();
      return res.status(409).json({
        success: false,
        message: 'You already have a consultation overlapping this time.'
      });
    }

    // sanitize المدخلات
    const sanitizedMode = ['VIDEO', 'AUDIO', 'ASYNC_MSG'].includes(String(mode).toUpperCase())
      ? String(mode).toUpperCase()
      : 'VIDEO';
    const lbFlag = (low_bandwidth === true || String(low_bandwidth).toLowerCase() === 'true') ? 1 : 0;

    // أنشئ الاستشارة بحالة PENDING، ولا تغيّر is_booked (تبقى 0)
    const [ins] = await conn.query(
      `INSERT INTO consultations
        (patient_id, doctor_id, slot_id, status, created_at, mode, low_bandwidth, updated_at)
       VALUES (?, ?, ?, 'PENDING', NOW(), ?, ?, NOW())`,
      [patientId, slot.doctor_id, slotId, sanitizedMode, lbFlag]
    );

    await conn.commit();

    // إرجاع بيانات الاستشارة
    const [[consult]] = await db.query(
      `SELECT c.*, u.full_name AS patient_name, d.full_name AS doctor_name, s.start_at, s.end_at
         FROM consultations c
         JOIN \`user\` u ON u.user_id = c.patient_id
         JOIN \`user\` d ON d.user_id = c.doctor_id
         JOIN availability_slots s ON s.id = c.slot_id
        WHERE c.id = ?`,
      [ins.insertId]
    );

    return res.status(201).json({
      success: true,
      message: 'Consultation booked successfully (PENDING).',
      data: consult
    });

  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (_) { } }
    console.error(err);
    return res.status(500).json({ success: false, message: 'Error booking consultation.', error: err });
  } finally {
    if (conn) conn.release();
  }
};
///////////////////////

// Delete Booking //
const deleteConsultation = async (req, res) => {
  let conn;
  try {
    const { consultation_id } = req.params;
    const actor = req.user || {};
    const actorRole = String(actor.role || '').trim().toUpperCase();
    const actorId = String(actor.id || '');

    // جلب الموعد + رقم السلوُت المرتبط فيه
    const [[consult]] = await db.query(
      `SELECT id, patient_id, slot_id, status
         FROM consultations
        WHERE id = ?`,
      [consultation_id]
    );

    if (!consult) {
      return res.status(404).json({
        success: false,
        message: 'Consultation not found.'
      });
    }

    // المريض فقط يحذف مواعيده ويشترط PENDING
    if (actorRole === 'PATIENT') {
      if (actorId !== String(consult.patient_id)) {
        return res.status(403).json({
          success: false,
          message: 'You can only delete your own consultation.'
        });
      }

      if (consult.status !== 'PENDING') {
        return res.status(400).json({
          success: false,
          message: 'Only PENDING consultations can be deleted by the patient.'
        });
      }
    }

    // ✅ إذا وصلنا لهون → يا إما المريض يملك الحق أو المستخدِم هو ADMIN

    conn = await db.getConnection();
    await conn.beginTransaction();

    // حذف الموعد
    await conn.query(
      'DELETE FROM consultations WHERE id = ?',
      [consultation_id]
    );

    // إرجاع السلوُت غير محجوز
    await conn.query(
      `UPDATE availability_slots 
          SET is_booked = 0
        WHERE id = ?`,
      [consult.slot_id]
    );

    await conn.commit();

    return res.status(200).json({
      success: true,
      message: actorRole === 'ADMIN'
        ? 'Consultation deleted successfully by admin.'
        : 'Consultation deleted successfully.'
    });

  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (_) { } }
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Error deleting consultation.',
      error: err
    });
  } finally {
    if (conn) conn.release();
  }
};
////////////////////
// view consultation //;
const ALLOWED_STATUSES = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const ALLOWED_MODES = ['VIDEO', 'AUDIO', 'ASYNC_MSG'];
const ALLOWED_GENDERS = ['M', 'F'];
const ALLOWED_SORT_BY = {
  start_at: 's.start_at',
  created_at: 'c.created_at',
  status: 'c.status',
  doctor_name: 'd.full_name'
};

function parseMulti(str) {
  return String(str)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

function parseBool(v) {
  if (typeof v === 'boolean') return v;
  const s = String(v).toLowerCase();
  return s === '1' || s === 'true' || s === 'yes';
}

const listMyConsultations = async (req, res) => {
  try {
    const actor = req.user || {};
    const patientId = String(actor.id || '');

    let {
      status,
      specialty,
      gender,
      mode,
      low_bandwidth,
      from,
      to,
      only_future = '0',
      min_duration,
      max_duration,
      q,
      sort_by = 'start_at',
      sort_dir = 'desc',
      limit = '100',
      offset = '0'
    } = req.query;

    limit = Math.min(parseInt(limit, 10) || 100, 500);
    offset = Math.max(parseInt(offset, 10) || 0, 0);
    only_future = String(only_future) === '1';

    const whereParts = ['c.patient_id = ?'];
    const params = [patientId];

    if (status) {
      const statuses = parseMulti(status).map(s => s.toUpperCase());
      for (const st of statuses) {
        if (!ALLOWED_STATUSES.includes(st)) {
          return res.status(400).json({
            success: false,
            message: `Invalid status value: ${st}. Allowed: ${ALLOWED_STATUSES.join(', ')}`
          });
        }
      }
      whereParts.push(`c.status IN (${statuses.map(() => '?').join(',')})`);
      params.push(...statuses);
    }

    if (mode) {
      const modes = parseMulti(mode).map(m => m.toUpperCase());
      for (const m of modes) {
        if (!ALLOWED_MODES.includes(m)) {
          return res.status(400).json({
            success: false,
            message: `Invalid mode value: ${m}. Allowed: ${ALLOWED_MODES.join(', ')}`
          });
        }
      }
      whereParts.push(`c.mode IN (${modes.map(() => '?').join(',')})`);
      params.push(...modes);
    }
    if (typeof low_bandwidth !== 'undefined') {
      whereParts.push('c.low_bandwidth = ?');
      params.push(parseBool(low_bandwidth) ? 1 : 0);
    }

    if (specialty) {
      const specs = parseMulti(specialty);

      whereParts.push(`COALESCE(dp.specialty,'') IN (${specs.map(() => '?').join(',')})`);
      params.push(...specs);
    }

    if (gender) {
      const g = String(gender).toUpperCase();
      if (!ALLOWED_GENDERS.includes(g)) {
        return res.status(400).json({
          success: false,
          message: `Invalid gender value. Allowed: ${ALLOWED_GENDERS.join(', ')}`
        });
      }
      whereParts.push('dp.gender = ?');
      params.push(g);
    }

    if (from) {
      const f = dayjs(from, ['YYYY-MM-DD'], true);
      if (!f.isValid()) {
        return res.status(400).json({ success: false, message: 'Invalid from date. Use YYYY-MM-DD' });
      }
      whereParts.push('s.end_at >= ?');
      params.push(f.startOf('day').format('YYYY-MM-DD HH:mm:ss'));
    }

    if (to) {
      const t = dayjs(to, ['YYYY-MM-DD'], true);
      if (!t.isValid()) {
        return res.status(400).json({ success: false, message: 'Invalid to date. Use YYYY-MM-DD' });
      }
      whereParts.push('s.start_at <= ?');
      params.push(t.endOf('day').format('YYYY-MM-DD HH:mm:ss'));
    }

    if (only_future) {
      whereParts.push('s.end_at >= NOW()');
    }

    if (min_duration) {
      const md = parseInt(min_duration, 10);
      if (!Number.isFinite(md) || md < 0) {
        return res.status(400).json({ success: false, message: 'min_duration must be a positive integer.' });
      }
      whereParts.push('TIMESTAMPDIFF(MINUTE, s.start_at, s.end_at) >= ?');
      params.push(md);
    }

    if (max_duration) {
      const md = parseInt(max_duration, 10);
      if (!Number.isFinite(md) || md < 0) {
        return res.status(400).json({ success: false, message: 'max_duration must be a positive integer.' });
      }
      whereParts.push('TIMESTAMPDIFF(MINUTE, s.start_at, s.end_at) <= ?');
      params.push(md);
    }

    if (q) {
      const like = `%${q.trim()}%`;
      whereParts.push('(d.full_name LIKE ? OR d.email LIKE ? OR COALESCE(dp.specialty, \'\') LIKE ?)');
      params.push(like, like, like);
    }

    const where = `WHERE ${whereParts.join(' AND ')}`;

    const sortCol = ALLOWED_SORT_BY[String(sort_by)] || ALLOWED_SORT_BY.start_at;
    const sortDir = String(sort_dir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const [rows] = await db.query(
      `SELECT
         c.id                  AS consultation_id,
         c.status,
         c.mode,
         c.low_bandwidth,
         c.created_at,
         c.updated_at,
         s.id                  AS slot_id,
         s.start_at,
         s.end_at,
         TIMESTAMPDIFF(MINUTE, s.start_at, s.end_at) AS duration_minutes,
         d.user_id             AS doctor_id,
         d.full_name           AS doctor_name,
         d.email               AS doctor_email,
         COALESCE(dp.specialty,'') AS specialty,
         dp.gender
       FROM consultations c
       JOIN availability_slots s ON s.id = c.slot_id
       JOIN \`user\` d            ON d.user_id = c.doctor_id
       LEFT JOIN doctor_profiles dp ON dp.user_id = d.user_id
       ${where}
       ORDER BY ${sortCol} ${sortDir}
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
    return res.status(500).json({
      success: false,
      message: 'Error fetching patient consultations.',
      error: err
    });
  }
};
////////////////////

// view all Consultations for admin //
const listConsultationsForAdmin = async (req, res) => {
  try {
    const actorRole = String(req.user?.role || '').toUpperCase();
    if (actorRole !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Access denied: admin only.' });
    }

    let {
      status,
      specialty,
      gender,
      mode,
      low_bandwidth,
      from,
      to,
      only_future = '0',
      min_duration,
      max_duration,
      q,
      sort_by = 'start_at',
      sort_dir = 'desc',
      limit = '100',
      offset = '0'
    } = req.query;

    limit = Math.min(parseInt(limit, 10) || 100, 500);
    offset = Math.max(parseInt(offset, 10) || 0, 0);
    only_future = String(only_future) === '1';

    const whereParts = ['1=1'];
    const params = [];

    if (status) {
      const statuses = parseMulti(status).map(s => s.toUpperCase());
      for (const st of statuses) {
        if (!ALLOWED_STATUSES.includes(st)) {
          return res.status(400).json({ success: false, message: `Invalid status: ${st}` });
        }
      }
      whereParts.push(`c.status IN (${statuses.map(() => '?').join(',')})`);
      params.push(...statuses);
    }

    if (specialty) {
      const specs = parseMulti(specialty);
      whereParts.push(`COALESCE(dp.specialty,'') IN (${specs.map(() => '?').join(',')})`);
      params.push(...specs);
    }

    if (gender) {
      const g = gender.toUpperCase();
      if (!ALLOWED_GENDERS.includes(g)) {
        return res.status(400).json({ success: false, message: `Invalid gender` });
      }
      whereParts.push('dp.gender = ?');
      params.push(g);
    }
    if (mode) {
      const modes = parseMulti(mode).map(m => m.toUpperCase());
      for (const m of modes) {
        if (!ALLOWED_MODES.includes(m)) {
          return res.status(400).json({ success: false, message: `Invalid mode: ${m}` });
        }
      }
      whereParts.push(`c.mode IN (${modes.map(() => '?').join(',')})`);
      params.push(...modes);
    }

    if (low_bandwidth !== undefined) {
      whereParts.push(`c.low_bandwidth = ?`);
      params.push(parseBool(low_bandwidth) ? 1 : 0);
    }

    if (from) {
      const f = dayjs(from, ['YYYY-MM-DD'], true);
      if (!f.isValid()) return res.status(400).json({ message: 'Invalid from date.' });
      whereParts.push('s.end_at >= ?');
      params.push(f.startOf('day').format('YYYY-MM-DD HH:mm:ss'));
    }

    if (to) {
      const t = dayjs(to, ['YYYY-MM-DD'], true);
      if (!t.isValid()) return res.status(400).json({ message: 'Invalid to date.' });
      whereParts.push('s.start_at <= ?');
      params.push(t.endOf('day').format('YYYY-MM-DD HH:mm:ss'));
    }

    if (only_future) {
      whereParts.push('s.end_at >= NOW()');
    }

    if (min_duration) {
      whereParts.push('TIMESTAMPDIFF(MINUTE, s.start_at, s.end_at) >= ?');
      params.push(parseInt(min_duration, 10));
    }
    if (max_duration) {
      whereParts.push('TIMESTAMPDIFF(MINUTE, s.start_at, s.end_at) <= ?');
      params.push(parseInt(max_duration, 10));
    }

    if (q) {
      const like = `%${q}%`;
      whereParts.push('(d.full_name LIKE ? OR p.full_name LIKE ? OR COALESCE(dp.specialty,"") LIKE ?)');
      params.push(like, like, like);
    }

    const sortCol = ALLOWED_SORT_BY[sort_by] || ALLOWED_SORT_BY.start_at;
    const sortDir = sort_dir.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const where = `WHERE ${whereParts.join(' AND ')}`;

    const [rows] = await db.query(
      `SELECT
         c.id AS consultation_id,
         c.status,
         c.mode,
         c.low_bandwidth,
         c.created_at,
         c.updated_at,
         s.start_at,
         s.end_at,
         TIMESTAMPDIFF(MINUTE, s.start_at, s.end_at) AS duration_minutes,
         p.user_id AS patient_id,
         p.full_name AS patient_name,
         p.email AS patient_email,
         d.user_id AS doctor_id,
         d.full_name AS doctor_name,
         COALESCE(dp.specialty,'') AS specialty,
         dp.gender
       FROM consultations c
       JOIN availability_slots s ON s.id = c.slot_id
       JOIN \`user\` p ON p.user_id = c.patient_id
       JOIN \`user\` d ON d.user_id = c.doctor_id
       LEFT JOIN doctor_profiles dp ON dp.user_id = d.user_id
       ${where}
       ORDER BY ${sortCol} ${sortDir}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return res.status(200).json({ success: true, count: rows.length, data: rows });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Error fetching consultations', error: err });
  }
};
///////////////////

// Update Pending Consultation For Paitent //
const updatePendingConsultation = async (req, res) => {
  try {
    const { consultation_id } = req.params;
    const { mode, low_bandwidth } = req.body || {};
    const actor = req.user || {};
    const actorRole = String(actor.role || '').trim().toUpperCase();
    const actorId = String(actor.id || '');
    const [[consult]] = await db.query(
      `SELECT id, patient_id, status
         FROM consultations
        WHERE id = ?`,
      [consultation_id]
    );

    if (!consult) {
      return res.status(404).json({
        success: false,
        message: 'Consultation not found.'
      });
    }
    if (actorRole !== 'PATIENT' || actorId !== String(consult.patient_id)) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own consultation.'
      });
    }
    if (consult.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'Only PENDING consultations can be updated.'
      });
    }
    let updateFields = [];
    let params = [];

    if (mode) {
      const allowedModes = ['VIDEO', 'AUDIO', 'ASYNC_MSG'];
      const newMode = String(mode).toUpperCase();
      if (!allowedModes.includes(newMode)) {
        return res.status(400).json({
          success: false,
          message: "Invalid mode. Must be one of 'VIDEO', 'AUDIO', or 'ASYNC_MSG'."
        });
      }
      updateFields.push('mode = ?');
      params.push(newMode);
    }

    if (typeof low_bandwidth !== 'undefined') {
      const lb = (low_bandwidth === true || String(low_bandwidth).toLowerCase() === 'true') ? 1 : 0;
      updateFields.push('low_bandwidth = ?');
      params.push(lb);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update. Only mode and low_bandwidth are allowed.'
      });
    }

    updateFields.push('updated_at = NOW()');
    const query = `UPDATE consultations SET ${updateFields.join(', ')} WHERE id = ?`;
    params.push(consultation_id);

    await db.query(query, params);

    return res.status(200).json({
      success: true,
      message: 'Consultation updated successfully.'
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Error updating consultation.',
      error: err
    });
  }
};
//////////////////

// List of Doctor Consultations//
const listDoctorConsultations = async (req, res) => {
  try {
    const actor = req.user || {};
    const role = String(actor.role || '').toUpperCase();
    const doctorId = String(actor.id || '');

    if (role !== 'DOCTOR') {
      return res.status(403).json({ success: false, message: 'Doctors only.' });
    }

    let {
      status,
      mode,
      low_bandwidth,
      from,
      to,
      q,
      min_duration,
      max_duration,
      limit = '100',
      offset = '0',
      only_future = '1'
    } = req.query;

    limit = Math.min(parseInt(limit, 10) || 100, 500);
    offset = Math.max(parseInt(offset, 10) || 0, 0);
    only_future = String(only_future) === '0' ? 0 : 1;

    const whereParts = ['c.doctor_id = ?'];
    const params = [doctorId];

    if (only_future) {
      whereParts.push('s.end_at >= NOW()');
    }

    if (status) {
      const statuses = status.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
      const allowed = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
      for (const st of statuses) {
        if (!allowed.includes(st)) {
          return res.status(400).json({ success: false, message: `Invalid status: ${st}` });
        }
      }
      whereParts.push(`c.status IN (${statuses.map(() => '?').join(',')})`);
      params.push(...statuses);
    }

    if (mode) {
      const modes = mode.split(',').map(m => m.trim().toUpperCase()).filter(Boolean);
      const allowedModes = ['VIDEO', 'AUDIO', 'ASYNC_MSG'];
      for (const m of modes) {
        if (!allowedModes.includes(m)) {
          return res.status(400).json({ success: false, message: `Invalid mode: ${m}` });
        }
      }
      whereParts.push(`c.mode IN (${modes.map(() => '?').join(',')})`);
      params.push(...modes);
    }

    if (typeof low_bandwidth !== 'undefined') {
      const lb = (low_bandwidth === '1' || low_bandwidth === 'true' || low_bandwidth === true) ? 1 : 0;
      whereParts.push('c.low_bandwidth = ?');
      params.push(lb);
    }

    if (from) {
      const f = dayjs(from, ['YYYY-MM-DD'], true);
      if (!f.isValid()) return res.status(400).json({ success: false, message: 'Invalid from date' });
      whereParts.push('s.end_at >= ?');
      params.push(f.startOf('day').format('YYYY-MM-DD HH:mm:ss'));
    }

    if (to) {
      const t = dayjs(to, ['YYYY-MM-DD'], true);
      if (!t.isValid()) return res.status(400).json({ success: false, message: 'Invalid to date' });
      whereParts.push('s.start_at <= ?');
      params.push(t.endOf('day').format('YYYY-MM-DD HH:mm:ss'));
    }

    if (min_duration) {
      whereParts.push('TIMESTAMPDIFF(MINUTE, s.start_at, s.end_at) >= ?');
      params.push(Number(min_duration));
    }

    if (max_duration) {
      whereParts.push('TIMESTAMPDIFF(MINUTE, s.start_at, s.end_at) <= ?');
      params.push(Number(max_duration));
    }

    if (q) {
      whereParts.push('(p.full_name LIKE ? OR p.email LIKE ?)');
      params.push(`%${q}%`, `%${q}%`);
    }

    const where = `WHERE ${whereParts.join(' AND ')}`;

    const [rows] = await db.query(
      `SELECT
         c.id          AS consultation_id,
         c.status,
         c.mode,
         c.low_bandwidth,
         c.created_at,
         c.updated_at,
         s.id          AS slot_id,
         s.start_at,
         s.end_at,
         TIMESTAMPDIFF(MINUTE, s.start_at, s.end_at) AS duration_minutes,
         p.user_id     AS patient_id,
         p.full_name   AS patient_name,
         p.email       AS patient_email
       FROM consultations c
       JOIN availability_slots s ON s.id = c.slot_id
       JOIN \`user\` p ON p.user_id = c.patient_id
       ${where}
       ORDER BY s.start_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return res.status(200).json({ success: true, count: rows.length, data: rows });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Error fetching doctor consultations.', error: err });
  }
};

// Update By Doctor
const updateConsultationStatusByDoctor = async (req, res) => {
  let conn;
  try {
    const { consultation_id } = req.params;
    const { status } = req.body || {};

    const actor = req.user || {};
    const actorRole = String(actor.role || '').trim().toUpperCase();
    const actorId = String(actor.id || '');

    if (actorRole !== 'DOCTOR') {
      return res.status(403).json({
        success: false,
        message: 'Only doctors can update consultation status.'
      });
    }

    const allowedStatuses = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
    const newStatus = String(status || '').toUpperCase();

    if (!allowedStatuses.includes(newStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value. Must be one of: PENDING, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED.'
      });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    const [[consult]] = await conn.query(
      `SELECT c.id, c.doctor_id, c.status, c.slot_id, s.is_booked
         FROM consultations c
         JOIN availability_slots s ON s.id = c.slot_id
        WHERE c.id = ? FOR UPDATE`,
      [consultation_id]
    );

    if (!consult) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Consultation not found.' });
    }

    if (String(consult.doctor_id) !== actorId) {
      await conn.rollback();
      return res.status(403).json({
        success: false,
        message: 'You can only update consultations assigned to you.'
      });
    }

    const invalidTransitions = {
      COMPLETED: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'],
      CANCELLED: ['PENDING', 'CONFIRMED', 'IN_PROGRESS']
    };
    if (invalidTransitions[consult.status] && invalidTransitions[consult.status].includes(newStatus)) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: `Cannot change status from ${consult.status} back to ${newStatus}.`
      });
    }

    await conn.query(
      `UPDATE consultations 
          SET status = ?, updated_at = NOW()
        WHERE id = ?`,
      [newStatus, consultation_id]
    );

    let canceledOthers = 0;

    if (newStatus === 'CONFIRMED') {
      await conn.query(
        `UPDATE availability_slots 
            SET is_booked = 1
          WHERE id = ?`,
        [consult.slot_id]
      );

      const [cancelRes] = await conn.query(
        `UPDATE consultations
            SET status = 'CANCELLED', updated_at = NOW()
          WHERE slot_id = ?
            AND id <> ?
            AND status IN ('PENDING')`,
        [consult.slot_id, consultation_id]
      );
      canceledOthers = cancelRes?.affectedRows || 0;
    } else if (newStatus === 'CANCELLED') {
      await conn.query(
        `UPDATE availability_slots 
            SET is_booked = 0
          WHERE id = ?`,
        [consult.slot_id]
      );
    }

    await conn.commit();

    return res.status(200).json({
      success: true,
      message: `Consultation status updated to ${newStatus}.`,
      data: {
        consultation_id,
        new_status: newStatus,
        slot_id: consult.slot_id,
        is_booked: newStatus === 'CONFIRMED' ? 1 : newStatus === 'CANCELLED' ? 0 : consult.is_booked
      },
      meta: {
        cancelled_other_pending_for_same_slot: canceledOthers
      }
    });

  } catch (err) {
    if (conn) await conn.rollback();
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Error updating consultation status.',
      error: err
    });
  } finally {
    if (conn) conn.release();
  }
};

//Update By Admin
const updateConsultationByAdmin = async (req, res) => {
  let conn;
  try {
    const actorRole = String(req.user?.role || '').toUpperCase();
    if (actorRole !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Admins only.' });
    }

    const { consultation_id } = req.params;
    const { status, mode, low_bandwidth } = req.body || {};

    const updates = [];
    const params = [];

    let newStatus = null;
    if (typeof status !== 'undefined') {
      const s = String(status).toUpperCase();
      if (!ALLOWED_STATUSES.includes(s)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}`
        });
      }
      newStatus = s;
      updates.push('status = ?');
      params.push(newStatus);
    }

    if (typeof mode !== 'undefined') {
      const m = String(mode).toUpperCase();
      if (!ALLOWED_MODES.includes(m)) {
        return res.status(400).json({
          success: false,
          message: `Invalid mode. Allowed: ${ALLOWED_MODES.join(', ')}`
        });
      }
      updates.push('mode = ?');
      params.push(m);
    }

    if (typeof low_bandwidth !== 'undefined') {
      const lb = (low_bandwidth === true || String(low_bandwidth).toLowerCase() === 'true' || String(low_bandwidth) === '1') ? 1 : 0;
      updates.push('low_bandwidth = ?');
      params.push(lb);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update. Allowed: status, mode, low_bandwidth'
      });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    const [[consult]] = await conn.query(
      `SELECT c.id, c.status, c.slot_id, c.patient_id, c.doctor_id,
              s.is_booked, s.start_at, s.end_at
         FROM consultations c
         JOIN availability_slots s ON s.id = c.slot_id
        WHERE c.id = ? FOR UPDATE`,
      [consultation_id]
    );

    if (!consult) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Consultation not found.' });
    }

    if (newStatus) {
      const invalidTransitions = {
        COMPLETED: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'],
        CANCELLED: ['PENDING', 'CONFIRMED', 'IN_PROGRESS']
      };
      if (invalidTransitions[consult.status]?.includes(newStatus)) {
        await conn.rollback();
        return res.status(400).json({
          success: false,
          message: `Cannot change status from ${consult.status} back to ${newStatus}.`
        });
      }
    }

    updates.push('updated_at = NOW()');
    const sql = `UPDATE consultations SET ${updates.join(', ')} WHERE id = ?`;
    params.push(consultation_id);
    await conn.query(sql, params);

    let newIsBooked = consult.is_booked;
    let canceledOthers = 0;

    if (newStatus === 'CONFIRMED') {
      await conn.query(`UPDATE availability_slots SET is_booked = 1 WHERE id = ?`, [consult.slot_id]);
      newIsBooked = 1;

      const [cancelRes] = await conn.query(
        `UPDATE consultations
            SET status = 'CANCELLED', updated_at = NOW()
          WHERE slot_id = ?
            AND id <> ?
            AND status IN ('PENDING')`,
        [consult.slot_id, consultation_id]
      );
      canceledOthers = cancelRes?.affectedRows || 0;
    } else if (newStatus === 'CANCELLED') {
      await conn.query(`UPDATE availability_slots SET is_booked = 0 WHERE id = ?`, [consult.slot_id]);
      newIsBooked = 0;
    }

    await conn.commit();

    return res.status(200).json({
      success: true,
      message: 'Consultation updated by admin.',
      data: {
        consultation_id,
        status: newStatus ?? consult.status,
        slot_id: consult.slot_id,
        is_booked: newIsBooked
      },
      meta: {
        cancelled_other_pending_for_same_slot: canceledOthers
      }
    });

  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (_) { } }
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Error updating consultation by admin.',
      error: err
    });
  } finally {
    if (conn) conn.release();
  }
};

//msgs
const listConsultationMessages = async (req, res) => {
  const { consultation_id } = req.params;
  const authUser = req.user || {};
  const authId = String(authUser.id || '');
  const role = String(authUser.role || '').toUpperCase();

  try {
    const [cRows] = await db.query(
      `SELECT id, patient_id, doctor_id, status
       FROM consultations
       WHERE id = ?`,
      [consultation_id]
    );

    if (cRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Consultation not found' });
    }

    const { patient_id, doctor_id } = cRows[0];

    if (role !== 'ADMIN') {
      const isPatient = role === 'PATIENT' && String(patient_id) === authId;
      const isDoctor  = role === 'DOCTOR'  && String(doctor_id)  === authId;
      if (!isPatient && !isDoctor) {
        return res.status(403).json({ success: false, message: 'Forbidden: not a participant' });
      }
    }

    let { limit = '200', offset = '0' } = req.query;
    limit  = Math.min(Math.max(parseInt(limit, 10)  || 50,  1),  500);
    offset = Math.max(parseInt(offset, 10) || 0, 0);

    const [rows] = await db.query(
      `SELECT id,
              consultation_id,
              sender_id,
              text_original,
              text_translated,
              lang_from,
              lang_to,
              created_at
       FROM messages
       WHERE consultation_id = ?
       ORDER BY id ASC
       LIMIT ? OFFSET ?`,
      [consultation_id, limit, offset]
    );

    res.status(200).json({
      success: true,
      count: rows.length,
      consultation_id,
      messages: rows
    });
  } catch (err) {
    console.error('messages fetch error:', err);
    res.status(500).json({ success: false, message: 'Failed to load messages' });
  }
};
/////////////////
module.exports = {
  bookConsultation, deleteConsultation,
  listMyConsultations, listConsultationsForAdmin,
  updatePendingConsultation,
  listDoctorConsultations,
  updateConsultationStatusByDoctor,
  updateConsultationByAdmin ,listConsultationMessages
}