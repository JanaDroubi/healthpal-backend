// controllers/sponsorshipController.js

const db = require('../config/db');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);

/**
 * Helper: format case dates + compute progress %
 */
function formatCase(caseRow) {
  if (!caseRow) return null;
  const target = Number(caseRow.target_amount || 0);
  const raised = Number(caseRow.raised_amount || 0);
  const progress = target > 0 ? Math.min(100, Math.round((raised / target) * 10000) / 100) : null;

  return {
    ...caseRow,
    target_amount: caseRow.target_amount !== null ? Number(caseRow.target_amount) : null,
    raised_amount: caseRow.raised_amount !== null ? Number(caseRow.raised_amount) : null,
    goal_deadline: caseRow.goal_deadline ? dayjs(caseRow.goal_deadline).format('YYYY-MM-DD') : null,
    created_at: caseRow.created_at ? dayjs(caseRow.created_at).format('YYYY-MM-DD HH:mm') : null,
    updated_at: caseRow.updated_at ? dayjs(caseRow.updated_at).format('YYYY-MM-DD HH:mm') : null,
    progress_percentage: progress
  };
}

/**
 * Create a sponsorship case
 * - allowed: PATIENT (for own cases), DOCTOR (for patient), ADMIN
 * - initial status: PENDING
 */
const createCase = async (req, res) => {
  let conn;
  try {
    const actor = req.user || {};
    const actorRole = String(actor.role || '').toUpperCase();
    const {
      patient_id,
      title,
      description,
      category,
      target_amount,
      goal_deadline
    } = req.body || {};

    // basic validations
    if (!patient_id || !title || !category) {
      return res.status(400).send({ success: false, message: 'patient_id, title and category are required' });
    }

    // permission: PATIENT can create only for self; DOCTOR/ADMIN can create for any patient
    if (actorRole === 'PATIENT' && String(actor.id) !== String(patient_id)) {
      return res.status(403).send({ success: false, message: 'Patients can only create cases for themselves' });
    }

    // verify patient exists
    const [[patientUser]] = await db.query(
      `SELECT u.user_id FROM user u
       JOIN patient_profiles p ON p.user_id = u.user_id
       WHERE u.user_id = ?`,
      [patient_id]
    );
    if (!patientUser) {
      return res.status(404).send({ success: false, message: 'Patient not found' });
    }

    // validate category
    const ALLOWED_CATS = ['SURGERY','CANCER','DIALYSIS','REHAB','OTHER'];
    if (!ALLOWED_CATS.includes(String(category).toUpperCase())) {
      return res.status(400).send({ success: false, message: `Invalid category. Allowed: ${ALLOWED_CATS.join(',')}` });
    }

    // normalize numeric
    const targetNum = target_amount ? Number(target_amount) : 0;
    if (target_amount !== undefined && (isNaN(targetNum) || targetNum < 0)) {
      return res.status(400).send({ success: false, message: 'target_amount must be a non-negative number' });
    }

    // parse deadline
    let deadlineSQL = null;
    if (goal_deadline) {
      const parsed = dayjs(goal_deadline, ['YYYY-MM-DD','DD/MM/YYYY'], true);
      if (!parsed.isValid()) {
        return res.status(400).send({ success: false, message: 'Invalid goal_deadline format. Use YYYY-MM-DD or DD/MM/YYYY' });
      }
      deadlineSQL = parsed.format('YYYY-MM-DD');
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    const [ins] = await conn.query(
      `INSERT INTO sponsorship_cases (
         patient_id, title, description, category, target_amount, raised_amount, goal_deadline, status
       ) VALUES (?, ?, ?, ?, ?, 0, ?, 'PENDING')`,
      [patient_id, title, description || null, String(category).toUpperCase(), targetNum, deadlineSQL]
    );

    await conn.commit();

    // fetch created
    const [[created]] = await db.query('SELECT * FROM sponsorship_cases WHERE id = ?', [ins.insertId]);
    return res.status(201).send({ success: true, message: 'Sponsorship case created (PENDING review)', data: formatCase(created) });

  } catch (error) {
    if (conn) { try { await conn.rollback(); } catch(_){} }
    console.error(error);
    return res.status(500).send({ success: false, message: 'Error creating sponsorship case', error });
  } finally {
    if (conn) conn.release();
  }
};

/**
 * Get all cases (role aware)
 * - ADMIN, DOCTOR: see all
 * - PATIENT: see only own cases
 * - DONOR: see only OPEN / FUNDED (public)
 */
const getAllCases = async (req, res) => {
  try {
    const actor = req.user || {};
    const role = String(actor.role || '').toUpperCase();

    let sql = `
      SELECT sc.*, p.user_id AS patient_user_id, u.full_name AS patient_name
      FROM sponsorship_cases sc
      JOIN patient_profiles p ON p.user_id = sc.patient_id
      JOIN user u ON u.user_id = p.user_id
    `;
    const params = [];

    if (role === 'ADMIN' || role === 'DOCTOR') {
      sql += ` ORDER BY sc.created_at DESC`;
    } else if (role === 'PATIENT') {
      sql += ` WHERE sc.patient_id = ? ORDER BY sc.created_at DESC`;
      params.push(actor.id);
    } else { // DONOR or public viewer
      // donors see only OPEN or FUNDED (public)
      sql += ` WHERE sc.status IN ('OPEN','FUNDED') ORDER BY sc.created_at DESC`;
    }

    const [rows] = await db.query(sql, params);

    const formatted = rows.map(r => {
      const base = {
        id: r.id,
        patient_id: r.patient_id,
        patient_name: r.patient_name,
        title: r.title,
        category: r.category,
        status: r.status,
        target_amount: r.target_amount,
        raised_amount: r.raised_amount,
        goal_deadline: r.goal_deadline ? dayjs(r.goal_deadline).format('YYYY-MM-DD') : null,
        created_at: r.created_at ? dayjs(r.created_at).format('YYYY-MM-DD HH:mm') : null,
        updated_at: r.updated_at ? dayjs(r.updated_at).format('YYYY-MM-DD HH:mm') : null,
      };
      return {
        ...base,
        progress_percentage: (r.target_amount && Number(r.target_amount) > 0) ? Math.min(100, Math.round((Number(r.raised_amount || 0) / Number(r.target_amount)) * 10000) / 100) : null
      };
    });

    res.status(200).send({ success: true, count: formatted.length, data: formatted });

  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: 'Error fetching sponsorship cases', error });
  }
};

