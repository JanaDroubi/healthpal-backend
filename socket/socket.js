
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { translateText } = require('../messages/translationService');

const userSockets = new Map();
const addSock = (uid, sid) => {
  const arr = userSockets.get(uid) || [];
  arr.push(sid); userSockets.set(uid, arr);
};
const rmSock = (uid, sid) => {
  const arr = userSockets.get(uid) || [];
  userSockets.set(uid, arr.filter(x => x !== sid));
};

async function verifyParticipant(userId, consultationId) {
  const [[row]] = await db.query(
    `SELECT id FROM consultations
     WHERE id=? AND (patient_id=? OR doctor_id=?) LIMIT 1`,
    [consultationId, userId, userId]
  );
  return !!row;
}

async function getUserLang(userId) {
  const [[row]] = await db.query(
    'SELECT preferred_language FROM users WHERE user_id=? LIMIT 1',
    [userId]
  );
  return (row?.preferred_language || 'en').toLowerCase();
}


async function canSendNow(consultationId) {
  const [[row]] = await db.query(
    `SELECT c.status, c.mode, s.start_at, s.end_at
     FROM consultations c
     JOIN availability_slots s ON s.id = c.slot_id
     WHERE c.id = ? LIMIT 1`,
    [consultationId]
  );
  if (!row) return { ok: false, reason: 'Consultation not found' };

  const status = row.status;
  const mode = row.mode;
  const startAt = row.start_at ? new Date(row.start_at) : null;
  const endAt = row.end_at ? new Date(row.end_at) : null;

  if (mode !== 'ASYNC_MSG') return { ok: false, reason: 'Mode is not ASYNC_MSG' };
  if (!(status === 'CONFIRMED' || status === 'IN_PROGRESS'))
    return { ok: false, reason: 'Consultation is not confirmed/in progress' };
  if (!startAt) return { ok: false, reason: 'Slot has no start time' };

  const now = new Date();
  if (now < startAt) return { ok: false, reason: 'Appointment has not started yet' };
  if (endAt && now > endAt) return { ok: false, reason: 'Appointment time is over' };

  return { ok: true };
}

function attachConsultationChat(io) {
  if (io._consultationAttached) return;
  io._consultationAttached = true;

  io.use((socket, next) => {
    try {
      const t1 = socket.handshake.auth?.token;
      const t2 = socket.handshake.headers?.authorization
        ? socket.handshake.headers.authorization.split(' ')[1]
        : null;
      const t3 = socket.handshake.query?.token;
      const token = t1 || t2 || t3;
      if (!token) return next(new Error('No token'));

      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      socket.user = { id: Number(decoded.id), role: decoded.role };
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const userId = Number(socket.user.id);
    addSock(userId, socket.id);
    console.log(' WS connected:', socket.id, 'user=', userId);

    socket.on('consultation:join', async ({ consultationId }) => {
      try {
        const cid = Number(consultationId);
        if (!cid) {
          return socket.emit('consultation:error', { message: 'Missing consultationId' });
        }
        const allowed = await verifyParticipant(userId, cid);
        if (!allowed) {
          return socket.emit('consultation:error', { message: 'Not a participant', consultationId: cid });
        }
        socket.join(`consult:${cid}`);
        console.log('👥 JOINED consult:', cid, 'user=', userId);

        const gate = await canSendNow(cid);
        if (!gate.ok) {
          socket.emit('consultation:info', {
            consultationId: cid,
            message:
              gate.reason === 'Appointment has not started yet'
                ? 'تنبيه: موعد الاستشارة لم يبدأ بعد — لا يمكن إرسال رسائل الآن.'
                : gate.reason === 'Consultation is not confirmed/in progress'
                  ? 'تنبيه: حالة الاستشارة ليست CONFIRMED/IN_PROGRESS.'
                  : gate.reason === 'Mode is not ASYNC_MSG'
                    ? 'تنبيه: نوع الاستشارة ليس مراسلة غير متزامنة (ASYNC_MSG).'
                    : 'تنبيه: لا يمكن الإرسال حاليًا.',
          });
        }

        socket.emit('consultation:joined', { consultationId: cid });
      } catch (e) {
        console.error('join failed:', e.message);
        socket.emit('consultation:error', { message: 'Join failed' });
      }
    });

    socket.on('message:send', async ({ consultationId, text }) => {
      try {
        const cid = Number(consultationId);
        if (!cid || !text?.trim()) return;

        const allowed = await verifyParticipant(userId, cid);
        if (!allowed) {
          return socket.emit('consultation:error', { message: 'Not a participant', consultationId: cid });
        }

        const gate = await canSendNow(cid);
        if (!gate.ok) {
          return socket.emit('consultation:error', {
            consultationId: cid,
            message:
              gate.reason === 'Appointment has not started yet'
                ? 'موعد الاستشارة لم يبدأ بعد'
                : gate.reason === 'Consultation is not confirmed/in progress'
                  ? 'حالة الاستشارة ليست مؤكدة/قيد التنفيذ'
                  : gate.reason === 'Mode is not ASYNC_MSG'
                    ? 'هذه الاستشارة ليست للمراسلة النصية (ASYNC_MSG)'
                    : 'لا يمكن الإرسال في هذا الوقت',
          });
        }

        const [[row]] = await db.query(
          `SELECT patient_id, doctor_id FROM consultations WHERE id=? LIMIT 1`,
          [cid]
        );
        if (!row) return;

        const patientId = Number(row.patient_id);
        const doctorId = Number(row.doctor_id);
        const otherId = userId === patientId ? doctorId : patientId;

        const senderLang = await getUserLang(userId);
        const receiverLang = await getUserLang(otherId);

        const mustTranslate =
          receiverLang && senderLang &&
          receiverLang !== senderLang &&
          text.trim().length > 0;

        let translated = null;
        if (mustTranslate) {
          translated = await translateText(text, receiverLang, senderLang);
        }

        await db.query(
          `INSERT INTO messages
             (consultation_id, sender_id, text_original, text_translated, lang_from, lang_to)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [cid, userId, text, translated, senderLang, receiverLang || null]
        );

        const forSender = {
          consultationId: cid,
          senderId: userId,
          text,
          translated: null,
          lang_from: senderLang,
          lang_to: receiverLang || null,
          at: new Date().toISOString(),
        };
        const forReceiver = {
          consultationId: cid,
          senderId: userId,
          text: translated || text,
          original: text,
          lang_from: senderLang,
          lang_to: receiverLang || null,
          auto_translated: !!translated,
          at: new Date().toISOString(),
        };

        for (const sid of (userSockets.get(userId) || [])) io.to(sid).emit('message:new', forSender);
        for (const sid of (userSockets.get(otherId) || [])) io.to(sid).emit('message:new', forReceiver);
        io.to(`consult:${cid}`).emit('message:new:room', { ...forReceiver });

      } catch (e) {
        console.error('send failed:', e.message);
        socket.emit('consultation:error', { message: 'Send failed' });
      }
    });

    socket.on('disconnect', () => {
      rmSock(userId, socket.id);
      console.log(' WS disconnected:', socket.id, 'user=', userId);
    });
  });
}

module.exports = { attachConsultationChat };
