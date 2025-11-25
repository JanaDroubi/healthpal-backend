const db = require('../config/db');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const axios = require('axios');
dayjs.extend(customParseFormat);




async function ensurePatientExists(patientId) {
  const [[row]] = await db.query(
    'SELECT pp.user_id, u.status FROM patient_profiles pp JOIN `user` u ON pp.user_id = u.user_id WHERE pp.user_id = ? LIMIT 1',
    [patientId]
  );
  if (!row) return { ok: false, code: 404, msg: 'Patient not found.' };
  if (String(row.status || '').toUpperCase() !== 'ACTIVE')
    return { ok: false, code: 403, msg: 'Patient is not ACTIVE.' };
  return { ok: true };
}

async function ensureDoctorExists(doctorId) {
  const [[row]] = await db.query(
    'SELECT user_id, role, status FROM `user` WHERE user_id = ? LIMIT 1',
    [doctorId]
  );
  if (!row) return { ok: false, code: 404, msg: 'Doctor not found.' };
  if (String(row.role || '').toUpperCase() !== 'DOCTOR')
    return { ok: false, code: 403, msg: 'User is not a DOCTOR.' };
  if (String(row.status || '').toUpperCase() !== 'ACTIVE')
    return { ok: false, code: 403, msg: 'Doctor is not ACTIVE.' };
  return { ok: true };
}

function calculateNextDoseDate(vaccinationDate, intervalDays) {
  if (!intervalDays) return null;
  return dayjs(vaccinationDate).add(intervalDays, 'day').format('YYYY-MM-DD');
}

// ===== CRUD Operations =====