/**
 * Get case by id (detailed)
 * - include donations summary, invoices summary, receipts summary, and donor list (limited)
 * - permission: ADMIN/DOCTOR see all; PATIENT only own; DONOR only if OPEN/FUNDED
 */
const getCaseById = async (req, res) => {
  try {
    const { id } = req.params;
    const actor = req.user || {};
    const role = String(actor.role || '').toUpperCase();

    const [rows] = await db.query(`
      SELECT sc.*, p.user_id AS patient_user_id, u.full_name AS patient_name
      FROM sponsorship_cases sc
      JOIN patient_profiles p ON p.user_id = sc.patient_id
      JOIN user u ON u.user_id = p.user_id
      WHERE sc.id = ?
    `, [id]);

    if (rows.length === 0) return res.status(404).send({ success: false, message: 'Case not found' });
    const c = rows[0];

    // permission checks
    if (role === 'PATIENT' && String(actor.id) !== String(c.patient_id)) {
      return res.status(403).send({ success: false, message: 'Patients can only view their own cases' });
    }
    if (role === 'DONOR' && !['OPEN','FUNDED'].includes(String(c.status))) {
      return res.status(403).send({ success: false, message: 'Donors can only view public cases (OPEN / FUNDED)' });
    }

    // donations summary
    const [[donationSummary]] = await db.query(`
      SELECT COUNT(*) AS donations_count, COALESCE(SUM(amount),0) AS total_donated
      FROM donations WHERE case_id = ?
    `, [id]);

    // sample donors (most recent 10) - respect anonymity: show name only if donor profile public
    const [donors] = await db.query(`
      SELECT d.user_id AS donor_user_id, u.full_name, d.anonymity_pref, dn.amount, dn.paid_at
      FROM donations dn
      JOIN donor_profiles d ON d.user_id = dn.donor_id
      LEFT JOIN user u ON u.user_id = d.user_id
      WHERE dn.case_id = ?
      ORDER BY dn.paid_at DESC
      LIMIT 10
    `, [id]);

    const donorsMapped = donors.map(dd => ({
      donor_user_id: dd.donor_user_id,
      name: dd.anonymity_pref === 'ANON' ? null : dd.full_name,
      amount: Number(dd.amount),
      paid_at: dd.paid_at ? dayjs(dd.paid_at).format('YYYY-MM-DD HH:mm') : null
    }));

    // invoices summary
    const [invoiceSummary] = await db.query(`
      SELECT COALESCE(SUM(amount),0) AS total_invoiced, COUNT(*) AS invoices_count
      FROM invoices WHERE case_id = ?
    `, [id]);

    // receipts summary
    const [receiptSummary] = await db.query(`
      SELECT COALESCE(SUM(paid_amount),0) AS total_receipted, COUNT(*) AS receipts_count
      FROM receipts r
      JOIN invoices i ON i.id = r.invoice_id
      WHERE i.case_id = ?
    `, [id]);

    const result = {
      case: formatCase(c),
      donations: {
        count: donationSummary.donations_count || 0,
        total: Number(donationSummary.total_donated || 0),
        recent: donorsMapped
      },
      invoices: {
        total_invoiced: Number(invoiceSummary[0] ? invoiceSummary[0].total_invoiced : (invoiceSummary.total_invoiced || 0)) || Number(invoiceSummary.total_invoiced || 0),
        invoices_count: invoiceSummary[0] ? Number(invoiceSummary[0].invoices_count) : Number(invoiceSummary.invoices_count || 0)
      },
      receipts: {
        total_receipted: Number(receiptSummary[0] ? receiptSummary[0].total_receipted : (receiptSummary.total_receipted || 0)),
        receipts_count: receiptSummary[0] ? Number(receiptSummary[0].receipts_count) : Number(receiptSummary.receipts_count || 0)
      }
    };

    
    res.status(200).send({ success: true, data: result });

  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: 'Error fetching case', error });
  }
};

