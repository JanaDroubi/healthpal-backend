// controllers/therapyController.js
const db = require('../config/db');
const dayjs = require('dayjs');

const { translateText } = require('../services/translationService');
const parseDateTime = (s) => dayjs(s, ['YYYY-MM-DD HH:mm', dayjs.ISO_8601], true);

async function ensureTherapistActive(therapistId) {
  const [[u]] = await db.query(
    `SELECT user_id, role, status FROM \`user\` WHERE user_id=? LIMIT 1`,
    [therapistId]
  );
  if (!u) return { ok: false, code: 404, msg: 'Therapist not found' };
  if (u.role !== 'THERAPIST')
    return { ok: false, code: 400, msg: 'User is not a THERAPIST' };
  if (u.status && u.status !== 'ACTIVE')
    return { ok: false, code: 403, msg: 'Therapist account is not ACTIVE' };
  return { ok: true };
}
// create therapy slot
const createTherapyAvailabilitySlot = async (req, res) => {
  try {
    const { therapist_id } = req.params;

    const actor = req.user || {};
    const actorRole = String(actor.role || '').trim().toUpperCase();
    const actorId = String(actor.id || '');
    if (actorRole === 'THERAPIST' && actorId !== String(therapist_id)) {
      return res.status(403).json({
        success: false,
        message: 'Therapists can only add their own availability.'
      });
    }

    const okTh = await ensureTherapistActive(therapist_id);
    if (!okTh.ok) return res.status(okTh.code).json({ success: false, message: okTh.msg });

    const { start_at, end_at } = req.body || {};
    const start = parseDateTime(start_at);
    const end = parseDateTime(end_at);

    if (!start.isValid() || !end.isValid()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid datetime format. Use YYYY-MM-DD HH:mm (24h) or ISO.'
      });
    }
    if (!start.isBefore(end)) {
      return res.status(400).json({ success: false, message: 'start_at must be before end_at.' });
    }
    if (start.isBefore(dayjs())) {
      return res.status(400).json({ success: false, message: 'start_at must be in the future.' });
    }

    const [overlap] = await db.query(
      `SELECT id FROM availability_slots
         WHERE doctor_id = ?
           AND start_at < ?
           AND end_at   > ?
         LIMIT 1`,
      [
        therapist_id,
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
        therapist_id,
        start.format('YYYY-MM-DD HH:mm:ss'),
        end.format('YYYY-MM-DD HH:mm:ss')
      ]
    );

    const [[row]] = await db.query(
      'SELECT * FROM availability_slots WHERE id = ?',
      [ins.insertId]
    );

    return res.status(201).json({
      success: true,
      message: 'Therapy availability slot created.',
      data: row
    });

  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Exact same slot already exists for this therapist.'
      });
    }
    console.error(err);
    return res.status(500).json({ success: false, message: 'Error creating therapy availability slot.' });
  }
};

