const db = require('../config/db');
const dayjs = require('dayjs');

//  CREATE donor profile
const createDonorProfile = async (req, res) => {
  try {
    const { user_id, anonymity_pref, preferred_donation_type } = req.body;

    //  تحقق أن المستخدم ينشئ ملفه فقط
    if (req.user.role === "DONOR" && req.user.id != user_id) {
      return res.status(403).send({
        success: false,
        message: "Access denied: you can only create your own donor profile",
      });
    }

    if (!user_id) {
      return res.status(400).send({ success: false, message: "User ID is required" });
    }

    // تأكد أن اليوزر موجود
    const [userRows] = await db.query("SELECT user_id, role FROM user WHERE user_id = ?", [user_id]);
    if (userRows.length === 0) {
      return res.status(404).send({ success: false, message: "User not found" });
    }

    const user = userRows[0];
    if (user.role !== "DONOR") {
      return res.status(403).send({
        success: false,
        message: "Only users with role 'DONOR' can have a donor profile",
      });
    }

    //  تأكد أنه ما عنده بروفايل مسبقاً
    const [profileExists] = await db.query("SELECT user_id FROM donor_profiles WHERE user_id = ?", [user_id]);
    if (profileExists.length > 0) {
      return res.status(409).send({
        success: false,
        message: "Donor profile already exists for this user",
      });
    }

    //  إنشاء البروفايل
    await db.query(
      `INSERT INTO donor_profiles (user_id, anonymity_pref, preferred_donation_type)
       VALUES (?, ?, ?)`,
      [
        user_id,
        anonymity_pref || 'PUBLIC',
        preferred_donation_type || 'GENERAL'
      ]
    );

    res.status(201).send({
      success: true,
      message: "Donor profile created successfully",
      user_id
    });

  } catch (error) {
    console.error(error);
    res.status(500).send({
      success: false,
      message: "Error creating donor profile",
      error,
    });
  }
};


//  GET all donors (ADMIN only)
const getAllDonors = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        u.user_id,
        u.full_name,
        u.email,
        u.phone,
        u.status,
        dp.anonymity_pref,
        dp.preferred_donation_type,
        dp.created_at,
        dp.updated_at
      FROM donor_profiles dp
      JOIN user u ON u.user_id = dp.user_id
      ORDER BY dp.created_at DESC
    `);

    if (rows.length === 0) {
      return res.status(404).send({ success: false, message: 'No donor profiles found' });
    }

    const formatted = rows.map(row => ({
      ...row,
      created_at: dayjs(row.created_at).format('YYYY-MM-DD HH:mm'),
      updated_at: dayjs(row.updated_at).format('YYYY-MM-DD HH:mm'),
    }));

    res.status(200).send({
      success: true,
      message: 'All donor profiles retrieved successfully',
      count: formatted.length,
      data: formatted
    });

  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: 'Error fetching donors', error });
  }
};


//  GET donor by user_id
const getDonorById = async (req, res) => {
  try {
    const { user_id } = req.params;

    if (req.user.role === "DONOR" && req.user.id != user_id) {
      return res.status(403).send({
        success: false,
        message: "Access denied: you can only view your own profile",
      });
    }

    const [rows] = await db.query(`
      SELECT 
        u.user_id,
        u.full_name,
        u.email,
        u.phone,
        u.status,
        dp.anonymity_pref,
        dp.preferred_donation_type,
        dp.created_at,
        dp.updated_at
      FROM donor_profiles dp
      JOIN user u ON u.user_id = dp.user_id
      WHERE dp.user_id = ?
    `, [user_id]);

    if (rows.length === 0)
      return res.status(404).send({ success: false, message: 'Donor profile not found' });

    const row = rows[0];
    row.created_at = dayjs(row.created_at).format('YYYY-MM-DD HH:mm');
    row.updated_at = dayjs(row.updated_at).format('YYYY-MM-DD HH:mm');

    res.status(200).send({ success: true, data: row });

  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: 'Error fetching donor profile', error });
  }
};


//  UPDATE donor profile
const updateDonorProfile = async (req, res) => {
  try {
    const { user_id } = req.params;
    const fields = { ...req.body };

    // تحقق الصلاحية
    if (req.user.role === "DONOR" && req.user.id != user_id) {
      return res.status(403).send({
        success: false,
        message: "Access denied: you can only update your own profile",
      });
    }

    // لو ما في بيانات مرسلة
    if (Object.keys(fields).length === 0) {
      return res.status(400).send({ success: false, message: 'No fields to update' });
    }

    // نسمح فقط بالتعديل على هذول الحقول
    const allowedFields = ['anonymity_pref', 'preferred_donation_type'];
    const updates = Object.keys(fields).filter(f => allowedFields.includes(f));
    if (updates.length === 0) {
      return res.status(400).send({ success: false, message: 'No valid fields to update' });
    }

    const setClause = updates.map(f => `${f} = ?`).join(', ');
    const values = updates.map(f => fields[f]);

    const [result] = await db.query(
      `UPDATE donor_profiles SET ${setClause} WHERE user_id = ?`,
      [...values, user_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).send({ success: false, message: 'Donor profile not found' });
    }

    res.status(200).send({
      success: true,
      message: 'Donor profile updated successfully'
    });

  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: 'Error updating donor profile', error });
  }
};


//  DELETE donor (Soft delete)
const deleteDonor = async (req, res) => {
  let conn;
  try {
    const { user_id } = req.params;

    if (req.user.role === "DONOR" && req.user.id != user_id) {
      return res.status(403).send({
        success: false,
        message: "Access denied: you can only delete your own account",
      });
    }

    const [[user]] = await db.query(
      "SELECT user_id, role, status FROM user WHERE user_id = ? LIMIT 1",
      [user_id]
    );
    if (!user) return res.status(404).send({ success: false, message: 'User not found' });
    if (user.role !== 'DONOR') {
      return res.status(403).send({ success: false, message: 'Target user is not a DONOR' });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    // حذف الملف الشخصي (اختياري)
    const [delProfile] = await conn.query(
      "DELETE FROM donor_profiles WHERE user_id = ?",
      [user_id]
    );

    // تعطيل المستخدم
    const [updUser] = await conn.query(
      "UPDATE `user` SET status = 'INACTIVE', updated_at = NOW() WHERE user_id = ?",
      [user_id]
    );

    await conn.commit();

    res.status(200).send({
      success: true,
      message: "Donor account deactivated successfully",
      meta: {
        profile_deleted: delProfile.affectedRows,
        user_updated: updUser.affectedRows
      }
    });

  } catch (error) {
    if (conn) { try { await conn.rollback(); } catch (_) {} }
    console.error(error);
    res.status(500).send({ success: false, message: 'Error deactivating donor', error });
  } finally {
    if (conn) conn.release();
  }
};


module.exports = {
  createDonorProfile,
  getAllDonors,
  getDonorById,
  updateDonorProfile,
  deleteDonor
};