// Create Vaccination Record
const createVaccinationRecord = async (req, res) => {
  let conn;
  try {
    const {
      patient_id,
      vaccine_id,
      dose_number,
      vaccination_date,
      administered_by,
      batch_number,
      location,
      notes,
      status
    } = req.body || {};

    const actor = req.user || {};
    const actorRole = String(actor.role || '').trim().toUpperCase();

    // Validation
    if (!patient_id || !vaccine_id || !dose_number || !vaccination_date) {
      return res.status(400).json({
        success: false,
        message: 'patient_id, vaccine_id, dose_number, and vaccination_date are required.'
      });
    }

    // Check patient exists
    const okPatient = await ensurePatientExists(patient_id);
    if (!okPatient.ok) {
      return res.status(okPatient.code).json({ success: false, message: okPatient.msg });
    }

    // Check vaccine exists
    const [[vaccine]] = await db.query(
      'SELECT * FROM vaccines WHERE id = ? LIMIT 1',
      [vaccine_id]
    );
    if (!vaccine) {
      return res.status(404).json({ success: false, message: 'Vaccine not found.' });
    }

    // Validate dose number
    if (dose_number > vaccine.doses_required) {
      return res.status(400).json({
        success: false,
        message: `This vaccine requires only ${vaccine.doses_required} dose(s).`
      });
    }

    // Check if administered_by is valid doctor
    if (administered_by) {
      const okDoctor = await ensureDoctorExists(administered_by);
      if (!okDoctor.ok) {
        return res.status(okDoctor.code).json({ success: false, message: okDoctor.msg });
      }
    }

    // Parse vaccination date
    const vacDate = dayjs(vaccination_date, ['YYYY-MM-DD', 'DD/MM/YYYY'], true);
    if (!vacDate.isValid()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vaccination_date format. Use YYYY-MM-DD or DD/MM/YYYY.'
      });
    }

    // Calculate next dose date
    let nextDoseDate = null;
    if (dose_number < vaccine.doses_required && vaccine.interval_days) {
      nextDoseDate = calculateNextDoseDate(vacDate.format('YYYY-MM-DD'), vaccine.interval_days);
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    // Insert vaccination record
    const [ins] = await conn.query(
      `INSERT INTO vaccination_records 
       (patient_id, vaccine_id, dose_number, vaccination_date, administered_by, 
        batch_number, location, next_dose_due, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        patient_id,
        vaccine_id,
        dose_number,
        vacDate.format('YYYY-MM-DD'),
        administered_by || null,
        batch_number || null,
        location || null,
        nextDoseDate,
        notes || null,
        status || 'COMPLETED'
      ]
    );

    const recordId = ins.insertId;

    // Create reminder if next dose is due
    if (nextDoseDate) {
      const reminderDate = dayjs(nextDoseDate).subtract(7, 'day').format('YYYY-MM-DD');
      await conn.query(
        `INSERT INTO vaccination_reminders 
         (vaccination_record_id, patient_id, reminder_date)
         VALUES (?, ?, ?)`,
        [recordId, patient_id, reminderDate]
      );
    }

    await conn.commit();

    // Fetch created record with details
    const [[record]] = await db.query(
      `SELECT 
         vr.*,
         v.name AS vaccine_name,
         v.manufacturer,
         v.doses_required,
         u.full_name AS patient_name,
         d.full_name AS doctor_name
       FROM vaccination_records vr
       JOIN vaccines v ON vr.vaccine_id = v.id
       JOIN user u ON vr.patient_id = u.user_id
       LEFT JOIN user d ON vr.administered_by = d.user_id
       WHERE vr.id = ?`,
      [recordId]
    );

    return res.status(201).json({
      success: true,
      message: 'Vaccination record created successfully.',
      data: record
    });

  } catch (error) {
    if (conn) { try { await conn.rollback(); } catch (_) {} }
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Error creating vaccination record.',
      error
    });
  } finally {
    if (conn) conn.release();
  }
};

// Get Patient Vaccination History
const getPatientVaccinationHistory = async (req, res) => {
  try {
    const { patient_id } = req.params;
    
    const actor = req.user || {};
    const actorRole = String(actor.role || '').trim().toUpperCase();
    const actorId = String(actor.id || '');

    if (actorRole === 'PATIENT' && actorId !== String(patient_id)) {
      return res.status(403).json({
        success: false,
        message: 'Patients can only view their own vaccination records.'
      });
    }

    const okPatient = await ensurePatientExists(patient_id);
    if (!okPatient.ok) {
      return res.status(okPatient.code).json({ success: false, message: okPatient.msg });
    }

    const [records] = await db.query(
      `SELECT 
         vr.*,
         v.name AS vaccine_name,
         v.manufacturer,
         v.doses_required,
         v.interval_days,
         d.full_name AS doctor_name
       FROM vaccination_records vr
       JOIN vaccines v ON vr.vaccine_id = v.id
       LEFT JOIN user d ON vr.administered_by = d.user_id
       WHERE vr.patient_id = ?
       ORDER BY vr.vaccination_date DESC`,
      [patient_id]
    );

    return res.status(200).json({
      success: true,
      count: records.length,
      data: records
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching vaccination history.',
      error
    });
  }
};

// Get Upcoming Vaccinations (Next Doses Due)
const getUpcomingVaccinations = async (req, res) => {
  try {
    const { patient_id } = req.params;
    
    const actor = req.user || {};
    const actorRole = String(actor.role || '').trim().toUpperCase();
    const actorId = String(actor.id || '');

    if (actorRole === 'PATIENT' && actorId !== String(patient_id)) {
      return res.status(403).json({
        success: false,
        message: 'Patients can only view their own upcoming vaccinations.'
      });
    }

    const okPatient = await ensurePatientExists(patient_id);
    if (!okPatient.ok) {
      return res.status(okPatient.code).json({ success: false, message: okPatient.msg });
    }

    const [upcoming] = await db.query(
      `SELECT 
         vr.*,
         v.name AS vaccine_name,
         v.manufacturer,
         v.doses_required,
         (vr.dose_number + 1) AS next_dose_number
       FROM vaccination_records vr
       JOIN vaccines v ON vr.vaccine_id = v.id
       WHERE vr.patient_id = ?
         AND vr.next_dose_due IS NOT NULL
         AND vr.next_dose_due >= CURDATE()
         AND vr.dose_number < v.doses_required
       ORDER BY vr.next_dose_due ASC`,
      [patient_id]
    );

    return res.status(200).json({
      success: true,
      count: upcoming.length,
      data: upcoming
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching upcoming vaccinations.',
      error
    });
  }
};

// Get Vaccination Reminders
const getVaccinationReminders = async (req, res) => {
  try {
    const { patient_id } = req.params;
    
    const actor = req.user || {};
    const actorRole = String(actor.role || '').trim().toUpperCase();
    const actorId = String(actor.id || '');

    if (actorRole === 'PATIENT' && actorId !== String(patient_id)) {
      return res.status(403).json({
        success: false,
        message: 'Patients can only view their own reminders.'
      });
    }

    const [reminders] = await db.query(
      `SELECT 
         vrem.*,
         vr.dose_number,
         vr.next_dose_due,
         v.name AS vaccine_name
       FROM vaccination_reminders vrem
       JOIN vaccination_records vr ON vrem.vaccination_record_id = vr.id
       JOIN vaccines v ON vr.vaccine_id = v.id
       WHERE vrem.patient_id = ?
         AND vrem.reminder_sent = 0
         AND vrem.reminder_date >= CURDATE()
       ORDER BY vrem.reminder_date ASC`,
      [patient_id]
    );

    return res.status(200).json({
      success: true,
      count: reminders.length,
      data: reminders
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching reminders.',
      error
    });
  }
};

// Generate Vaccination Certificate
const generateVaccinationCertificate = async (req, res) => {
  try {
    const { patient_id, vaccine_id } = req.params;
    
    const actor = req.user || {};
    const actorRole = String(actor.role || '').trim().toUpperCase();
    const actorId = String(actor.id || '');

    if (actorRole === 'PATIENT' && actorId !== String(patient_id)) {
      return res.status(403).json({
        success: false,
        message: 'Patients can only generate their own certificates.'
      });
    }

    // Get patient info
    const [[patient]] = await db.query(
      `SELECT u.full_name, u.email, pp.dob, pp.gender
       FROM user u
       JOIN patient_profiles pp ON u.user_id = pp.user_id
       WHERE u.user_id = ?`,
      [patient_id]
    );

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found.' });
    }

    // Get vaccination records
    const [records] = await db.query(
      `SELECT 
         vr.*,
         v.name AS vaccine_name,
         v.manufacturer,
         v.doses_required,
         d.full_name AS doctor_name
       FROM vaccination_records vr
       JOIN vaccines v ON vr.vaccine_id = v.id
       LEFT JOIN user d ON vr.administered_by = d.user_id
       WHERE vr.patient_id = ? AND vr.vaccine_id = ?
         AND vr.status = 'COMPLETED'
       ORDER BY vr.vaccination_date ASC`,
      [patient_id, vaccine_id]
    );

    if (records.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No completed vaccination records found for this vaccine.'
      });
    }

    const vaccine = records[0];
    const isFullyVaccinated = records.length >= vaccine.doses_required;

    const certificate = {
      certificate_id: `CERT-${patient_id}-${vaccine_id}-${Date.now()}`,
      issue_date: dayjs().format('YYYY-MM-DD'),
      patient: {
        name: patient.full_name,
        email: patient.email,
        dob: patient.dob ? dayjs(patient.dob).format('YYYY-MM-DD') : null,
        gender: patient.gender
      },
      vaccine: {
        name: vaccine.vaccine_name,
        manufacturer: vaccine.manufacturer
      },
      vaccination_details: records.map(r => ({
        dose_number: r.dose_number,
        date: dayjs(r.vaccination_date).format('YYYY-MM-DD'),
        administered_by: r.doctor_name || 'N/A',
        batch_number: r.batch_number || 'N/A',
        location: r.location || 'N/A'
      })),
      status: isFullyVaccinated ? 'FULLY VACCINATED' : 'PARTIALLY VACCINATED',
      doses_completed: `${records.length}/${vaccine.doses_required}`
    };

    return res.status(200).json({
      success: true,
      message: 'Vaccination certificate generated successfully.',
      data: certificate
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Error generating certificate.',
      error
    });
  }
};

// Update Vaccination Record
const updateVaccinationRecord = async (req, res) => {
  try {
    const { record_id } = req.params;
    const updates = req.body || {};

    const actor = req.user || {};
    const actorRole = String(actor.role || '').trim().toUpperCase();

    // Only doctors and admins can update records
    if (!['DOCTOR', 'ADMIN'].includes(actorRole)) {
      return res.status(403).json({
        success: false,
        message: 'Only doctors and admins can update vaccination records.'
      });
    }

    const [[record]] = await db.query(
      'SELECT * FROM vaccination_records WHERE id = ?',
      [record_id]
    );

    if (!record) {
      return res.status(404).json({ success: false, message: 'Vaccination record not found.' });
    }

    const allowedFields = ['vaccination_date', 'batch_number', 'location', 'notes', 'status'];
    const updateFields = {};

    for (const key of Object.keys(updates)) {
      if (allowedFields.includes(key)) {
        updateFields[key] = updates[key];
      }
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update.'
      });
    }

    // Handle date formatting
    if (updateFields.vaccination_date) {
      const vacDate = dayjs(updateFields.vaccination_date, ['YYYY-MM-DD', 'DD/MM/YYYY'], true);
      if (!vacDate.isValid()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid vaccination_date format.'
        });
      }
      updateFields.vaccination_date = vacDate.format('YYYY-MM-DD');
    }

    const setClause = Object.keys(updateFields).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updateFields), record_id];

    await db.query(
      `UPDATE vaccination_records SET ${setClause} WHERE id = ?`,
      values
    );

    const [[updated]] = await db.query(
      `SELECT 
         vr.*,
         v.name AS vaccine_name,
         v.manufacturer,
         d.full_name AS doctor_name
       FROM vaccination_records vr
       JOIN vaccines v ON vr.vaccine_id = v.id
       LEFT JOIN user d ON vr.administered_by = d.user_id
       WHERE vr.id = ?`,
      [record_id]
    );

    return res.status(200).json({
      success: true,
      message: 'Vaccination record updated successfully.',
      data: updated
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Error updating vaccination record.',
      error
    });
  }
};

// Delete Vaccination Record
const deleteVaccinationRecord = async (req, res) => {
  let conn;
  try {
    const { record_id } = req.params;

    const actor = req.user || {};
    const actorRole = String(actor.role || '').trim().toUpperCase();

    // Only admins can delete records
    if (actorRole !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can delete vaccination records.'
      });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    // Delete associated reminders first
    await conn.query(
      'DELETE FROM vaccination_reminders WHERE vaccination_record_id = ?',
      [record_id]
    );

    // Delete the record
    const [result] = await conn.query(
      'DELETE FROM vaccination_records WHERE id = ?',
      [record_id]
    );

    if (result.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({
        success: false,
        message: 'Vaccination record not found.'
      });
    }

    await conn.commit();

    return res.status(200).json({
      success: true,
      message: 'Vaccination record deleted successfully.'
    });

  } catch (error) {
    if (conn) { try { await conn.rollback(); } catch (_) {} }
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting vaccination record.',
      error
    });
  } finally {
    if (conn) conn.release();
  }
};

// ===== Vaccine Management (CRUD for vaccines table) =====

// Get All Vaccines
const getAllVaccines = async (req, res) => {
  try {
    const [vaccines] = await db.query(
      'SELECT * FROM vaccines ORDER BY name ASC'
    );

    return res.status(200).json({
      success: true,
      count: vaccines.length,
      data: vaccines
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching vaccines.',
      error
    });
  }
};

// Create Vaccine (Admin only)
const createVaccine = async (req, res) => {
  try {
    const { name, manufacturer, description, doses_required, interval_days } = req.body || {};

    const actor = req.user || {};
    const actorRole = String(actor.role || '').trim().toUpperCase();

    if (actorRole !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can create vaccines.'
      });
    }

    if (!name || !doses_required) {
      return res.status(400).json({
        success: false,
        message: 'name and doses_required are required.'
      });
    }

    const [ins] = await db.query(
      `INSERT INTO vaccines (name, manufacturer, description, doses_required, interval_days)
       VALUES (?, ?, ?, ?, ?)`,
      [name, manufacturer || null, description || null, doses_required, interval_days || null]
    );

    const [[vaccine]] = await db.query('SELECT * FROM vaccines WHERE id = ?', [ins.insertId]);

    return res.status(201).json({
      success: true,
      message: 'Vaccine created successfully.',
      data: vaccine
    });

  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'A vaccine with this name already exists.'
      });
    }
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Error creating vaccine.',
      error
    });
  }
};

// ===== External API Integration =====

// Search Vaccines using External API
const searchVaccinesExternal = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Query parameter is required.'
      });
    }

    // Using OpenFDA API for vaccine information
    // This is a free, public API from the US FDA
    const response = await axios.get('https://api.fda.gov/drug/label.json', {
      params: {
        search: `openfda.brand_name:"${query}"`,
        limit: 10
      },
      timeout: 10000
    });

    const results = response.data.results || [];
    const vaccines = results.map(item => ({
      brand_name: item.openfda?.brand_name?.[0] || 'N/A',
      generic_name: item.openfda?.generic_name?.[0] || 'N/A',
      manufacturer: item.openfda?.manufacturer_name?.[0] || 'N/A',
      description: item.description?.[0] || 'N/A',
      indications: item.indications_and_usage?.[0] || 'N/A'
    }));

    return res.status(200).json({
      success: true,
      count: vaccines.length,
      data: vaccines,
      source: 'OpenFDA API'
    });

  } catch (error) {
    console.error('External API Error:', error.message);
    
    if (error.response?.status === 404) {
      return res.status(404).json({
        success: false,
        message: 'No vaccines found matching your query.'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Error fetching vaccine information from external API.',
      error: error.message
    });
  }
};

// Get Vaccine Safety Information from External API
const getVaccineSafetyInfo = async (req, res) => {
  try {
    const { vaccine_name } = req.params;

    // Using OpenFDA API for adverse events
    const response = await axios.get('https://api.fda.gov/drug/event.json', {
      params: {
        search: `patient.drug.medicinalproduct:"${vaccine_name}"`,
        count: 'patient.reaction.reactionmeddrapt.exact',
        limit: 10
      },
      timeout: 10000
    });

    const reactions = response.data.results || [];

    return res.status(200).json({
      success: true,
      vaccine_name,
      common_reactions: reactions.map(r => ({
        reaction: r.term,
        count: r.count
      })),
      source: 'OpenFDA Adverse Events API',
      disclaimer: 'This data is for informational purposes only. Consult healthcare professionals for medical advice.'
    });

  } catch (error) {
    console.error('External API Error:', error.message);
    
    return res.status(500).json({
      success: false,
      message: 'Error fetching vaccine safety information.',
      error: error.message
    });
  }
};

module.exports = {
  createVaccinationRecord,
  getPatientVaccinationHistory,
  getUpcomingVaccinations,
  getVaccinationReminders,
  generateVaccinationCertificate,
  updateVaccinationRecord,
  deleteVaccinationRecord,
  getAllVaccines,
  createVaccine,
  searchVaccinesExternal,
  getVaccineSafetyInfo
};