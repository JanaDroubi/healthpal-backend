const db = require('../config/db');
const dayjs = require('dayjs');

/**
 * ======================================================
 * CREATE PATIENT FEEDBACK
 * - Allowed only if case COMPLETED and by its patient
 * ======================================================
 */
const addPatientFeedback = async (req, res) => {
  try {
    const { case_id, feedback_text, rating } = req.body;
    const actor = req.user;

    if (!case_id || !feedback_text || !rating)
      return res.status(400).send({ success: false, message: "case_id, feedback_text, and rating are required" });

    // Verify case belongs to patient
    const [[caseRow]] = await db.query(`
      SELECT * FROM sponsorship_cases WHERE id = ? AND patient_id = ?
    `, [case_id, actor.id]);

    if (!caseRow)
      return res.status(404).send({ success: false, message: "Case not found or not yours" });

    if (caseRow.status !== 'COMPLETED')
      return res.status(400).send({ success: false, message: "Feedback can only be added for COMPLETED cases" });

    await db.query(`
      INSERT INTO patient_feedback (case_id, patient_id, feedback_text, rating)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE feedback_text = VALUES(feedback_text), rating = VALUES(rating), created_at = NOW()
    `, [case_id, actor.id, feedback_text, rating]);

    res.status(201).send({ success: true, message: "Feedback added successfully" });

  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Error adding feedback", error });
  }
};

/**
 * ======================================================
 * GET FEEDBACK FOR A CASE (visible to donors + admin)
 * ======================================================
 */
const getFeedbackByCase = async (req, res) => {
  try {
    const { case_id } = req.params;
    const actor = req.user || {};
    const role = String(actor.role || '').toUpperCase();

    //  تحقق من وجود الحالة وربطها بالمريض
    const [[caseRow]] = await db.query(
      `SELECT id, patient_id, status FROM sponsorship_cases WHERE id = ?`,
      [case_id]
    );

    if (!caseRow)
      return res.status(404).send({ success: false, message: "Case not found" });

    //  تحقق من صلاحيات الوصول
    if (role === 'PATIENT' && caseRow.patient_id !== actor.id) {
      return res.status(403).send({
        success: false,
        message: "Patients can only view feedback for their own cases"
      });
    }


    //  جلب الفيدباك
    const [rows] = await db.query(
      `
      SELECT pf.*, u.full_name AS patient_name
      FROM patient_feedback pf
      JOIN patient_profiles p ON p.user_id = pf.patient_id
      JOIN user u ON u.user_id = p.user_id
      WHERE pf.case_id = ?
      `,
      [case_id]
    );

    if (rows.length === 0)
      return res.status(404).send({ success: false, message: "No feedback found for this case" });

    const fb = rows[0];

    res.status(200).send({
      success: true,
      data: {
        patient_name: fb.patient_name,
        feedback_text: fb.feedback_text,
        rating: fb.rating,
        created_at: dayjs(fb.created_at).format('YYYY-MM-DD HH:mm')
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Error fetching feedback", error });
  }
};


module.exports = { addPatientFeedback, getFeedbackByCase };
