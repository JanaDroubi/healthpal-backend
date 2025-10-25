// controllers/donationController.js
const db = require('../config/db');
const dayjs = require('dayjs');

/*
 * ============================================================
 *  CREATE DONATION
 *  - Donor or Admin can donate toward a specific invoice.
 *  - Automatically updates invoice status and linked case progress.
 *  - Generates receipt when invoice is fully paid.
 * ============================================================
 */
const createDonation = async (req, res) => {
  try {
    const { invoice_id, amount, payment_method, transaction_ref } = req.body;
    const donor_id = req.user.id;
    const donorRole = req.user.role;

    // Only donors and admins can create donations
    if (!['DONOR', 'ADMIN'].includes(donorRole)) {
      return res.status(403).send({
        success: false,
        message: 'Only donors or admins can create donations.',
      });
    }

    if (!invoice_id || !amount) {
      return res.status(400).send({
        success: false,
        message: 'invoice_id and amount are required.',
      });
    }

    // Verify donor profile exists
    const [donorRows] = await db.query(
      'SELECT user_id FROM donor_profiles WHERE user_id = ?',
      [donor_id]
    );
    if (donorRows.length === 0) {
      return res.status(404).send({
        success: false,
        message: 'Donor profile not found. Please complete your donor profile first.',
      });
    }

    // Verify invoice exists and is not fully paid
    const [[invoice]] = await db.query(`
      SELECT i.*, s.status AS case_status, s.id AS case_id, s.target_amount, s.raised_amount
      FROM invoices i
      JOIN sponsorship_cases s ON s.id = i.case_id
      WHERE i.id = ?
    `, [invoice_id]);

    if (!invoice) {
      return res.status(404).send({ success: false, message: 'Invoice not found.' });
    }

    if (!['UNPAID', 'PARTIALLY_PAID'].includes(invoice.status)) {
      return res.status(400).send({ success: false, message: 'This invoice is already paid or cancelled.' });
    }

    if (invoice.case_status !== 'OPEN') {
      return res.status(400).send({ success: false, message: 'This case is not open for donations.' });
    }

    // Calculate current paid amount
    const [[receiptSum]] = await db.query(`
      SELECT COALESCE(SUM(paid_amount),0) AS total_paid
      FROM receipts WHERE invoice_id = ?
    `, [invoice_id]);

    const alreadyPaid = Number(receiptSum.total_paid);
    const remaining = Number(invoice.amount) - alreadyPaid;

    if (Number(amount) > remaining) {
      return res.status(400).send({
        success: false,
        message: `Donation exceeds remaining invoice balance (${remaining}).`,
      });
    }

    // Insert donation record
    await db.query(`
      INSERT INTO donations (donor_id, invoice_id, amount, payment_method, transaction_ref)
      VALUES (?, ?, ?, ?, ?)`,
      [donor_id, invoice_id, amount, payment_method || 'CASH', transaction_ref || null]
    );

    // Create receipt immediately for the donation
    await db.query(`
      INSERT INTO receipts (invoice_id, paid_amount, payment_method, notes)
      VALUES (?, ?, ?, ?)`,
      [invoice_id, amount, payment_method || 'CASH', 'Auto receipt generated from donation']
    );

    // Update invoice status if fully paid
    const newPaid = alreadyPaid + Number(amount);
    const newStatus = newPaid >= invoice.amount ? 'PAID' : 'PARTIALLY_PAID';

    await db.query(`
      UPDATE invoices 
      SET status = ?, updated_at = NOW() 
      WHERE id = ?`,
      [newStatus, invoice_id]
    );

    // Update case raised amount
    const newRaised = Number(invoice.raised_amount || 0) + Number(amount);
    await db.query(`
      UPDATE sponsorship_cases 
      SET raised_amount = ?, 
          status = CASE 
                     WHEN ? >= target_amount THEN 'FUNDED'
                     ELSE status 
                   END,
          updated_at = NOW()
      WHERE id = ?`,
      [newRaised, newRaised, invoice.case_id]
    );

    res.status(201).send({
      success: true,
      message: 'Donation recorded successfully.',
      data: {
        invoice_id,
        donor_id,
        amount,
        payment_method,
        transaction_ref,
      },
    });

  } catch (error) {
    console.error(error);
    res.status(500).send({
      success: false,
      message: 'Error creating donation.',
      error,
    });
  }
};