/**
 * Update case (partial)
 * - PATIENT: can update own case ONLY while status is PENDING
 * - DOCTOR/ADMIN: can update any case
 * - cannot update raised_amount directly
 */
const updateCase = async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    const actor = req.user || {};
    const role = String(actor.role || '').toUpperCase();

    // fetch existing
    const [[existing]] = await db.query('SELECT * FROM sponsorship_cases WHERE id = ?', [id]);
    if (!existing) return res.status(404).send({ success: false, message: 'Case not found' });

    // PATIENT only for own and only when PENDING
    if (role === 'PATIENT') {
      if (String(existing.patient_id) !== String(actor.id)) {
        return res.status(403).send({ success: false, message: 'Patients can only update their own cases' });
      }
      if (String(existing.status) !== 'PENDING') {
        return res.status(403).send({ success: false, message: 'Cannot update case after review' });
      }
    }

    // allowed fields
    const ALLOWED = ['title','description','category','target_amount','goal_deadline'];
    const updates = {};
    for (const k of Object.keys(req.body || {})) {
      if (ALLOWED.includes(k)) updates[k] = req.body[k];
    }
    if (Object.keys(updates).length === 0) return res.status(400).send({ success: false, message: 'No valid fields to update' });

    // validate category if present
    if (updates.category) {
      const ALLOWED_CATS = ['SURGERY','CANCER','DIALYSIS','REHAB','OTHER'];
      if (!ALLOWED_CATS.includes(String(updates.category).toUpperCase())) {
        return res.status(400).send({ success: false, message: 'Invalid category' });
      }
      updates.category = String(updates.category).toUpperCase();
    }

    // validate target_amount
    if (updates.target_amount !== undefined) {
      const t = Number(updates.target_amount);
      if (isNaN(t) || t < 0) return res.status(400).send({ success: false, message: 'target_amount must be non-negative' });
      updates.target_amount = t;
    }

    // deadline normalize
    if (updates.goal_deadline !== undefined) {
      if (!updates.goal_deadline) {
        updates.goal_deadline = null;
      } else {
        const pd = dayjs(updates.goal_deadline, ['YYYY-MM-DD','DD/MM/YYYY'], true);
        if (!pd.isValid()) return res.status(400).send({ success: false, message: 'Invalid goal_deadline format' });
        updates.goal_deadline = pd.format('YYYY-MM-DD');
      }
    }

    // build query
    const setClause = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const vals = Object.values(updates);

    conn = await db.getConnection();
    await conn.beginTransaction();

    const [upd] = await conn.query(`UPDATE sponsorship_cases SET ${setClause}, updated_at = NOW() WHERE id = ?`, [...vals, id]);

    await conn.commit();

    const [[fresh]] = await db.query('SELECT * FROM sponsorship_cases WHERE id = ?', [id]);
    return res.status(200).send({ success: true, message: 'Case updated', data: formatCase(fresh) });

  } catch (error) {
    if (conn) { try { await conn.rollback(); } catch(_){} }
    console.error(error);
    res.status(500).send({ success: false, message: 'Error updating case', error });
  } finally {
    if (conn) conn.release();
  }
};

/**
 * Change status (ADMIN only typically)
 * transitions allowed:
 *  PENDING -> APPROVED / REJECTED
 *  APPROVED -> OPEN
 *  OPEN -> FUNDED (automatically by trigger) or CLOSED (admin)
 *  FUNDED -> COMPLETED (admin when treatment done)
 *  ANY -> CLOSED (admin)
 */