// view therapy slot (own therapist view)
const listAvailabilityForTherapist = async (req, res) => {
  try {
    const { therapist_id } = req.params;
    const actor = req.user || {};
    const role = String(actor.role || '').toUpperCase();
    const uid = String(actor.id || '');

    if (role === 'THERAPIST' && uid !== String(therapist_id)) {
      return res.status(403).json({ success: false, message: 'Therapists can only view their own availability.' });
    }

    const okTh = await ensureTherapistActive(therapist_id);
    if (!okTh.ok) return res.status(okTh.code).json({ success: false, message: okTh.msg });

    const { from, to, includeBooked, futureOnly } = req.query;
    let limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
    let offset = Math.max(parseInt(req.query.offset || '0', 10), 0);

    const where = ['a.doctor_id = ?'];
    const params = [therapist_id];

    const onlyFuture = String(futureOnly || '1') === '1';

    if (typeof includeBooked !== 'undefined' && String(includeBooked).toLowerCase() !== 'all') {
      if (String(includeBooked) === '0') {
        where.push('a.is_booked = 0');
      } else if (String(includeBooked) === '1') {
        where.push('a.is_booked = 1');
      }
    }

    if (onlyFuture) where.push('a.end_at >= NOW()');

    if (from) {
      const f = dayjs(from, ['YYYY-MM-DD', dayjs.ISO_8601], true);
      if (!f.isValid()) return res.status(400).json({ success: false, message: 'Invalid from date.' });
      where.push('a.end_at >= ?'); params.push(f.startOf('day').format('YYYY-MM-DD HH:mm:ss'));
    }
    if (to) {
      const t = dayjs(to, ['YYYY-MM-DD', dayjs.ISO_8601], true);
      if (!t.isValid()) return res.status(400).json({ success: false, message: 'Invalid to date.' });
      where.push('a.start_at <= ?'); params.push(t.endOf('day').format('YYYY-MM-DD HH:mm:ss'));
    }

    const sql = `
      SELECT a.id, a.doctor_id AS therapist_id, a.start_at, a.end_at, a.is_booked,
             u.full_name AS therapist_name, u.email AS therapist_email
      FROM availability_slots a
      JOIN \`user\` u ON u.user_id = a.doctor_id
      WHERE ${where.join(' AND ')}
      ORDER BY a.start_at ASC
      LIMIT ? OFFSET ?`;
    const [rows] = await db.query(sql, [...params, limit, offset]);

    res.json({
      success: true,
      count: rows.length,
      data: rows,
      meta: {
        therapist_id,
        limit, offset,
        includeBooked: typeof includeBooked === 'undefined' ? 'all' : String(includeBooked),
        futureOnly: onlyFuture,
        from: from || null, to: to || null
      }
    });
  } catch (e) {
    console.error('listAvailabilityForTherapist:', e);
    res.status(500).json({ success: false, message: 'Error fetching availability.' });
  }
};


// view all therapy slots (directory for patients/admin)
const listAllTherapyAvailability = async (req, res) => {
  try {
    const { from, to, therapistId, name, includeBooked, futureOnly } = req.query;

    let limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
    let offset = Math.max(parseInt(req.query.offset || '0', 10), 0);

    const where = [
      "u.role = 'THERAPIST'",
      "u.status = 'ACTIVE'"
    ];
    const params = [];

    const onlyFuture = String(futureOnly || '1') === '1';

    if (typeof includeBooked !== 'undefined' && String(includeBooked).toLowerCase() !== 'all') {
      if (String(includeBooked) === '0') {
        where.push('a.is_booked = 0');
      } else if (String(includeBooked) === '1') {
        where.push('a.is_booked = 1');
      }
    }

    if (onlyFuture) where.push('a.end_at >= NOW()');
    if (therapistId) { where.push('a.doctor_id = ?'); params.push(Number(therapistId)); }
    if (name) { where.push('u.full_name LIKE ?'); params.push(`%${name}%`); }

    if (from) {
      const f = dayjs(from, ['YYYY-MM-DD', dayjs.ISO_8601], true);
      if (!f.isValid()) return res.status(400).json({ success: false, message: 'Invalid from date.' });
      where.push('a.end_at >= ?'); params.push(f.startOf('day').format('YYYY-MM-DD HH:mm:ss'));
    }
    if (to) {
      const t = dayjs(to, ['YYYY-MM-DD', dayjs.ISO_8601], true);
      if (!t.isValid()) return res.status(400).json({ success: false, message: 'Invalid to date.' });
      where.push('a.start_at <= ?'); params.push(t.endOf('day').format('YYYY-MM-DD HH:mm:ss'));
    }

    const sql = `
      SELECT
        a.id        AS slot_id,
        a.doctor_id AS therapist_id,
        u.full_name AS therapist_name,
        u.email     AS therapist_email,
        a.start_at, a.end_at, a.is_booked
      FROM availability_slots a
      JOIN \`user\` u ON u.user_id = a.doctor_id
      WHERE ${where.join(' AND ')}
      ORDER BY a.start_at ASC
      LIMIT ? OFFSET ?`;

    const [rows] = await db.query(sql, [...params, limit, offset]);

    res.json({
      success: true,
      count: rows.length,
      data: rows,
      meta: {
        limit, offset,
        includeBooked: typeof includeBooked === 'undefined' ? 'all' : String(includeBooked),
        futureOnly: onlyFuture,
        from: from || null, to: to || null,
        therapistId: therapistId || null, name: name || null
      }
    });
  } catch (e) {
    console.error('listAllTherapyAvailability:', e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};



// delete therapy slot
const deleteTherapyAvailabilitySlot = async (req, res) => {
  try {
    const { therapist_id, slot_id } = req.params;

    const actor = req.user || {};
    const actorRole = String(actor.role || '').trim().toUpperCase();
    const actorId = String(actor.id || '');

    if (actorRole === 'THERAPIST' && actorId !== String(therapist_id)) {
      return res.status(403).json({
        success: false,
        message: 'Therapists can only delete their own slots.'
      });
    }

    const okTh = await ensureTherapistActive(therapist_id);
    if (!okTh.ok) return res.status(okTh.code).json({ success: false, message: okTh.msg });

    const [[slot]] = await db.query(
      'SELECT * FROM availability_slots WHERE id = ? AND doctor_id = ?',
      [slot_id, therapist_id]
    );
    if (!slot) {
      return res.status(404).json({ success: false, message: 'Slot not found for this therapist.' });
    }

    if (Number(slot.is_booked) !== 0) {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete this slot because it is already booked.'
      });
    }

    const [del] = await db.query('DELETE FROM availability_slots WHERE id = ?', [slot_id]);
    if (del.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Slot not found or already deleted.' });
    }

    return res.status(200).json({ success: true, message: 'Therapy availability slot deleted successfully.' });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Error deleting therapy slot.', error: err });
  }
};