/*
 * ============================================================
 *  GET ALL DONATIONS
 *  - Admin or Finance Manager can view all donations.
 *  - Shows related invoice and case info.
 * ============================================================
 */
const getAllDonations = async (req, res) => {
  try {
    const role = req.user.role;

    if (!['ADMIN', 'FINANCE_MANAGER'].includes(role)) {
      return res.status(403).send({
        success: false,
        message: 'Access denied. Only admin or finance staff can view all donations.',
      });
    }

    const [rows] = await db.query(`
      SELECT 
        d.id, d.amount, d.payment_method, d.transaction_ref, d.paid_at,
        dp.user_id AS donor_id, u.full_name AS donor_name, 
        i.id AS invoice_id, i.hospital_name, i.amount AS invoice_amount, i.status AS invoice_status,
        s.id AS case_id, s.title AS case_title, s.status AS case_status
      FROM donations d
      JOIN donor_profiles dp ON d.donor_id = dp.user_id
      JOIN user u ON dp.user_id = u.user_id
      JOIN invoices i ON d.invoice_id = i.id
      JOIN sponsorship_cases s ON i.case_id = s.id
      ORDER BY d.paid_at DESC
    `);

    const formatted = rows.map(r => ({
      ...r,
      paid_at: dayjs(r.paid_at).format('YYYY-MM-DD HH:mm'),
    }));

    res.status(200).send({
      success: true,
      message: 'All donations retrieved successfully.',
      count: formatted.length,
      data: formatted,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({
      success: false,
      message: 'Error fetching donations.',
      error,
    });
  }
};

/*
 * ============================================================
 *  GET DONATIONS BY DONOR
 *  - Donor can view only their own donations.
 *  - Admin or Finance Manager can view for any donor.
 * ============================================================
 */
const getDonationsByDonor = async (req, res) => {
  try {
    const actor = req.user;
    const actorRole = actor.role;
    const actorId = actor.id;

    // allow admin to specify donor id in params
    const targetId = req.params.id || actorId;

    // Donor can only view their own donations
    if (actorRole === 'DONOR' && Number(targetId) !== Number(actorId)) {
      return res.status(403).send({
        success: false,
        message: 'Access denied: donors can only view their own donations.',
      });
    }

    // Ensure donor profile exists
    const [donorRows] = await db.query(
      'SELECT user_id, anonymity_pref FROM donor_profiles WHERE user_id = ?',
      [targetId]
    );
    if (donorRows.length === 0) {
      return res.status(404).send({
        success: false,
        message: 'Donor profile not found.',
      });
    }

    const donorProfile = donorRows[0];

    // Retrieve donations for that donor
    const [rows] = await db.query(`
      SELECT 
        d.id, d.amount, d.payment_method, d.transaction_ref, d.paid_at,
        i.id AS invoice_id, i.hospital_name, i.status AS invoice_status,
        s.title AS case_title, s.status AS case_status
      FROM donations d
      JOIN invoices i ON d.invoice_id = i.id
      JOIN sponsorship_cases s ON i.case_id = s.id
      WHERE d.donor_id = ?
      ORDER BY d.paid_at DESC
    `, [targetId]);

    const formatted = rows.map(r => ({
      ...r,
      paid_at: dayjs(r.paid_at).format('YYYY-MM-DD HH:mm'),
      donor_visible: donorProfile.anonymity_pref === 'PUBLIC',
    }));

    res.status(200).send({
      success: true,
      message:
        actorRole === 'ADMIN'
          ? `Donations of donor ID ${targetId} retrieved successfully.`
          : 'Your donation history retrieved successfully.',
      count: formatted.length,
      data: formatted,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({
      success: false,
      message: 'Error fetching donor donations.',
      error,
    });
  }
};

module.exports = {
  createDonation,
  getAllDonations,
  getDonationsByDonor,
};
