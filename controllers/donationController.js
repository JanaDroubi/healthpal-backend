const db = require('../config/db');
const dayjs = require('dayjs');

/*
 * ============================================================
 *  CREATE DONATION
 *  - Donor or Admin can donate to an open sponsorship case.
 *  - Automatically updates case raised amount.
 *  - Marks case as FUNDED if goal is reached.
 * ============================================================
 */
const createDonation = async (req, res) => {
  try {
    const { case_id, amount, payment_method, transaction_ref } = req.body;

    const donor_id = req.user.id;
    const donorRole = req.user.role;

    //  Only donors and admins can create donations
    if (!['DONOR', 'ADMIN'].includes(donorRole)) {
      return res.status(403).send({
        success: false,
        message: 'Only donors or admins can create donations.',
      });
    }

    if (!case_id || !amount) {
      return res.status(400).send({
        success: false,
        message: 'case_id and amount are required.',
      });
    }

    //  Verify donor profile exists
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

    //  Verify sponsorship case exists and is open
    const [caseRows] = await db.query(
      'SELECT id, target_amount, raised_amount, status FROM sponsorship_cases WHERE id = ?',
      [case_id]
    );
    if (caseRows.length === 0) {
      return res.status(404).send({
        success: false,
        message: 'Sponsorship case not found.',
      });
    }

    const sponsorshipCase = caseRows[0];
    if (sponsorshipCase.status !== 'OPEN') {
      return res.status(400).send({
        success: false,
        message: 'This case is not open for donations.',
      });
    }

    //  Ensure donation does not exceed goal
    const newTotal = Number(sponsorshipCase.raised_amount || 0) + Number(amount);
    if (newTotal > sponsorshipCase.target_amount) {
      return res.status(400).send({
        success: false,
        message: 'Donation exceeds the required goal amount.',
      });
    }

    //  Insert donation record
    await db.query(
      `INSERT INTO donations (donor_id, case_id, amount, payment_method, transaction_ref)
       VALUES (?, ?, ?, ?, ?)`,
      [donor_id, case_id, amount, payment_method || 'CASH', transaction_ref || null]
    );

    //  Update case raised amount and status if goal reached
    await db.query(
      `UPDATE sponsorship_cases 
       SET raised_amount = ?, 
           status = CASE WHEN ? >= target_amount THEN 'FUNDED' ELSE status END,
           updated_at = NOW()
       WHERE id = ?`,
      [newTotal, newTotal, case_id]
    );

    res.status(201).send({
      success: true,
      message: 'Donation recorded successfully.',
      data: {
        case_id,
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

/**
 * ============================================================
 *  GET ALL DONATIONS (Admin or Finance Manager)
 *  - Full transparency view for backend dashboard.
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
        s.id AS case_id, s.title, s.status AS case_status
      FROM donations d
      JOIN donor_profiles dp ON d.donor_id = dp.user_id
      JOIN user u ON dp.user_id = u.user_id
      JOIN sponsorship_cases s ON d.case_id = s.id
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

/**
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

    //  Donor can only view their own donations
    if (actorRole === 'DONOR' && Number(targetId) !== Number(actorId)) {
      return res.status(403).send({
        success: false,
        message: 'Access denied: donors can only view their own donations.',
      });
    }

    //  Ensure donor profile exists
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

    //  Retrieve donations for that donor
    const [rows] = await db.query(
      `
      SELECT 
        d.id, d.amount, d.payment_method, d.transaction_ref, d.paid_at,
        s.title, s.status AS case_status
      FROM donations d
      JOIN sponsorship_cases s ON d.case_id = s.id
      WHERE d.donor_id = ?
      ORDER BY d.paid_at DESC
      `,
      [targetId]
    );

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