// Book Therapy Slot

function normMode(m) {
  const v = String(m || '').toUpperCase();

  // Convert ASYNC_MSG → CHAT (client mapping)
  if (v === 'ASYNC_MSG') return 'CHAT';

  const allowed = ['VIDEO', 'AUDIO', 'CHAT'];
  return allowed.includes(v) ? v : null;
}

const bookTherapySlot = async (req, res) => {
  let conn;
  try {
    const { therapist_id, slot_id } = req.params;
    const actor = req.user || {};
    const role = String(actor.role || '').toUpperCase();
    const actorId = Number(actor.id);

    // Therapist must exist & active
    const okTh = await ensureTherapistActive(therapist_id);
    if (!okTh.ok) return res.status(okTh.code).json({ success:false, message: okTh.msg });

    const mode = normMode(req.body?.mode);
    const anonymous = (req.body?.anonymous === true || String(req.body?.anonymous) === '1') ? 1 : 0;
    const notes = (req.body?.notes || '').toString().slice(0, 500).trim();

    if (!mode)
      return res.status(400).json({ success:false, message:'mode must be one of VIDEO, AUDIO, CHAT' });

    if (anonymous === 1 && mode !== 'CHAT')
      return res.status(400).json({ success:false, message:'Anonymous sessions must use CHAT mode.' });

    // Who is the patient?
    let patientId = null;
    const bookedBy = actorId;

    if (anonymous === 0) {
      if (role === 'PATIENT') {
        patientId = actorId;
      } else if (role === 'ADMIN') {
        const pid = Number(req.body?.patient_id || 0);
        if (!pid)
          return res.status(400).json({ success:false, message:'patient_id is required for ADMIN (non-anonymous).' });

        const [[p]] = await db.query(
          'SELECT user_id FROM patient_profiles WHERE user_id=? LIMIT 1',
          [pid]
        );
        if (!p)
          return res.status(404).json({ success:false, message:'Patient profile not found.' });

        patientId = pid;
      } else {
        return res.status(403).json({ success:false, message:'Only PATIENT or ADMIN can book non-anonymous sessions.' });
      }
    } else {
      if (role !== 'PATIENT' && role !== 'ADMIN')
        return res.status(403).json({ success:false, message:'Only PATIENT or ADMIN can book anonymous sessions.' });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    // Check slot availability
    const [rows] = await conn.query(
      `SELECT id, doctor_id, start_at, end_at, is_booked
       FROM availability_slots
       WHERE id=? AND doctor_id=?
       FOR UPDATE`,
      [slot_id, therapist_id]
    );
    const slot = rows[0];

    if (!slot) {
      await conn.rollback();
      return res.status(404).json({ success:false, message:'Slot not found for this therapist.' });
    }

    if (Number(slot.is_booked) === 1) {
      await conn.rollback();
      return res.status(409).json({ success:false, message:'This slot is already booked.' });
    }

    if (new Date(slot.end_at) <= new Date()) {
      await conn.rollback();
      return res.status(400).json({ success:false, message:'Cannot book a slot in the past.' });
    }

    // Prevent double booking
    if (anonymous === 0 && patientId) {
      const [dup] = await conn.query(
        `SELECT id FROM therapy_sessions
         WHERE slot_id=? AND patient_id=?
           AND status IN ('PENDING','CONFIRMED','IN_PROGRESS')
         LIMIT 1`,
        [slot.id, patientId]
      );
      if (dup.length) {
        await conn.rollback();
        return res.status(409).json({ success:false, message:'You already have a booking for this slot.' });
      }
    } else {
      const [dupA] = await conn.query(
        `SELECT id FROM therapy_sessions
         WHERE slot_id=? AND anonymous=1 AND booked_by=?
           AND status IN ('PENDING','CONFIRMED','IN_PROGRESS')
         LIMIT 1`,
        [slot.id, bookedBy]
      );
      if (dupA.length) {
        await conn.rollback();
        return res.status(409).json({ success:false, message:'You already have an anonymous booking for this slot.' });
      }
    }

    // INSERT session (according to DB structure)
    const [ins] = await conn.query(
      `INSERT INTO therapy_sessions
       (patient_id, therapist_id, slot_id, mode, scheduled_at, status, anonymous, notes, booked_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, NOW(), NOW())`,
      [
        patientId,
        therapist_id,
        slot.id,
        mode,              // must be VIDEO / AUDIO / CHAT
        slot.start_at,
        anonymous,
        notes || `slot:${slot.id}`,
        bookedBy
      ]
    );

    // Mark slot as booked
    const [upd] = await conn.query(
      `UPDATE availability_slots
       SET is_booked=1
       WHERE id=? AND is_booked=0`,
      [slot.id]
    );

    if (upd.affectedRows !== 1) {
      await conn.rollback();
      return res.status(409).json({ success:false, message:'Slot just got booked by someone else.' });
    }

    await conn.commit();

    res.set('Location', `/api/therapy/sessions/${ins.insertId}`);

    return res.status(201).json({
      success: true,
      message: 'Therapy session request created (PENDING).',
      data: {
        session_id: ins.insertId,
        therapist_id: Number(therapist_id),
        slot_id: slot.id,
        patient_id: patientId ?? null,
        scheduled_at: slot.start_at,
        mode,
        anonymous: !!anonymous,
        status: 'PENDING'
      }
    });

  } catch (err) {
    if (conn) try { await conn.rollback(); } catch { }
    console.error('bookTherapySlot error:', err?.sqlMessage || err);
    return res.status(500).json({ success:false, message:'Server error' });
  } finally {
    if (conn) conn.release();
  }
};




// Update Therapy Availability Slot

const updateTherapyAvailabilitySlot = async (req, res) => {
  let conn;
  try {
    const { therapist_id, slot_id } = req.params;
    const actor = req.user || {};
    const actorRole = String(actor.role || '').trim().toUpperCase();
    const actorId = String(actor.id || '');

    const { start_at, end_at, is_booked } = req.body || {};

    if (typeof start_at === 'undefined' &&
      typeof end_at === 'undefined' &&
      typeof is_booked === 'undefined') {
      return res.status(400).json({
        success: false,
        message: 'No fields to update. Provide start_at and/or end_at (ADMIN may set is_booked).'
      });
    }

    if (actorRole === 'THERAPIST' && typeof is_booked !== 'undefined') {
      return res.status(403).json({
        success: false,
        message: 'Therapists are not allowed to change is_booked.'
      });
    }

    if (actorRole === 'THERAPIST' && actorId !== String(therapist_id)) {
      return res.status(403).json({
        success: false,
        message: 'Therapists can only update their own slots.'
      });
    }

    const okTh = await ensureTherapistActive(therapist_id);
    if (!okTh.ok) return res.status(okTh.code).json({ success: false, message: okTh.msg });

    conn = await db.getConnection();
    await conn.beginTransaction();

    const [slotRows] = await conn.query(
      'SELECT * FROM availability_slots WHERE id = ? FOR UPDATE',
      [slot_id]
    );
    if (slotRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Slot not found.' });
    }
    const slot = slotRows[0];

    if (String(slot.doctor_id) !== String(therapist_id)) {
      await conn.rollback();
      return res.status(403).json({ success: false, message: 'Slot does not belong to this therapist.' });
    }

    if (actorRole === 'THERAPIST' && Number(slot.is_booked) === 1) {
      await conn.rollback();
      return res.status(403).json({ success: false, message: 'Cannot modify a booked slot.' });
    }

    let newStart = slot.start_at ? dayjs(slot.start_at) : null;
    let newEnd = slot.end_at ? dayjs(slot.end_at) : null;

    if (typeof start_at !== 'undefined' && start_at !== null && start_at !== '') {
      const p = dayjs(start_at, ['YYYY-MM-DD HH:mm', 'YYYY-MM-DD HH:mm:ss', dayjs.ISO_8601], true);
      if (!p.isValid()) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'Invalid start_at format.' });
      }
      newStart = p;
    }
    if (typeof end_at !== 'undefined' && end_at !== null && end_at !== '') {
      const p = dayjs(end_at, ['YYYY-MM-DD HH:mm', 'YYYY-MM-DD HH:mm:ss', dayjs.ISO_8601], true);
      if (!p.isValid()) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'Invalid end_at format.' });
      }
      newEnd = p;
    }

    if (!newStart || !newEnd) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Both start_at and end_at must be present.' });
    }
    if (!newStart.isBefore(newEnd)) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'start_at must be before end_at.' });
    }

    const [[nowRow]] = await conn.query('SELECT NOW() AS nowts');
    const now = dayjs(nowRow.nowts);
    if (newEnd.isBefore(now)) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Cannot set slot entirely in the past.' });
    }

    const [overlap] = await conn.query(
      `SELECT id FROM availability_slots
         WHERE doctor_id = ?
           AND id <> ?
           AND start_at < ?
           AND end_at   > ?
         LIMIT 1`,
      [
        therapist_id,
        slot_id,
        newEnd.format('YYYY-MM-DD HH:mm:ss'),
        newStart.format('YYYY-MM-DD HH:mm:ss')
      ]
    );
    if (overlap.length > 0) {
      await conn.rollback();
      return res.status(409).json({
        success: false,
        message: 'New time overlaps with another availability slot for this therapist.'
      });
    }

    const updates = [];
    const params = [];
    updates.push('start_at = ?'); params.push(newStart.format('YYYY-MM-DD HH:mm:ss'));
    updates.push('end_at = ?'); params.push(newEnd.format('YYYY-MM-DD HH:mm:ss'));

    let willSetIsBooked = null;
    if (actorRole === 'ADMIN' && typeof is_booked !== 'undefined') {
      const ib = (is_booked === true || String(is_booked).toLowerCase() === 'true' || String(is_booked) === '1') ? 1 : 0;
      updates.push('is_booked = ?'); params.push(ib);
      willSetIsBooked = ib;
    }

    params.push(slot_id);

    await conn.query(`UPDATE availability_slots SET ${updates.join(', ')} WHERE id = ?`, params);

    let canceledCount = 0;
    if (actorRole === 'ADMIN' && willSetIsBooked !== null) {
      const prevBooked = Number(slot.is_booked) === 1;
      const newBooked = willSetIsBooked === 1;

      if (prevBooked && !newBooked) {
        const [cancelRes] = await conn.query(
          `UPDATE therapy_sessions
             SET status = 'CANCELLED', updated_at = NOW()
           WHERE therapist_id = ?
             AND scheduled_at = ?
             AND status IN ('CONFIRMED')`,
          [therapist_id, slot.start_at]  // ملاحظة: نستخدم وقت الـslot القديم
        );
        canceledCount = cancelRes?.affectedRows || 0;
      }
    }

    const [[updatedRow]] = await conn.query(
      'SELECT * FROM availability_slots WHERE id = ?',
      [slot_id]
    );

    await conn.commit();
    return res.status(200).json({
      success: true,
      message: 'Therapy slot updated successfully.',
      data: updatedRow,
      meta: { cancelled_sessions: canceledCount }
    });

  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (_) { } }
    console.error('updateTherapyAvailabilitySlot:', err?.sqlMessage || err);
    return res.status(500).json({ success: false, message: 'Error updating therapy slot.' });
  } finally {
    if (conn) conn.release();
  }
};


