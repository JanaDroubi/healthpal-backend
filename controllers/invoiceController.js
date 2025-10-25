// controllers/invoiceController.js
const db = require('../config/db');
const dayjs = require('dayjs');

/**
 * ===========================================================
 *  CREATE INVOICE
 * ===========================================================
 */
const createInvoice = async (req, res) => {
  try {
    const { case_id, hospital_name, description, amount, issued_date, due_date } = req.body;

    if (!case_id || !hospital_name || !amount)
      return res.status(400).send({
        success: false,
        message: "case_id, hospital_name, and amount are required"
      });

    // Validate case existence
    const [[caseRow]] = await db.query("SELECT * FROM sponsorship_cases WHERE id = ?", [case_id]);
    if (!caseRow)
      return res.status(404).send({ success: false, message: "Case not found" });

    // Allow invoice creation only when case is APPROVED or OPEN
    if (!['APPROVED', 'OPEN'].includes(caseRow.status)) {
      return res.status(400).send({
        success: false,
        message: "Invoice can only be created when case is APPROVED or OPEN"
      });
    }

    // Default issue date if not provided
    const issued = issued_date || dayjs().format('YYYY-MM-DD');

    // Create invoice
    const [result] = await db.query(
      `INSERT INTO invoices (case_id, hospital_name, description, amount, issued_date, due_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [case_id, hospital_name, description || null, amount, issued, due_date || null]
    );

    res.status(201).send({
      success: true,
      message: "Invoice created successfully",
      invoice_id: result.insertId
    });

  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Error creating invoice", error });
  }
};

/**
 * ===========================================================
 *  GET ALL INVOICES (role-aware)
 * ===========================================================
 */
const getAllInvoices = async (req, res) => {
  try {
    const role = req.user.role;
    let sql = `
      SELECT i.*, 
             s.title AS case_title, 
             s.status AS case_status,
             u.full_name AS patient_name
      FROM invoices i
      JOIN sponsorship_cases s ON s.id = i.case_id
      JOIN patient_profiles p ON p.user_id = s.patient_id
      JOIN user u ON u.user_id = p.user_id
    `;
    const params = [];

    if (role === 'PATIENT') {
      sql += ` WHERE s.patient_id = ?`;
      params.push(req.user.id);
    }

    sql += ` ORDER BY i.created_at DESC`;

    const [rows] = await db.query(sql, params);

    const formatted = rows.map(r => ({
      ...r,
      issued_date: r.issued_date ? dayjs(r.issued_date).format('YYYY-MM-DD') : null,
      due_date: r.due_date ? dayjs(r.due_date).format('YYYY-MM-DD') : null,
      created_at: dayjs(r.created_at).format('YYYY-MM-DD HH:mm'),
      updated_at: dayjs(r.updated_at).format('YYYY-MM-DD HH:mm')
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
      message: "Error fetching invoices",
      error
    });
  }
};

/**
 * ===========================================================
 *  GET SINGLE INVOICE + SUMMARIES
 * ===========================================================
 */
const getInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;
    const role = req.user.role;
    const userId = req.user.id;

    const [rows] = await db.query(`
      SELECT i.*, 
             s.patient_id, 
             s.title AS case_title,
             s.status AS case_status
      FROM invoices i
      JOIN sponsorship_cases s ON s.id = i.case_id
      WHERE i.id = ?`, [id]);

    if (rows.length === 0)
      return res.status(404).send({ success: false, message: "Invoice not found" });

    const invoice = rows[0];

    // Role-based access
    if (role === 'PATIENT' && invoice.patient_id !== userId)
      return res.status(403).send({ success: false, message: "Access denied" });

    // Format dates
    invoice.issued_date = invoice.issued_date ? dayjs(invoice.issued_date).format('YYYY-MM-DD') : null;
    invoice.due_date = invoice.due_date ? dayjs(invoice.due_date).format('YYYY-MM-DD') : null;
    invoice.created_at= dayjs(invoice.created_at).format('YYYY-MM-DD HH:mm');
    invoice.updated_at= dayjs(invoice.updated_at).format('YYYY-MM-DD HH:mm');

    // Donations summary (via this invoice)
    const [[donationsSummary]] = await db.query(`
      SELECT COUNT(*) AS donation_count, COALESCE(SUM(amount),0) AS total_donated
      FROM donations WHERE invoice_id = ?`, [id]);

    // Receipts summary
    const [[receiptsSummary]] = await db.query(`
      SELECT COUNT(*) AS receipt_count, COALESCE(SUM(paid_amount),0) AS total_paid
      FROM receipts WHERE invoice_id = ?`, [id]);

    res.status(200).send({
      success: true,
      data: {
        ...invoice,
        donationsSummary,
        receiptsSummary
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Error fetching invoice", error });
  }
};

/**
 * ===========================================================
 *  UPDATE INVOICE
 * ===========================================================
 */
const updateInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const fields = { ...req.body };

    // Allowed fields to update
    const allowed = ['hospital_name', 'description', 'amount', 'due_date'];
    const updates = Object.keys(fields).filter(f => allowed.includes(f));
    if (updates.length === 0)
      return res.status(400).send({ success: false, message: "No valid fields to update" });

    // If amount being changed, ensure no payments were made
    if (updates.includes('amount')) {
      const [[paid]] = await db.query(
        `SELECT COALESCE(SUM(paid_amount),0) AS total_paid FROM receipts WHERE invoice_id = ?`,
        [id]
      );
      if (Number(paid.total_paid) > 0) {
        return res.status(400).send({
          success: false,
          message: "Cannot change amount after partial payment has been received"
        });
      }
    }

    const setClause = updates.map(f => `${f} = ?`).join(', ');
    const values = updates.map(f => fields[f]);

    const [result] = await db.query(
      `UPDATE invoices 
       SET ${setClause}, updated_at = NOW() 
       WHERE id = ? AND status NOT IN ('PAID','CANCELLED')`,
      [...values, id]
    );

    if (result.affectedRows === 0)
      return res.status(400).send({
        success: false,
        message: "Cannot modify paid or cancelled invoice"
      });

    res.status(200).send({
      success: true,
      message: "Invoice updated successfully"
    });

  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Error updating invoice", error });
  }
};

/**
 * ===========================================================
 *  CANCEL INVOICE
 * ===========================================================
 */
const cancelInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.query(
      `UPDATE invoices 
       SET status = 'CANCELLED', updated_at = NOW() 
       WHERE id = ? AND status != 'PAID'`,
      [id]
    );

    if (result.affectedRows === 0)
      return res.status(400).send({
        success: false,
        message: "Cannot cancel paid invoice or not found"
      });

    res.status(200).send({
      success: true,
      message: "Invoice cancelled successfully"
    });

  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Error cancelling invoice", error });
  }
};

module.exports = {
  createInvoice,
  getAllInvoices,
  getInvoiceById,
  updateInvoice,
  cancelInvoice
};
