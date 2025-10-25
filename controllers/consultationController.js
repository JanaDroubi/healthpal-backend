
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

    const okPatient = await ensureUser(patientId, 'PATIENT', true);
    if (!okPatient.ok) {
      return res.status(okPatient.code).json({ success: false, message: okPatient.msg });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    const [slotRows] = await conn.query(
      'SELECT * FROM availability_slots WHERE id = ? FOR UPDATE',
      [slotId]
    );
    if (slotRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Slot not found.' });
    }
    const slot = slotRows[0];

    if (slot.is_booked) {
      await conn.rollback();
      return res.status(409).json({ success: false, message: 'Slot already booked.' });
    }

    const [[nowRow]] = await conn.query('SELECT NOW() AS nowts');
    const now = new Date(nowRow.nowts);
    if (new Date(slot.end_at) <= now) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Cannot book past slots.' });
    }

    const okDoctor = await ensureUser(slot.doctor_id, 'DOCTOR', true);
    if (!okDoctor.ok) {
      await conn.rollback();
      return res.status(okDoctor.code).json({ success: false, message: okDoctor.msg });
    }

    const [slotBusy] = await conn.query(
      `SELECT id FROM consultations
        WHERE slot_id = ? AND status IN (${ALLOWED_STATUSES_FOR_CONFLICT.map(() => '?').join(',')})
        LIMIT 1`,
      [slotId, ...ALLOWED_STATUSES_FOR_CONFLICT]
    );
    if (slotBusy.length > 0) {
      await conn.rollback();
      return res.status(409).json({
        success: false,
        message: 'This slot already has a pending/active consultation.'
      });
    }


    const [conflicts] = await conn.query(
      `SELECT c.id
         FROM consultations c
         JOIN availability_slots s ON s.id = c.slot_id
        WHERE c.patient_id = ?
          AND c.status IN (${ALLOWED_STATUSES_FOR_CONFLICT.map(() => '?').join(',')})
          AND s.start_at < ?
          AND s.end_at   > ?
        LIMIT 1`,
      [patientId, ...ALLOWED_STATUSES_FOR_CONFLICT, slot.end_at, slot.start_at]
    );
    if (conflicts.length > 0) {
      await conn.rollback();
      return res.status(409).json({
        success: false,
        message: 'You already have a consultation overlapping this time.'
      });
    }

    const sanitizedMode = ['VIDEO', 'AUDIO', 'ASYNC_MSG'].includes(String(mode).toUpperCase())
      ? String(mode).toUpperCase()
      : 'VIDEO';
    const lbFlag = (low_bandwidth === true || String(low_bandwidth).toLowerCase() === 'true') ? 1 : 0;

    const [ins] = await conn.query(
      `INSERT INTO consultations
        (patient_id, doctor_id, slot_id, status, created_at, mode, low_bandwidth, updated_at)
       VALUES (?, ?, ?, 'PENDING', NOW(), ?, ?, NOW())`,
      [patientId, slot.doctor_id, slotId, sanitizedMode, lbFlag]
    );

    await conn.commit();

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
        message: 'You can only delete your own consultation.'
      });
    }

    if (consult.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'Only PENDING consultations can be deleted.'
      });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();


    const [del] = await conn.query(
      'DELETE FROM consultations WHERE id = ? AND status = "PENDING"',
      [consultation_id]
    );

    await conn.commit();

    if (del.affectedRows === 0) {
      return res.status(409).json({
        success: false,
        message: 'Consultation already updated or deleted.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Consultation deleted successfully.'
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

// view consultation //
const listMyConsultations = async (req, res) => {
  try {
    const actor = req.user || {};
    const patientId = String(actor.id || '');

    let { status, from, to, limit = '100', offset = '0' } = req.query;
    limit = Math.min(parseInt(limit, 10) || 100, 500);
    offset = Math.max(parseInt(offset, 10) || 0, 0);

    const whereParts = ['c.patient_id = ?'];
    const params = [patientId];

    if (status) {
      const st = String(status).toUpperCase();
      const allowed = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
      if (!allowed.includes(st)) {
        return res.status(400).json({ success: false, message: 'Invalid status filter.' });
      }
      whereParts.push('c.status = ?');
      params.push(st);
    }

    if (from) {
      const f = dayjs(from, ['YYYY-MM-DD'], true);
      if (!f.isValid()) return res.status(400).json({ success: false, message: 'Invalid from date.' });
      whereParts.push('s.end_at >= ?');
      params.push(f.startOf('day').format('YYYY-MM-DD HH:mm:ss'));
    }

    if (to) {
      const t = dayjs(to, ['YYYY-MM-DD'], true);
      if (!t.isValid()) return res.status(400).json({ success: false, message: 'Invalid to date.' });
      whereParts.push('s.start_at <= ?');
      params.push(t.endOf('day').format('YYYY-MM-DD HH:mm:ss'));
    }

    const where = `WHERE ${whereParts.join(' AND ')}`;

    const [rows] = await db.query(
      `SELECT
         c.id                AS consultation_id,
         c.status,
         c.mode,
         c.low_bandwidth,
         c.created_at,
         c.updated_at,
         s.id                AS slot_id,
         s.start_at,
         s.end_at,
         TIMESTAMPDIFF(MINUTE, s.start_at, s.end_at) AS duration_minutes,
         d.user_id           AS doctor_id,
         d.full_name         AS doctor_name,
         d.email             AS doctor_email,
         dp.specialty,
         dp.gender
       FROM consultations c
       JOIN availability_slots s ON s.id = c.slot_id
       JOIN \`user\` d            ON d.user_id = c.doctor_id
       LEFT JOIN doctor_profiles dp ON dp.user_id = d.user_id
       ${where}
       ORDER BY s.start_at DESC
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
    const actor = req.user || {};
    const actorRole = String(actor.role || '').trim().toUpperCase();
    if (actorRole !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Access denied: only admin allowed.' });
    }

    let { status, from, to, limit = '100', offset = '0' } = req.query;
    limit = Math.min(parseInt(limit, 10) || 100, 500);
    offset = Math.max(parseInt(offset, 10) || 0, 0);

    const whereParts = ['1=1'];
    const params = [];

    if (status) {
      const st = String(status).toUpperCase();
      const allowed = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
      if (!allowed.includes(st)) {
        return res.status(400).json({ success: false, message: 'Invalid status filter.' });
      }
      whereParts.push('c.status = ?');
      params.push(st);
    }

    if (from) {
      const f = dayjs(from, ['YYYY-MM-DD'], true);
      if (!f.isValid()) return res.status(400).json({ success: false, message: 'Invalid from date.' });
      whereParts.push('s.end_at >= ?');
      params.push(f.startOf('day').format('YYYY-MM-DD HH:mm:ss'));
    }

    if (to) {
      const t = dayjs(to, ['YYYY-MM-DD'], true);
      if (!t.isValid()) return res.status(400).json({ success: false, message: 'Invalid to date.' });
      whereParts.push('s.start_at <= ?');
      params.push(t.endOf('day').format('YYYY-MM-DD HH:mm:ss'));
    }

    const where = `WHERE ${whereParts.join(' AND ')}`;

    const [rows] = await db.query(
      `SELECT
         c.id              AS consultation_id,
         c.status,
         c.mode,
         c.low_bandwidth,
         c.created_at,
         c.updated_at,
         s.start_at,
         s.end_at,
         p.user_id         AS patient_id,
         p.full_name       AS patient_name,
         p.email           AS patient_email,
         d.user_id         AS doctor_id,
         d.full_name       AS doctor_name,
         dp.specialty,
         dp.gender
       FROM consultations c
       JOIN availability_slots s ON s.id = c.slot_id
       JOIN \`user\` p ON p.user_id = c.patient_id
       JOIN \`user\` d ON d.user_id = c.doctor_id
       LEFT JOIN doctor_profiles dp ON dp.user_id = d.user_id
       ${where}
       ORDER BY s.start_at DESC
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
      message: 'Error fetching all consultations for admin.',
      error: err
    });
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

    let { status, from, to, limit = '100', offset = '0', only_future = '1' } = req.query;
    limit  = Math.min(parseInt(limit, 10) || 100, 500);
    offset = Math.max(parseInt(offset, 10) || 0, 0);
    only_future = String(only_future) === '0' ? 0 : 1;

    const whereParts = ['c.doctor_id = ?'];
    const params = [doctorId];

    if (only_future) {
      whereParts.push('s.end_at >= NOW()');
    }

    if (status) {
      const st = String(status).toUpperCase();
      const allowed = ['PENDING','CONFIRMED','IN_PROGRESS','COMPLETED','CANCELLED'];
      if (!allowed.includes(st)) {
        return res.status(400).json({ success: false, message: 'Invalid status filter.' });
      }
      whereParts.push('c.status = ?');
      params.push(st);
    }

    if (from) {
      const f = dayjs(from, ['YYYY-MM-DD'], true);
      if (!f.isValid()) return res.status(400).json({ success: false, message: 'Invalid from date.' });
      whereParts.push('s.end_at >= ?');
      params.push(f.startOf('day').format('YYYY-MM-DD HH:mm:ss'));
    }

    if (to) {
      const t = dayjs(to, ['YYYY-MM-DD'], true);
      if (!t.isValid()) return res.status(400).json({ success: false, message: 'Invalid to date.' });
      whereParts.push('s.start_at <= ?');
      params.push(t.endOf('day').format('YYYY-MM-DD HH:mm:ss'));
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
       JOIN \`user\` p            ON p.user_id = c.patient_id
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

// Update 
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

    const allowedStatuses = ['PENDING','CONFIRMED','IN_PROGRESS','COMPLETED','CANCELLED'];
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
      COMPLETED: ['PENDING','CONFIRMED','IN_PROGRESS'],
      CANCELLED: ['PENDING','CONFIRMED','IN_PROGRESS']
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

  
    if (newStatus === 'CONFIRMED') {
      await conn.query(
        `UPDATE availability_slots 
            SET is_booked = 1
          WHERE id = ?`,
        [consult.slot_id]
      );
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


/////////////////
module.exports = {
  bookConsultation, deleteConsultation,
  listMyConsultations, listConsultationsForAdmin,
  updatePendingConsultation,
  listDoctorConsultations,
  updateConsultationStatusByDoctor
}