const ALLOWED_STATUSES = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const FINAL_STATES = new Set(['COMPLETED', 'CANCELLED']);
function normalizeMode(m) {
  const v = String(m || '').toUpperCase();
  return ['VIDEO', 'AUDIO', 'CHAT'].includes(v) ? v : null;
}

const updateTherapySession = async (req, res) => {
  let conn;
  try {
    const { session_id } = req.params;
    const actor = req.user || {};
    const role = String(actor.role || '').toUpperCase();
    const uid = Number(actor.id);

    const { status, mode, notes } = req.body || {};
    const newStatus = typeof status === 'string' ? status.toUpperCase() : undefined;
    const newMode = typeof mode === 'string' ? normalizeMode(mode) : undefined;
    const newNotes = typeof notes === 'string' ? notes.toString().slice(0, 500) : undefined;

    conn = await db.getConnection();
    await conn.beginTransaction();

    const [[s]] = await conn.query(
      `SELECT id, patient_id, therapist_id, slot_id, mode, scheduled_at, status, anonymous
         FROM therapy_sessions
        WHERE id = ? FOR UPDATE`,
      [session_id]
    );
    if (!s) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Session not found.' });
    }

    if (role === 'PATIENT') {
      if (s.patient_id === null || Number(s.patient_id) !== uid) {
        await conn.rollback();
        return res.status(403).json({ success: false, message: 'You can only modify your own session.' });
      }
      if (s.status !== 'PENDING') {
        await conn.rollback();
        return res.status(403).json({ success: false, message: 'Patients can only modify sessions in PENDING.' });
      }
      if (typeof newMode !== 'undefined' && newMode === null) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'Invalid mode. Use VIDEO/AUDIO/CHAT.' });
      }
      if (typeof newMode !== 'undefined' && Number(s.anonymous) === 1 && newMode !== 'CHAT') {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'Anonymous sessions must use CHAT mode.' });
      }
      if (typeof newStatus !== 'undefined' && newStatus !== 'CANCELLED') {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'Patients may only cancel (status=CANCELLED) while pending.' });
      }

      const updates = [];
      const params = [];
      if (typeof newMode !== 'undefined') { updates.push('mode = ?'); params.push(newMode); }
      if (typeof newNotes !== 'undefined') { updates.push('notes = ?'); params.push(newNotes); }
      if (newStatus === 'CANCELLED') { updates.push('status = ?'); params.push('CANCELLED'); }

      if (updates.length === 0) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'Nothing to update.' });
      }

      await conn.query(
        `UPDATE therapy_sessions SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
        [...params, session_id]
      );
      await conn.commit();
      return res.status(200).json({ success: true, message: 'Session updated.' });
    }

    if (role !== 'THERAPIST' && role !== 'ADMIN') {
      await conn.rollback();
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }
    if (role === 'THERAPIST' && Number(s.therapist_id) !== uid) {
      await conn.rollback();
      return res.status(403).json({ success: false, message: 'You can only modify your own sessions.' });
    }

    if (typeof newMode !== 'undefined') {
      await conn.rollback();
      return res.status(403).json({ success: false, message: 'Only patients can change session mode.' });
    }

    if (typeof newStatus !== 'undefined' && !ALLOWED_STATUSES.includes(newStatus)) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }
    if (FINAL_STATES.has(s.status) && newStatus && !FINAL_STATES.has(newStatus)) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: `Cannot change status from ${s.status} back to ${newStatus}.`
      });
    }

    const updates = [];
    const params = [];
    if (typeof newNotes !== 'undefined') { updates.push('notes = ?'); params.push(newNotes); }
    if (newStatus) { updates.push('status = ?'); params.push(newStatus); }

    if (updates.length === 0) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Nothing to update.' });
    }

    await conn.query(
      `UPDATE therapy_sessions SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      [...params, session_id]
    );

    let cancelledPending = 0;

    if (newStatus === 'CONFIRMED') {
      await conn.query(`UPDATE availability_slots SET is_booked = 1 WHERE id = ?`, [s.slot_id]);
      const [cancelRes] = await conn.query(
        `UPDATE therapy_sessions
            SET status = 'CANCELLED', updated_at = NOW()
          WHERE slot_id = ? AND id <> ? AND status = 'PENDING'`,
        [s.slot_id, session_id]
      );
      cancelledPending = cancelRes?.affectedRows || 0;

    } else if (newStatus === 'CANCELLED' && s.status === 'CONFIRMED') {
      const [[cnt]] = await conn.query(
        `SELECT COUNT(*) AS c FROM therapy_sessions WHERE slot_id = ? AND status = 'CONFIRMED'`,
        [s.slot_id]
      );
      if (Number(cnt.c) === 0) {
        await conn.query(`UPDATE availability_slots SET is_booked = 0 WHERE id = ?`, [s.slot_id]);
      }
    }

    await conn.commit();
    return res.status(200).json({
      success: true,
      message: 'Session updated.',
      meta: { cancelled_other_pending_for_same_slot: cancelledPending }
    });

  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (_) { } }
    console.error('updateTherapySession:', err?.sqlMessage || err);
    return res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    if (conn) conn.release();
  }
};

