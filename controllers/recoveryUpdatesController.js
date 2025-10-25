const db = require('../config/db');
const dayjs = require('dayjs');

/**
 * ======================================================
 * CREATE RECOVERY UPDATE
 * - Allowed for: PATIENT (own case), DOCTOR, ADMIN
 * ======================================================
 */
const addRecoveryUpdate = async (req, res) => {
  try {
    const { case_id, update_text, visibility } = req.body;
    const actor = req.user;
    const role = String(actor.role || '').toUpperCase();

    if (!case_id || !update_text)
      return res.status(400).send({ success: false, message: "case_id and update_text are required" });

    // Verify case exists
    const [[caseRow]] = await db.query(`SELECT * FROM sponsorship_cases WHERE id = ?`, [case_id]);
    if (!caseRow) return res.status(404).send({ success: false, message: "Case not found" });

    // Permission
    if (role === 'PATIENT' && String(actor.id) !== String(caseRow.patient_id)) {
      return res.status(403).send({ success: false, message: "Patients can only add updates to their own cases" });
    }

    await db.query(`
      INSERT INTO recovery_updates (case_id, updated_by, update_text, visibility)
      VALUES (?, ?, ?, ?)
    `, [case_id, actor.id, update_text, visibility || 'PUBLIC']);

    res.status(201).send({ success: true, message: "Recovery update added successfully" });

  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Error adding recovery update", error });
  }
};

/**
 * ======================================================
 * GET RECOVERY UPDATES FOR A CASE
 * - Donors see only PUBLIC ones
 * ======================================================
 */
const getRecoveryUpdatesByCase = async (req, res) => {
  try {
    const { case_id } = req.params;
    const actor = req.user || {};
    const role = String(actor.role || '').toUpperCase();

    //  تحقق من وجود الحالة أولاً
    const [[caseRow]] = await db.query(
      `SELECT id, patient_id FROM sponsorship_cases WHERE id = ?`,
      [case_id]
    );

    if (!caseRow)
      return res.status(404).send({ success: false, message: "Case not found" });

    //  تحقق من الصلاحيات
    if (role === 'PATIENT' && caseRow.patient_id !== actor.id) {
      return res.status(403).send({
        success: false,
        message: "Patients can only view updates for their own cases"
      });
    }

    //  تجهيز الاستعلام
    let sql = `
      SELECT ru.*, u.full_name AS updated_by_name
      FROM recovery_updates ru
      JOIN user u ON u.user_id = ru.updated_by
      WHERE ru.case_id = ?
    `;
    const params = [case_id];

    //  المانحين فقط يشوفوا التحديثات العامة
    if (role === 'DONOR') {
      sql += ` AND ru.visibility = 'PUBLIC'`;
    }

    sql += ` ORDER BY ru.update_date DESC`;

    //  تنفيذ الاستعلام
    const [rows] = await db.query(sql, params);

    //  تنسيق النتيجة النهائية
    const formatted = rows.map(r => ({
      id: r.id,
      update_text: r.update_text,
      updated_by_name: r.updated_by_name,
      visibility: r.visibility,
      update_date: dayjs(r.update_date).format('YYYY-MM-DD HH:mm')
    }));

    res.status(200).send({
      success: true,
      count: formatted.length,
      data: formatted
    });

  } catch (error) {
    console.error(error);
    res.status(500).send({
      success: false,
      message: "Error fetching recovery updates",
      error
    });
  }
};


module.exports = { addRecoveryUpdate, getRecoveryUpdatesByCase };