const changeCaseStatus = async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    const { action, reason } = req.body || {}; 
    const actor = req.user || {};
    const role = String(actor.role || '').toUpperCase();

    if (!['APPROVED','REJECTED','OPEN','CLOSED','COMPLETED','FUNDED'].includes(String(action))) {
      return res.status(400).send({ success: false, message: 'Invalid action' });
    }

    // only ADMIN (or FINANCE_MANAGER for some actions if you want) can change status
    if (role !== 'ADMIN' && role !== 'FINANCE_MANAGER') {
      return res.status(403).send({ success: false, message: 'Only ADMIN or finance can change case status' });
    }

    const [[existing]] = await db.query('SELECT * FROM sponsorship_cases WHERE id = ?', [id]);
    if (!existing) return res.status(404).send({ success: false, message: 'Case not found' });

    conn = await db.getConnection();
    await conn.beginTransaction();

    let newStatus = existing.status;

    if (action === 'APPROVED') {
      if (existing.status !== 'PENDING') {
        await conn.rollback();
        return res.status(400).send({ success: false, message: 'Only PENDING cases can be approved' });
      }
      newStatus = 'APPROVED';
    } else if (action === 'REJECTED') {
      if (existing.status !== 'PENDING') {
        await conn.rollback();
        return res.status(400).send({ success: false, message: 'Only PENDING cases can be rejected' });
      }
      newStatus = 'REJECTED';
    } else if (action === 'OPEN') {
      if (existing.status !== 'APPROVED') {
        await conn.rollback();
        return res.status(400).send({ success: false, message: 'Only APPROVED cases can be opened' });
      }
      newStatus = 'OPEN';
    } else if (action === 'COMPLETED') {
      if (!['FUNDED','OPEN'].includes(existing.status)) {
        await conn.rollback();
        return res.status(400).send({ success: false, message: 'Only FUNDED or OPEN cases can be marked completed' });
      }
      newStatus = 'COMPLETED';
    } else if (action === 'CLOSED') {
      // admin can close any case
      newStatus = 'CLOSED';
    }

    await conn.query(`UPDATE sponsorship_cases SET status = ?, updated_at = NOW() WHERE id = ?`, [newStatus, id]);

    // optional: log audit (you could insert to a case_audit table - omitted here, but recommended)
    await conn.commit();

    const [[fresh]] = await db.query('SELECT * FROM sponsorship_cases WHERE id = ?', [id]);
    return res.status(200).send({ success: true, message: `Case status changed to ${newStatus}`, data: formatCase(fresh) });

  } catch (error) {
    if (conn) { try { await conn.rollback(); } catch(_){} }
    console.error(error);
    res.status(500).send({ success: false, message: 'Error changing case status', error });
  } finally {
    if (conn) conn.release();
  }
};

/**
 * Delete / deactivate case (soft)
 * - mark CLOSED (keeps data)
 * - ADMIN or patient (only before approval) can perform
 */
const deleteCase = async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    const actor = req.user || {};
    const role = String(actor.role || '').toUpperCase();

    const [[existing]] = await db.query('SELECT * FROM sponsorship_cases WHERE id = ?', [id]);
    if (!existing) return res.status(404).send({ success: false, message: 'Case not found' });

    // patient can delete own case only when PENDING
    if (role === 'PATIENT') {
      if (String(existing.patient_id) !== String(actor.id)) {
        return res.status(403).send({ success: false, message: 'Patients can only delete their own cases' });
      }
      if (String(existing.status) !== 'PENDING') {
        return res.status(403).send({ success: false, message: 'Cannot delete case after review' });
      }
    } else if (!['ADMIN','DOCTOR'].includes(role)) {
      return res.status(403).send({ success: false, message: 'Only ADMIN/DOCTOR or owner can delete cases' });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    // set status = 'CLOSED' and keep record
    const [upd] = await conn.query(`UPDATE sponsorship_cases SET status = 'CLOSED', updated_at = NOW() WHERE id = ?`, [id]);

    await conn.commit();

    return res.status(200).send({ success: true, message: 'Case closed (soft deleted)', meta: { affected: upd.affectedRows } });

  } catch (error) {
    if (conn) { try { await conn.rollback(); } catch(_){} }
    console.error(error);
    res.status(500).send({ success: false, message: 'Error deleting case', error });
  } finally {
    if (conn) conn.release();
  }
};

module.exports = {
  createCase,
  getAllCases,
  getCaseById,
  updateCase,
  changeCaseStatus,
  deleteCase
};
