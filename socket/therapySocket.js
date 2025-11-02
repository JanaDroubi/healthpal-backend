
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { translateText } = require('../services/translationService');
const { log } = require('winston');

async function getSession(sessionId) {
  const [[row]] = await db.query(
    `SELECT id, patient_id, therapist_id, mode, scheduled_at, started_at, ended_at,
            status, anonymous, booked_by
       FROM therapy_sessions
      WHERE id=? LIMIT 1`,
    [sessionId]
  );
  return row || null;
}

async function verifyParticipant(userId, sessionId) {
  const [[row]] = await db.query(
    `SELECT id FROM therapy_sessions
      WHERE id=?
        AND (
              patient_id=? OR therapist_id=? OR
              (anonymous=1 AND booked_by=?)
            )
      LIMIT 1`,
    [sessionId, userId, userId, userId]
  );
  return !!row;
}

async function resolveRolesForUser(sessionId, userId) {
  const sess = await getSession(sessionId);
  if (!sess) return null;

  const pid = Number(sess.patient_id || 0);
  const tid = Number(sess.therapist_id || 0);
  const bid = Number(sess.booked_by || 0);
  const anon = !!sess.anonymous;

  const isPatient = pid && pid === Number(userId);
  const isTherapist = tid && tid === Number(userId);
  const isAnonBooker = anon && bid && bid === Number(userId);

  // حدّد دور المُرسل: الـ booked_by يُعامل كمريض عند anonymous
  let senderRole;
  if (isPatient || isAnonBooker) senderRole = 'PATIENT';
  else if (isTherapist) senderRole = 'THERAPIST';
  else return null; // مش مشارك

  // حدّد الطرف الآخر:
  let otherUserId = null;
  if (senderRole === 'PATIENT') {
    // المريض (أو الـ booked_by) يراسل المعالِج
    otherUserId = tid || null;
  } else {
    // المعالِج يراسل المريض: لو patient_id فاضي والجلسة anonymous استخدم booked_by
    otherUserId = pid || (anon ? bid : null);
  }

  if (!otherUserId) {
    console.warn('[therapy] Could not resolve otherUserId', { pid, tid, bid, anon, senderRole });
    return null;
  }

  return { sess, senderRole, otherUserId: Number(otherUserId) };
}


async function getUserLang(userId) {
  const [[row]] = await db.query(
    `SELECT preferred_language FROM user WHERE user_id=? LIMIT 1`,
    [userId]
  );
  return (row?.preferred_language || 'en').toLowerCase();
}

function canSendNow(sess) {
  if (!sess) return { ok: false, reason: 'Session not found' };
  if (sess.mode !== 'CHAT') return { ok: false, reason: 'Mode is not CHAT' };
  if (!(sess.status === 'CONFIRMED' || sess.status === 'IN_PROGRESS'))
    return { ok: false, reason: 'Session is not confirmed/in progress' };

  const now = new Date();
  const start = sess.started_at ? new Date(sess.started_at)
    : sess.scheduled_at ? new Date(sess.scheduled_at) : null;
  if (!start) return { ok: false, reason: 'No start time' };
  if (now < start) return { ok: false, reason: 'Session not started yet' };

  return { ok: true };
}

function attachTherapyChat(io) {

  if (io._therapyAttached) return;
  io._therapyAttached = true;


  io.use((socket, next) => {
    try {
      const t1 = socket.handshake.auth?.token;
      const t2 = socket.handshake.headers?.authorization
        ? socket.handshake.headers.authorization.split(' ')[1] : null;
      const t3 = socket.handshake.query?.token;
      const token = t1 || t2 || t3;
      if (!token) return next(new Error('No token'));

      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      socket.user = {
        id: Number(decoded.id),
        role: String(decoded.role || decoded.user_role || '').toUpperCase(), // PATIENT | THERAPIST | ADMIN
      };
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const userId = Number(socket.user.id);
    const myRole = socket.user.role;
    console.log('WS connected (therapy):', socket.id, 'user=', userId, 'role=', myRole);

    socket.on('therapy:join', async ({ sessionId }) => {
      try {
        const sid = Number(sessionId);
        if (!sid) return socket.emit('therapy:error', { message: 'Missing sessionId' });

        const allowed = await verifyParticipant(userId, sid);
        if (!allowed && myRole !== 'ADMIN')
          return socket.emit('therapy:error', { message: 'Not a session participant', sessionId: sid });

        socket.join(`therapy:${sid}`);
        socket.emit('therapy:joined', { sessionId: sid });

        const sess = await getSession(sid);
        const gate = canSendNow(sess);
        if (!gate.ok) {
          socket.emit('therapy:info', {
            sessionId: sid,
            message:
              gate.reason === 'Session not started yet' ? 'موعد الجلسة لم يبدأ بعد — لا يمكن إرسال رسائل الآن.' :
                gate.reason === 'Session is not confirmed/in progress' ? 'حالة الجلسة ليست CONFIRMED/IN_PROGRESS.' :
                  gate.reason === 'Mode is not CHAT' ? 'نوع الجلسة ليس مراسلة (CHAT).' :
                    'لا يمكن الإرسال حاليًا.'
          });
        }
      } catch (e) {
        console.error('therapy:join failed:', e);
        socket.emit('therapy:error', { message: 'Join failed' });
      }
    });

    socket.on('therapy:send', async ({ sessionId, text }) => {
      try {
        const sid = Number(sessionId);
        const msg = (text || '').trim();
        if (!sid || !msg) return;

        const allowed = await verifyParticipant(userId, sid);
        if (!allowed && myRole !== 'ADMIN')
          return socket.emit('therapy:error', { message: 'Not a session participant', sessionId: sid });

        const roleInfo = await resolveRolesForUser(sid, userId);
        if (!roleInfo) return socket.emit('therapy:error', { message: 'Role resolve failed' });
        const { sess, senderRole, otherUserId } = roleInfo;

        const gate = canSendNow(sess);
        if (!gate.ok) {
          return socket.emit('therapy:error', {
            sessionId: sid,
            message:
              gate.reason === 'Session not started yet' ? 'موعد الجلسة لم يبدأ بعد' :
                gate.reason === 'Session is not confirmed/in progress' ? 'الجلسة ليست مؤكدة/قيد التنفيذ' :
                  gate.reason === 'Mode is not CHAT' ? 'هذه الجلسة ليست نصية (CHAT)' :
                    'لا يمكن الإرسال في هذا الوقت'
          });
        }

        const senderLang = await getUserLang(userId);
        const receiverLang = await getUserLang(otherUserId);
        const needTranslate = receiverLang && senderLang && receiverLang !== senderLang;
        const translated = needTranslate ? await translateText(msg, receiverLang, senderLang) : null;

        console.log(receiverLang);

        // تخزين الرسالة
        await db.query(
          `INSERT INTO therapy_messages
             (session_id, sender_role, text_original, text_translated, lang_from, lang_to, created_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [sid, senderRole, msg, translated, senderLang, receiverLang || null]
        );

        io.to(`therapy:${sid}`).emit('therapy:new:room', {
          sessionId: sid,
          by: senderRole,
          original: msg,
          translated: translated || null,
          lang_from: senderLang,
          lang_to: receiverLang || null,
          auto_translated: !!translated,
          at: new Date().toISOString(),
          anonymous: !!sess.anonymous
        });

      } catch (e) {
        console.error('therapy:send failed:', e);
        socket.emit('therapy:error', { message: 'Send failed' });
      }
    });

    socket.on('disconnect', () => {
      console.log(' WS disconnected (therapy):', socket.id, 'user=', userId);
    });
  });
}

module.exports = { attachTherapyChat };
