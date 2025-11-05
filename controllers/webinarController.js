const db = require('../config/db');
const dayjs = require('dayjs');



 // Create a new webinar/workshop
 // Roles: CONTENT_EDITOR, ADMIN, DOCTOR (host their own)
 
const createWebinar = async (req, res) => {
  try {
    const {
      title,
      starts_at,
      ends_at,
      is_online,
      location,
      max_attendees,
      description,
      host_user_id
    } = req.body || {};

    const actor = req.user || {};
    const actorRole = String(actor.role || '').trim().toUpperCase();
    const actorId = String(actor.id || '');

    // Validation
    if (!title || !starts_at || !ends_at) {
      return res.status(400).json({
        success: false,
        message: 'Title, starts_at, and ends_at are required.'
      });
    }

    // Parse dates
    const startDate = dayjs(starts_at, ['YYYY-MM-DD HH:mm', 'YYYY-MM-DD HH:mm:ss', dayjs.ISO_8601], true);
    const endDate = dayjs(ends_at, ['YYYY-MM-DD HH:mm', 'YYYY-MM-DD HH:mm:ss', dayjs.ISO_8601], true);

    if (!startDate.isValid() || !endDate.isValid()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD HH:mm or ISO format.'
      });
    }

    if (!startDate.isBefore(endDate)) {
      return res.status(400).json({
        success: false,
        message: 'starts_at must be before ends_at.'
      });
    }

    if (startDate.isBefore(dayjs())) {
      return res.status(400).json({
        success: false,
        message: 'Webinar must be scheduled in the future.'
      });
    }

    // Determine host
    let finalHostId = host_user_id || actorId;

    // If non-admin/non-content_editor tries to assign different host
    if (!['ADMIN', 'CONTENT_EDITOR'].includes(actorRole) && finalHostId !== actorId) {
      return res.status(403).json({
        success: false,
        message: 'You can only create webinars for yourself.'
      });
    }

    // Verify host exists
    if (finalHostId) {
      const [[hostUser]] = await db.query(
        'SELECT user_id, role, status FROM `user` WHERE user_id = ?',
        [finalHostId]
      );

      if (!hostUser) {
        return res.status(404).json({
          success: false,
          message: 'Host user not found.'
        });
      }

      if (String(hostUser.status).toUpperCase() !== 'ACTIVE') {
        return res.status(403).json({
          success: false,
          message: 'Host user is not active.'
        });
      }
    }

    // Validate is_online
    const isOnlineVal = is_online === false || String(is_online).toLowerCase() === 'false' ? 0 : 1;

    // If offline, location is required
    if (isOnlineVal === 0 && (!location || String(location).trim() === '')) {
      return res.status(400).json({
        success: false,
        message: 'Location is required for offline webinars.'
      });
    }

    // Validate max_attendees
    let maxAttendeesVal = null;
    if (max_attendees !== undefined && max_attendees !== null && max_attendees !== '') {
      maxAttendeesVal = parseInt(max_attendees, 10);
      if (isNaN(maxAttendeesVal) || maxAttendeesVal < 1) {
        return res.status(400).json({
          success: false,
          message: 'max_attendees must be a positive integer.'
        });
      }
    }

    // Insert webinar
    const [result] = await db.query(
      `INSERT INTO webinars 
       (host_user_id, title, starts_at, ends_at, is_online, location, max_attendees, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        finalHostId || null,
        title,
        startDate.format('YYYY-MM-DD HH:mm:ss'),
        endDate.format('YYYY-MM-DD HH:mm:ss'),
        isOnlineVal,
        location || null,
        maxAttendeesVal,
        description || null
      ]
    );

    const [[webinar]] = await db.query(
      'SELECT * FROM webinars WHERE id = ?',
      [result.insertId]
    );

    return res.status(201).json({
      success: true,
      message: 'Webinar created successfully.',
      data: webinar
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Error creating webinar.',
      error
    });
  }
};


 // Get all webinars (with filtering)
 // Roles: All authenticated users

const getAllWebinars = async (req, res) => {
  try {
    const { from, to, is_online, upcoming_only } = req.query;
    
    let limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    let offset = Math.max(parseInt(req.query.offset || '0', 10), 0);

    const whereParts = [];
    const params = [];

    // Filter by date range
    if (from) {
      const f = dayjs(from, ['YYYY-MM-DD', dayjs.ISO_8601], true);
      if (!f.isValid()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid from date format.'
        });
      }
      whereParts.push('ends_at >= ?');
      params.push(f.startOf('day').format('YYYY-MM-DD HH:mm:ss'));
    }

    if (to) {
      const t = dayjs(to, ['YYYY-MM-DD', dayjs.ISO_8601], true);
      if (!t.isValid()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid to date format.'
        });
      }
      whereParts.push('starts_at <= ?');
      params.push(t.endOf('day').format('YYYY-MM-DD HH:mm:ss'));
    }

    // Filter upcoming only
    if (upcoming_only === 'true') {
      whereParts.push('starts_at >= NOW()');
    }

    // Filter by online/offline
    if (is_online !== undefined) {
      const onlineVal = is_online === 'true' || is_online === '1' ? 1 : 0;
      whereParts.push('is_online = ?');
      params.push(onlineVal);
    }

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';

    const [rows] = await db.query(
      `SELECT 
         w.*,
         u.full_name AS host_name,
         u.email AS host_email
       FROM webinars w
       LEFT JOIN \`user\` u ON w.host_user_id = u.user_id
       ${whereClause}
       ORDER BY w.starts_at ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Calculate availability for each webinar
    const webinarsWithAvailability = rows.map(w => ({
      ...w,
      is_online: !!w.is_online,
      available_seats: w.max_attendees ? w.max_attendees - w.current_attendees : null,
      is_full: w.max_attendees ? w.current_attendees >= w.max_attendees : false
    }));

    return res.status(200).json({
      success: true,
      count: webinarsWithAvailability.length,
      data: webinarsWithAvailability
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching webinars.',
      error
    });
  }
};


 // Get webinar by ID
 // Roles: All authenticated users
 
const getWebinarById = async (req, res) => {
  try {
    const { webinar_id } = req.params;

    const [[webinar]] = await db.query(
      `SELECT 
         w.*,
         u.full_name AS host_name,
         u.email AS host_email,
         u.phone AS host_phone
       FROM webinars w
       LEFT JOIN \`user\` u ON w.host_user_id = u.user_id
       WHERE w.id = ?`,
      [webinar_id]
    );

    if (!webinar) {
      return res.status(404).json({
        success: false,
        message: 'Webinar not found.'
      });
    }

    // Get registration count
    const [[countRow]] = await db.query(
      'SELECT COUNT(*) as reg_count FROM webinar_registrations WHERE webinar_id = ?',
      [webinar_id]
    );

    const enrichedWebinar = {
      ...webinar,
      is_online: !!webinar.is_online,
      available_seats: webinar.max_attendees ? webinar.max_attendees - webinar.current_attendees : null,
      is_full: webinar.max_attendees ? webinar.current_attendees >= webinar.max_attendees : false,
      registration_count: countRow.reg_count
    };

    return res.status(200).json({
      success: true,
      data: enrichedWebinar
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching webinar.',
      error
    });
  }
};


 // Update webinar
 // Roles: Host, CONTENT_EDITOR, ADMIN
 
