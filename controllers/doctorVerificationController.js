const db = require('../config/db');
const dayjs = require('dayjs');

//  Doctor uploads documents
const uploadDoctorDocuments = async (req, res) => {
  try {
    const { doctor_id } = req.params;
    const { documents } = req.body; 
    // Expected format: [{type: "LICENSE", url: "https://..."}, ...]

    if (!Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one document is required.' });
    }

    const values = documents.map(d => [doctor_id, d.type, d.url]);
    await db.query(
      `INSERT INTO doctor_documents (doctor_id, document_type, document_url)
       VALUES ?`,
      [values]
    );

    await db.query(
      `UPDATE doctor_profiles SET verification_status = 'PENDING' WHERE user_id = ?`,
      [doctor_id]
    );

    res.status(201).json({
      success: true,
      message: 'Documents uploaded successfully and verification status set to PENDING.'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error uploading documents.', error });
  }
};

//  Admin verifies or rejects doctor
const verifyDoctorProfile = async (req, res) => {
  let conn;
  try {
    const { doctor_id } = req.params;
    const { status, notes } = req.body; // status = APPROVED | REJECTED

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be 'APPROVED' or 'REJECTED'."
      });
    }

    const adminId = req.user?.id || null;

    conn = await db.getConnection();
    await conn.beginTransaction();

    //  Fetch current verification status
    const [[doctor]] = await conn.query(
      `SELECT user_id, verification_status 
       FROM doctor_profiles 
       WHERE user_id = ? 
       LIMIT 1`,
      [doctor_id]
    );

    if (!doctor) {
      await conn.rollback();
      return res.status(404).json({
        success: false,
        message: "Doctor profile not found."
      });
    }

    //  Only allow verification if status = 'PENDING'
    if (doctor.verification_status !== 'PENDING') {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: `Doctor is already ${doctor.verification_status.toLowerCase()}. Verification can only be processed if status is 'PENDING'.`
      });
    }

    //  Update doctor profile verification status
    await conn.query(
      `UPDATE doctor_profiles 
       SET verification_status = ?, verified_by = ?, verified = ?, updated_at = NOW()
       WHERE user_id = ?`,
      [
        status,
        adminId,
        status === 'APPROVED' ? 1 : 0,
        doctor_id
      ]
    );

    //  Update user status (activate if approved, deactivate if rejected)
    await conn.query(
      `UPDATE user 
       SET status = ?, updated_at = NOW()
       WHERE user_id = ?`,
      [status === 'APPROVED' ? 'ACTIVE' : 'INACTIVE', doctor_id]
    );

    //  Update document verification status
    await conn.query(
      `UPDATE doctor_documents 
       SET verified = ?
       WHERE doctor_id = ?`,
      [status === 'APPROVED' ? 'APPROVED' : 'REJECTED', doctor_id]
    );

    

    await conn.commit();

    res.status(200).json({
      success: true,
      message: `Doctor verification status updated to ${status}.`,
      doctor_id,
      updated_status: status,
      notes: notes || null
    });

  } catch (error) {
    if (conn) await conn.rollback();
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Error verifying doctor.",
      error
    });
  } finally {
    if (conn) conn.release();
  }
};



// Admin views all pending verifications + uploaded documents
const getPendingVerifications = async (req, res) => {
  try {
    const [doctors] = await db.query(`
      SELECT 
        u.user_id, 
        u.full_name, 
        u.email,
        dp.specialty, 
        dp.license_no, 
        dp.university_name, 
        dp.verification_status,
        dp.created_at
      FROM doctor_profiles dp
      JOIN user u ON dp.user_id = u.user_id
      WHERE dp.verification_status = 'PENDING'
      ORDER BY dp.created_at DESC
    `);

    if (doctors.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        message: "No pending verifications at the moment.",
        data: []
      });
    }

    // Fetch documents for all doctors
    const doctorIds = doctors.map(d => d.user_id);
    const [docs] = await db.query(`
      SELECT doctor_id, document_type, document_url 
      FROM doctor_documents
      WHERE doctor_id IN (?)
    `, [doctorIds]);

    // Group docs by doctor_id
    const docMap = {};
    docs.forEach(doc => {
      if (!docMap[doc.doctor_id]) docMap[doc.doctor_id] = [];
      docMap[doc.doctor_id].push({
        type: doc.document_type,
        url: doc.document_url
      });
    });

    // Merge document data into doctor profiles
    const merged = doctors.map(doc => ({
      ...doc,
      documents: docMap[doc.user_id] || []
    }));

    res.status(200).json({
      success: true,
      count: merged.length,
      data: merged
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving pending verifications.',
      error
    });
  }
};


//  Doctor or Admin views current verification status
const getDoctorVerificationStatus = async (req, res) => {
  try {
    const { doctor_id } = req.params;

    const [[row]] = await db.query(
      `SELECT user_id, verification_status, verified_by, updated_at
       FROM doctor_profiles WHERE user_id = ?`,
      [doctor_id]
    );

    if (!row) return res.status(404).json({ success: false, message: 'Doctor not found.' });

    res.status(200).json({
      success: true,
      data: row
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error fetching verification status.', error });
  }
};

module.exports = {
  uploadDoctorDocuments,
  verifyDoctorProfile,
  getPendingVerifications,
  getDoctorVerificationStatus
};
