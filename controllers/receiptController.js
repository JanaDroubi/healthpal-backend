const db = require('../config/db');
const dayjs = require('dayjs');

/**
 * ===========================================================
 *  CREATE RECEIPT (manual)
 * ===========================================================
 */
const createReceipt = async (req, res) => {
  let conn;
  try {
    const { invoice_id, paid_amount, payment_method, notes } = req.body;
    if (!invoice_id || !paid_amount)
      return res.status(400).send({ success: false, message: "invoice_id and paid_amount required" });

    conn = await db.getConnection();
    await conn.beginTransaction();

    const [[invoice]] = await conn.query("SELECT * FROM invoices WHERE id = ?", [invoice_id]);
    if (!invoice) return res.status(404).send({ success: false, message: "Invoice not found" });
    if (['CANCELLED', 'PAID'].includes(invoice.status))
      return res.status(400).send({ success: false, message: "Cannot pay cancelled or paid invoice" });

    const [[sum]] = await conn.query("SELECT COALESCE(SUM(paid_amount),0) AS total_paid FROM receipts WHERE invoice_id = ?", [invoice_id]);
    const remaining = Number(invoice.amount) - Number(sum.total_paid);
    if (paid_amount > remaining)
      return res.status(400).send({ success: false, message: "Payment exceeds remaining balance" });

    await conn.query(
      `INSERT INTO receipts (invoice_id, paid_amount, payment_method, notes)
       VALUES (?, ?, ?, ?)`,
      [invoice_id, paid_amount, payment_method || 'CASH', notes || null]
    );

    const newTotal = Number(sum.total_paid) + Number(paid_amount);
    const newStatus = newTotal >= Number(invoice.amount) ? 'PAID' : 'PARTIALLY_PAID';
    await conn.query(`UPDATE invoices SET status = ?, updated_at = NOW() WHERE id = ?`, [newStatus, invoice_id]);

    await conn.commit();
    res.status(201).send({ success: true, message: "Receipt recorded successfully" });

  } catch (error) {
    if (conn) await conn.rollback();
    console.error(error);
    res.status(500).send({ success: false, message: "Error creating receipt", error });
  } finally {
    if (conn) conn.release();
  }
};

/**
 * ===========================================================
 *  GET ALL RECEIPTS
 * ===========================================================
 */
const getAllReceipts = async (req, res) => {
  try {
    const role = req.user.role;
    const userId = req.user.id;

    let sql = `
      SELECT r.*, i.hospital_name, i.amount AS invoice_amount, i.status AS invoice_status,
             s.title AS case_title, s.patient_id
      FROM receipts r
      JOIN invoices i ON i.id = r.invoice_id
      JOIN sponsorship_cases s ON s.id = i.case_id`;
    const params = [];

    if (role === 'PATIENT') {
      sql += ` WHERE s.patient_id = ?`;
      params.push(userId);
    }

    sql += ` ORDER BY r.payment_date DESC`;

    const [rows] = await db.query(sql, params);
    const formatted = rows.map(r => ({
      ...r,
      payment_date: dayjs(r.payment_date).format('YYYY-MM-DD HH:mm')
    }));

    res.status(200).send({ success: true, count: formatted.length, data: formatted });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Error fetching receipts", error });
  }
};

/**
 * ===========================================================
 *  GET SINGLE RECEIPT
 * ===========================================================
 */
const getReceiptById = async (req, res) => {
  try {
    const { id } = req.params;
    const role = req.user.role;
    const userId = req.user.id;

    const [rows] = await db.query(`
      SELECT r.*, i.hospital_name, i.amount AS invoice_amount, s.title AS case_title, s.patient_id
      FROM receipts r
      JOIN invoices i ON i.id = r.invoice_id
      JOIN sponsorship_cases s ON s.id = i.case_id
      WHERE r.id = ?`, [id]);

    if (rows.length === 0) return res.status(404).send({ success: false, message: "Receipt not found" });

    const receipt = rows[0];
    if (role === 'PATIENT' && receipt.patient_id !== userId)
      return res.status(403).send({ success: false, message: "Access denied" });

    receipt.payment_date = dayjs(receipt.payment_date).format('YYYY-MM-DD HH:mm');

    res.status(200).send({ success: true, data: receipt });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Error fetching receipt", error });
  }
};

module.exports = { createReceipt, getAllReceipts, getReceiptById };