const updateWebinar = async (req, res) => {
  try {
    const { webinar_id } = req.params;
    const {
      title,
      starts_at,
      ends_at,
      is_online,
      location,
      max_attendees,
      description
    } = req.body || {};

    const actor = req.user || {};
    const actorRole = String(actor.role || '').trim().toUpperCase();
    const actorId = String(actor.id || '');

    // Check if webinar exists
    const [[webinar]] = await db.query(
      'SELECT * FROM webinars WHERE id = ?',
      [webinar_id]
    );

    if (!webinar) {
      return res.status(404).json({
        success: false,
        message: 'Webinar not found.'
      });
    }

    // Check permissions
    const isHost = String(webinar.host_user_id) === actorId;
    const canEdit = ['ADMIN', 'CONTENT_EDITOR'].includes(actorRole) || isHost;

    if (!canEdit) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to edit this webinar.'
      });
    }

    const updates = [];
    const params = [];

    if (title !== undefined) {
      if (!title || String(title).trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Title cannot be empty.'
        });
      }
      updates.push('title = ?');
      params.push(title);
    }

    if (starts_at !== undefined) {
      const startDate = dayjs(starts_at, ['YYYY-MM-DD HH:mm', 'YYYY-MM-DD HH:mm:ss', dayjs.ISO_8601], true);
      if (!startDate.isValid()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid starts_at format.'
        });
      }
      updates.push('starts_at = ?');
      params.push(startDate.format('YYYY-MM-DD HH:mm:ss'));
    }

    if (ends_at !== undefined) {
      const endDate = dayjs(ends_at, ['YYYY-MM-DD HH:mm', 'YYYY-MM-DD HH:mm:ss', dayjs.ISO_8601], true);
      if (!endDate.isValid()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid ends_at format.'
        });
      }
      updates.push('ends_at = ?');
      params.push(endDate.format('YYYY-MM-DD HH:mm:ss'));
    }

    if (is_online !== undefined) {
      const onlineVal = is_online === false || String(is_online).toLowerCase() === 'false' ? 0 : 1;
      updates.push('is_online = ?');
      params.push(onlineVal);
    }

    if (location !== undefined) {
      updates.push('location = ?');
      params.push(location || null);
    }

    if (max_attendees !== undefined) {
      if (max_attendees === null || max_attendees === '') {
        updates.push('max_attendees = NULL');
      } else {
        const maxVal = parseInt(max_attendees, 10);
        if (isNaN(maxVal) || maxVal < webinar.current_attendees) {
          return res.status(400).json({
            success: false,
            message: `max_attendees cannot be less than current registrations (${webinar.current_attendees}).`
          });
        }
        updates.push('max_attendees = ?');
        params.push(maxVal);
      }
    }

    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update.'
      });
    }

    params.push(webinar_id);

    await db.query(
      `UPDATE webinars SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    const [[updatedWebinar]] = await db.query(
      'SELECT * FROM webinars WHERE id = ?',
      [webinar_id]
    );

    return res.status(200).json({
      success: true,
      message: 'Webinar updated successfully.',
      data: updatedWebinar
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Error updating webinar.',
      error
    });
  }
};


 // Delete webinar
 // Roles: Host, ADMIN
 
const deleteWebinar = async (req, res) => {
  let conn;
  try {
    const { webinar_id } = req.params;

    const actor = req.user || {};
    const actorRole = String(actor.role || '').trim().toUpperCase();
    const actorId = String(actor.id || '');

    const [[webinar]] = await db.query(
      'SELECT * FROM webinars WHERE id = ?',
      [webinar_id]
    );

    if (!webinar) {
      return res.status(404).json({
        success: false,
        message: 'Webinar not found.'
      });
    }

    const isHost = String(webinar.host_user_id) === actorId;
    const canDelete = actorRole === 'ADMIN' || isHost;

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this webinar.'
      });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    // Delete all registrations first
    await conn.query(
      'DELETE FROM webinar_registrations WHERE webinar_id = ?',
      [webinar_id]
    );

    // Delete webinar
    await conn.query(
      'DELETE FROM webinars WHERE id = ?',
      [webinar_id]
    );

    await conn.commit();

    return res.status(200).json({
      success: true,
      message: 'Webinar and all registrations deleted successfully.'
    });

  } catch (error) {
    if (conn) {
      try { await conn.rollback(); } catch (_) {}
    }
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting webinar.',
      error
    });
  } finally {
    if (conn) conn.release();
  }
};


 // Register user for a webinar
 // Roles: All authenticated users
 
const registerForWebinar = async (req, res) => {
  let conn;
  try {
    const { webinar_id } = req.params;
    const actor = req.user || {};
    const actorId = String(actor.id || '');

    if (!actorId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated.'
      });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    // Check if webinar exists and lock it
    const [[webinar]] = await conn.query(
      'SELECT * FROM webinars WHERE id = ? FOR UPDATE',
      [webinar_id]
    );

    if (!webinar) {
      await conn.rollback();
      return res.status(404).json({
        success: false,
        message: 'Webinar not found.'
      });
    }

    // Check if webinar has already started
    if (dayjs(webinar.starts_at).isBefore(dayjs())) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: 'Cannot register for a webinar that has already started.'
      });
    }

    // Check if already registered
    const [[existing]] = await conn.query(
      'SELECT * FROM webinar_registrations WHERE webinar_id = ? AND user_id = ?',
      [webinar_id, actorId]
    );

    if (existing) {
      await conn.rollback();
      return res.status(409).json({
        success: false,
        message: 'You are already registered for this webinar.'
      });
    }

    // Check capacity (trigger will also check, but better to fail fast)
    if (webinar.max_attendees && webinar.current_attendees >= webinar.max_attendees) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: 'This webinar is full.'
      });
    }

    // Insert registration (trigger will update current_attendees)
    await conn.query(
      'INSERT INTO webinar_registrations (webinar_id, user_id) VALUES (?, ?)',
      [webinar_id, actorId]
    );

    await conn.commit();

    const [[updatedWebinar]] = await db.query(
      'SELECT * FROM webinars WHERE id = ?',
      [webinar_id]
    );

    return res.status(201).json({
      success: true,
      message: 'Successfully registered for webinar.',
      data: {
        webinar_id: parseInt(webinar_id),
        user_id: parseInt(actorId),
        current_attendees: updatedWebinar.current_attendees,
        available_seats: updatedWebinar.max_attendees 
          ? updatedWebinar.max_attendees - updatedWebinar.current_attendees 
          : null
      }
    });

  } catch (error) {
    if (conn) {
      try { await conn.rollback(); } catch (_) {}
    }
    
    // Handle trigger error for full webinar
    if (error.sqlMessage && error.sqlMessage.includes('capacity')) {
      return res.status(400).json({
        success: false,
        message: 'This webinar is full.'
      });
    }

    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Error registering for webinar.',
      error
    });
  } finally {
    if (conn) conn.release();
  }
};


 // Unregister from webinar
 // Roles: Registered user, ADMIN
 
const unregisterFromWebinar = async (req, res) => {
  try {
    const { webinar_id } = req.params;
    const actor = req.user || {};
    const actorRole = String(actor.role || '').trim().toUpperCase();
    const actorId = String(actor.id || '');

    const [result] = await db.query(
      'DELETE FROM webinar_registrations WHERE webinar_id = ? AND user_id = ?',
      [webinar_id, actorId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Successfully unregistered from webinar.'
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Error unregistering from webinar.',
      error
    });
  }
};


 // Get registrations for a webinar
 // Roles: Host, ADMIN, CONTENT_EDITOR
 
const getWebinarRegistrations = async (req, res) => {
  try {
    const { webinar_id } = req.params;

    const actor = req.user || {};
    const actorRole = String(actor.role || '').trim().toUpperCase();
    const actorId = String(actor.id || '');

    // Check if webinar exists
    const [[webinar]] = await db.query(
      'SELECT host_user_id FROM webinars WHERE id = ?',
      [webinar_id]
    );

    if (!webinar) {
      return res.status(404).json({
        success: false,
        message: 'Webinar not found.'
      });
    }

    // Check permissions
    const isHost = String(webinar.host_user_id) === actorId;
    const canView = ['ADMIN', 'CONTENT_EDITOR'].includes(actorRole) || isHost;

    if (!canView) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view registrations.'
      });
    }

    const [registrations] = await db.query(
      `SELECT 
         wr.user_id,
         wr.registered_at,
         u.full_name,
         u.email,
         u.phone
       FROM webinar_registrations wr
       JOIN \`user\` u ON wr.user_id = u.user_id
       WHERE wr.webinar_id = ?
       ORDER BY wr.registered_at DESC`,
      [webinar_id]
    );

    return res.status(200).json({
      success: true,
      webinar_id: parseInt(webinar_id),
      count: registrations.length,
      data: registrations
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching registrations.',
      error
    });
  }
};


 // Get user's registered webinars
 // Roles: Self, ADMIN
 
const getMyWebinars = async (req, res) => {
  try {
    const actor = req.user || {};
    const actorId = String(actor.id || '');

    const [webinars] = await db.query(
      `SELECT 
         w.*,
         wr.registered_at,
         u.full_name AS host_name,
         u.email AS host_email
       FROM webinar_registrations wr
       JOIN webinars w ON wr.webinar_id = w.id
       LEFT JOIN \`user\` u ON w.host_user_id = u.user_id
       WHERE wr.user_id = ?
       ORDER BY w.starts_at ASC`,
      [actorId]
    );

    return res.status(200).json({
      success: true,
      count: webinars.length,
      data: webinars.map(w => ({
        ...w,
        is_online: !!w.is_online
      }))
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching user webinars.',
      error
    });
  }
};

module.exports = {
  createWebinar,
  getAllWebinars,
  getWebinarById,
  updateWebinar,
  deleteWebinar,
  registerForWebinar,
  unregisterFromWebinar,
  getWebinarRegistrations,
  getMyWebinars
};