const ALLOWED_MODES = ['VIDEO', 'AUDIO', 'CHAT'];
const getTherapySessionById = async (req, res) => {
  try {
    const { id } = req.params;
    const role = String(req.user?.role || '').toUpperCase();
    const uid = Number(req.user?.id);

    const [[row]] = await db.query(
      `SELECT ts.id, ts.patient_id, ts.therapist_id, ts.slot_id, ts.mode, ts.status,
              ts.scheduled_at, ts.started_at, ts.ended_at, ts.anonymous, ts.notes,
              p.full_name  AS patient_name,
              t.full_name  AS therapist_name
         FROM therapy_sessions ts
         LEFT JOIN \`user\` p ON p.user_id = ts.patient_id
         LEFT JOIN \`user\` t ON t.user_id = ts.therapist_id
        WHERE ts.id = ?`,
      [id]
    );
    if (!row) return res.status(404).json({ success: false, message: 'Session not found' });
    if (role === 'PATIENT' && Number(row.patient_id) !== uid) return res.status(403).json({ success: false, message: 'Forbidden' });
    if (role === 'THERAPIST' && Number(row.therapist_id) !== uid) return res.status(403).json({ success: false, message: 'Forbidden' });

    return res.json({ success: true, data: row });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
const listTherapySessions = async (req, res) => {
  try {
    const role = String(req.user?.role || '').toUpperCase();
    const uid = Number(req.user?.id);

    let { status, mode, anonymous, from, to, therapist_id, patient_id, limit = '50', offset = '0' } = req.query;

    limit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    offset = Math.max(parseInt(offset, 10) || 0, 0);

    const where = [];
    const params = [];

    if (role === 'PATIENT') {
      where.push('ts.patient_id = ?'); params.push(uid);
    } else if (role === 'THERAPIST') {
      where.push('ts.therapist_id = ?'); params.push(uid);
    } else if (role === 'ADMIN') {
      if (therapist_id) { where.push('ts.therapist_id = ?'); params.push(Number(therapist_id)); }
      if (patient_id) { where.push('ts.patient_id   = ?'); params.push(Number(patient_id)); }
    }

    if (status) {
      const st = String(status).toUpperCase();
      if (!ALLOWED_STATUSES.includes(st)) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
      }
      where.push('ts.status = ?'); params.push(st);
    }

    if (mode) {
      const md = String(mode).toUpperCase();
      if (!ALLOWED_MODES.includes(md)) {
        return res.status(400).json({ success: false, message: 'Invalid mode' });
      }
      where.push('ts.mode = ?'); params.push(md);
    }

    if (typeof anonymous !== 'undefined') {
      const an = (anonymous === '1' || anonymous === 'true' || anonymous === 1 || anonymous === true) ? 1 : 0;
      where.push('ts.anonymous = ?'); params.push(an);
    }

    if (from) {
      const f = dayjs(from, ['YYYY-MM-DD', dayjs.ISO_8601], true);
      if (!f.isValid()) return res.status(400).json({ success: false, message: 'Invalid from date' });
      where.push('ts.scheduled_at >= ?'); params.push(f.startOf('day').format('YYYY-MM-DD HH:mm:ss'));
    }
    if (to) {
      const t = dayjs(to, ['YYYY-MM-DD', dayjs.ISO_8601], true);
      if (!t.isValid()) return res.status(400).json({ success: false, message: 'Invalid to date' });
      where.push('ts.scheduled_at <= ?'); params.push(t.endOf('day').format('YYYY-MM-DD HH:mm:ss'));
    }

    const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await db.query(
      `SELECT ts.id, ts.patient_id, ts.therapist_id, ts.slot_id, ts.mode, ts.status,
              ts.scheduled_at, ts.anonymous,
              p.full_name AS patient_name,
              t.full_name AS therapist_name
         FROM therapy_sessions ts
         LEFT JOIN \`user\` p ON p.user_id = ts.patient_id
         LEFT JOIN \`user\` t ON t.user_id = ts.therapist_id
        ${whereSQL}
        ORDER BY ts.scheduled_at DESC, ts.id DESC
        LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return res.json({ success: true, count: rows.length, data: rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};


async function verifyParticipant(userId, sessionId) {
  const sid = Number(sessionId || 0);
  const uid = Number(userId || 0);
  if (!sid || !uid) return false;

  const [[row]] = await db.query(
    `SELECT id FROM therapy_sessions
      WHERE id = ? AND (patient_id = ? OR therapist_id = ?)
      LIMIT 1`,
    [sid, uid, uid]
  );
  return !!row;
}

const getTherapyMessages = async (req, res) =>{
  try {
    const sessionId = Number(req.params.session_id || req.params.id || 0);
    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'Invalid session_id' });
    }

    const userId = Number(req.user?.id || 0);
    const role = String(req.user?.role || '').toUpperCase();

    if (role !== 'ADMIN') {
      const allowed = await verifyParticipant(userId, sessionId);
      if (!allowed) {
        return res.status(403).json({ success: false, message: 'Not a session participant' });
      }
    }

    const [rows] = await db.query(
      `SELECT id,
              sender_role,
              text_original,
              text_translated,
              lang_from,
              lang_to,
              created_at
         FROM therapy_messages
        WHERE session_id = ?
        ORDER BY id ASC`,
      [sessionId]
    );

    return res.json({ success: true, messages: rows });
  } catch (e) {
    console.error('getTherapyMessages error:', e?.message || e);
    return res.status(500).json({ success: false, message: 'Failed to load therapy messages' });
  }
}






module.exports = {
  createTherapyAvailabilitySlot,
  listAvailabilityForTherapist, listAllTherapyAvailability,
  deleteTherapyAvailabilitySlot, bookTherapySlot,
  updateTherapyAvailabilitySlot, updateTherapySession,
  getTherapySessionById, listTherapySessions,getTherapyMessages

};


