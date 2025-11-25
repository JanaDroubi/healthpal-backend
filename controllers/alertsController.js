const db = require('../config/db');
const dayjs = require('dayjs');



 // Create a new public health alert ALERT_MANAGER & ADMIN
const createAlert = async (req, res) => {
  try {
    const {
      title,
      message,
      alert_type,
      severity,
      target_cities,
      target_all,
      expires_at
    } = req.body || {};

    const actor = req.user || {};
    const actorId = String(actor.id || '');

    // Validation
    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Title and message are required.'
      });
    }

    // Validate alert_type
    const validTypes = [
      'DISEASE_OUTBREAK',
      'AIR_QUALITY',
      'WATER_SAFETY',
      'URGENT_MEDICAL_NEED',
      'EMERGENCY',
      'GENERAL'
    ];
    const typeVal = alert_type ? String(alert_type).toUpperCase() : 'GENERAL';
    
    if (!validTypes.includes(typeVal)) {
      return res.status(400).json({
        success: false,
        message: `Invalid alert_type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    // Validate severity
    const validSeverities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const severityVal = severity ? String(severity).toUpperCase() : 'MEDIUM';
    
    if (!validSeverities.includes(severityVal)) {
      return res.status(400).json({
        success: false,
        message: `Invalid severity. Must be one of: ${validSeverities.join(', ')}`
      });
    }


    let targetCitiesJSON = null;
    const targetAllVal = target_all === false || String(target_all).toLowerCase() === 'false' ? 0 : 1;

    if (targetAllVal === 0 && target_cities) {
      try {
        if (typeof target_cities === 'string') {
          const citiesArray = target_cities.split(',').map(c => c.trim()).filter(c => c);
          targetCitiesJSON = JSON.stringify(citiesArray);
        } else if (Array.isArray(target_cities)) {
          targetCitiesJSON = JSON.stringify(target_cities);
        } else {
          targetCitiesJSON = JSON.stringify([target_cities]);
        }
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: 'Invalid target_cities format. Use array or comma-separated string.'
        });
      }
    }

    // Parse expires_at if provided
    let expiresAtISO = null;
    if (expires_at) {
      const parsed = dayjs(expires_at, ['YYYY-MM-DD HH:mm', 'YYYY-MM-DD HH:mm:ss', dayjs.ISO_8601], true);
      if (!parsed.isValid()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid expires_at format. Use YYYY-MM-DD HH:mm or ISO format.'
        });
      }
      
      if (parsed.isBefore(dayjs())) {
        return res.status(400).json({
          success: false,
          message: 'expires_at must be in the future.'
        });
      }
      
      expiresAtISO = parsed.format('YYYY-MM-DD HH:mm:ss');
    }

    // Insert alert
    const [result] = await db.query(
      `INSERT INTO public_health_alerts 
       (title, message, alert_type, severity, target_cities, target_all, created_by, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        message,
        typeVal,
        severityVal,
        targetCitiesJSON,
        targetAllVal,
        actorId,
        expiresAtISO
      ]
    );

    // Fetch created alert with creator info
    const [[alert]] = await db.query(
      `SELECT 
         a.*,
         u.full_name AS creator_name,
         u.email AS creator_email
       FROM public_health_alerts a
       LEFT JOIN \`user\` u ON a.created_by = u.user_id
       WHERE a.id = ?`,
      [result.insertId]
    );

    return res.status(201).json({
      success: true,
      message: 'Public health alert created successfully.',
      data: {
        ...alert,
        target_cities: alert.target_cities ? JSON.parse(alert.target_cities) : null
      }
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Error creating alert.',
      error
    });
  }
};


 // Get all active alerts for public

const getActiveAlerts = async (req, res) => {
  try {
    const { alert_type, severity, city } = req.query;
    
    let limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    let offset = Math.max(parseInt(req.query.offset || '0', 10), 0);

    const whereParts = [];
    const params = [];

    // Only active and non-expired alerts
    whereParts.push('a.status = ?');
    params.push('ACTIVE');

    whereParts.push('(a.expires_at IS NULL OR a.expires_at > NOW())');

    // Filter by alert_type
    if (alert_type) {
      whereParts.push('a.alert_type = ?');
      params.push(String(alert_type).toUpperCase());
    }

    // Filter by severity
    if (severity) {
      whereParts.push('a.severity = ?');
      params.push(String(severity).toUpperCase());
    }

    // Filter by city
    if (city) {
      whereParts.push('(a.target_all = 1 OR a.target_cities LIKE ?)');
      params.push(`%"${city}"%`);
    }

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';

    const [rows] = await db.query(
      `SELECT 
         a.*,
         u.full_name AS creator_name
       FROM public_health_alerts a
       LEFT JOIN \`user\` u ON a.created_by = u.user_id
       ${whereClause}
       ORDER BY 
         FIELD(a.severity, 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'),
         a.issued_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Parse target_cities JSON
    const alertsWithParsedCities = rows.map(alert => ({
      ...alert,
      target_cities: alert.target_cities ? JSON.parse(alert.target_cities) : null,
      target_all: !!alert.target_all
    }));

    return res.status(200).json({
      success: true,
      count: alertsWithParsedCities.length,
      data: alertsWithParsedCities
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching alerts.',
      error
    });
  }
};


 // Get all alerts (including inactive) - Admin & Alert Manager 

const getAllAlerts = async (req, res) => {
  try {
    const { status, alert_type, severity } = req.query;
    
    let limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
    let offset = Math.max(parseInt(req.query.offset || '0', 10), 0);

    const whereParts = [];
    const params = [];

    if (status) {
      whereParts.push('a.status = ?');
      params.push(String(status).toUpperCase());
    }

    if (alert_type) {
      whereParts.push('a.alert_type = ?');
      params.push(String(alert_type).toUpperCase());
    }

    if (severity) {
      whereParts.push('a.severity = ?');
      params.push(String(severity).toUpperCase());
    }

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';

    const [rows] = await db.query(
      `SELECT 
         a.*,
         u.full_name AS creator_name,
         u.email AS creator_email,
         (SELECT COUNT(*) FROM alert_acknowledgements WHERE alert_id = a.id) AS acknowledgement_count
       FROM public_health_alerts a
       LEFT JOIN \`user\` u ON a.created_by = u.user_id
       ${whereClause}
       ORDER BY a.issued_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const alertsWithParsedCities = rows.map(alert => ({
      ...alert,
      target_cities: alert.target_cities ? JSON.parse(alert.target_cities) : null,
      target_all: !!alert.target_all
    }));

    return res.status(200).json({
      success: true,
      count: alertsWithParsedCities.length,
      data: alertsWithParsedCities
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching all alerts.',
      error
    });
  }
};


 // Get alert by ID

const getAlertById = async (req, res) => {
  try {
    const { alert_id } = req.params;

    const [[alert]] = await db.query(
      `SELECT 
         a.*,
         u.full_name AS creator_name,
         u.email AS creator_email,
         (SELECT COUNT(*) FROM alert_acknowledgements WHERE alert_id = a.id) AS acknowledgement_count
       FROM public_health_alerts a
       LEFT JOIN \`user\` u ON a.created_by = u.user_id
       WHERE a.id = ?`,
      [alert_id]
    );

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found.'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        ...alert,
        target_cities: alert.target_cities ? JSON.parse(alert.target_cities) : null,
        target_all: !!alert.target_all
      }
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching alert.',
      error
    });
  }
};


 // Update alert

const updateAlert = async (req, res) => {
  try {
    const { alert_id } = req.params;
    const {
      title,
      message,
      alert_type,
      severity,
      target_cities,
      target_all,
      expires_at,
      status
    } = req.body || {};

    const actor = req.user || {};
    const actorRole = String(actor.role || '').trim().toUpperCase();
    const actorId = String(actor.id || '');

    // Check if alert exists
    const [[existingAlert]] = await db.query(
      'SELECT * FROM public_health_alerts WHERE id = ?',
      [alert_id]
    );

    if (!existingAlert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found.'
      });
    }

    // Check permissions (creator, alert manager, or admin)
    const isCreator = String(existingAlert.created_by) === actorId;
    const canEdit = ['ADMIN', 'ALERT_MANAGER'].includes(actorRole) || isCreator;

    if (!canEdit) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to edit this alert.'
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

    if (message !== undefined) {
      if (!message || String(message).trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Message cannot be empty.'
        });
      }
      updates.push('message = ?');
      params.push(message);
    }

    if (alert_type !== undefined) {
      const validTypes = ['DISEASE_OUTBREAK', 'AIR_QUALITY', 'WATER_SAFETY', 'URGENT_MEDICAL_NEED', 'EMERGENCY', 'GENERAL'];
      const typeVal = String(alert_type).toUpperCase();
      if (!validTypes.includes(typeVal)) {
        return res.status(400).json({
          success: false,
          message: `Invalid alert_type. Must be one of: ${validTypes.join(', ')}`
        });
      }
      updates.push('alert_type = ?');
      params.push(typeVal);
    }

    if (severity !== undefined) {
      const validSeverities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
      const sevVal = String(severity).toUpperCase();
      if (!validSeverities.includes(sevVal)) {
        return res.status(400).json({
          success: false,
          message: `Invalid severity. Must be one of: ${validSeverities.join(', ')}`
        });
      }
      updates.push('severity = ?');
      params.push(sevVal);
    }

    if (target_all !== undefined) {
      const targetAllVal = target_all === false || String(target_all).toLowerCase() === 'false' ? 0 : 1;
      updates.push('target_all = ?');
      params.push(targetAllVal);
    }

    if (target_cities !== undefined) {
      if (target_cities === null || target_cities === '') {
        updates.push('target_cities = NULL');
      } else {
        try {
          let targetCitiesJSON;
          if (typeof target_cities === 'string') {
            const citiesArray = target_cities.split(',').map(c => c.trim()).filter(c => c);
            targetCitiesJSON = JSON.stringify(citiesArray);
          } else if (Array.isArray(target_cities)) {
            targetCitiesJSON = JSON.stringify(target_cities);
          } else {
            targetCitiesJSON = JSON.stringify([target_cities]);
          }
          updates.push('target_cities = ?');
          params.push(targetCitiesJSON);
        } catch (e) {
          return res.status(400).json({
            success: false,
            message: 'Invalid target_cities format.'
          });
        }
      }
    }

    if (expires_at !== undefined) {
      if (expires_at === null || expires_at === '') {
        updates.push('expires_at = NULL');
      } else {
        const parsed = dayjs(expires_at, ['YYYY-MM-DD HH:mm', 'YYYY-MM-DD HH:mm:ss', dayjs.ISO_8601], true);
        if (!parsed.isValid()) {
          return res.status(400).json({
            success: false,
            message: 'Invalid expires_at format. Use YYYY-MM-DD HH:mm or ISO format.'
          });
        }
        updates.push('expires_at = ?');
        params.push(parsed.format('YYYY-MM-DD HH:mm:ss'));
      }
    }

    if (status !== undefined) {
      const validStatuses = ['ACTIVE', 'RESOLVED', 'CANCELLED'];
      const statusVal = String(status).toUpperCase();
      if (!validStatuses.includes(statusVal)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
      }
      updates.push('status = ?');
      params.push(statusVal);

      // If status is RESOLVED, set resolved_at
      if (statusVal === 'RESOLVED') {
        updates.push('resolved_at = NOW()');
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update.'
      });
    }

    params.push(alert_id);

    await db.query(
      `UPDATE public_health_alerts SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    const [[updatedAlert]] = await db.query(
      `SELECT 
         a.*,
         u.full_name AS creator_name
       FROM public_health_alerts a
       LEFT JOIN \`user\` u ON a.created_by = u.user_id
       WHERE a.id = ?`,
      [alert_id]
    );

    return res.status(200).json({
      success: true,
      message: 'Alert updated successfully.',
      data: {
        ...updatedAlert,
        target_cities: updatedAlert.target_cities ? JSON.parse(updatedAlert.target_cities) : null,
        target_all: !!updatedAlert.target_all
      }
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Error updating alert.',
      error
    });
  }
};


 // Delete alert
const deleteAlert = async (req, res) => {
  try {
    const { alert_id } = req.params;

    const [result] = await db.query(
      'DELETE FROM public_health_alerts WHERE id = ?',
      [alert_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Alert deleted successfully.'
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting alert.',
      error
    });
  }
};


 //Acknowledge an alert (mark as seen by user)
const acknowledgeAlert = async (req, res) => {
  try {
    const { alert_id } = req.params;
    const actor = req.user || {};
    const actorId = String(actor.id || '');

    // Check if alert exists
    const [[alert]] = await db.query(
      'SELECT id FROM public_health_alerts WHERE id = ?',
      [alert_id]
    );

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found.'
      });
    }

    // Check if already acknowledged
    const [[existing]] = await db.query(
      'SELECT * FROM alert_acknowledgements WHERE alert_id = ? AND user_id = ?',
      [alert_id, actorId]
    );

    if (existing) {
      return res.status(200).json({
        success: true,
        message: 'Alert already acknowledged.',
        data: {
          alert_id: parseInt(alert_id),
          user_id: parseInt(actorId),
          acknowledged_at: existing.acknowledged_at
        }
      });
    }

    // Insert acknowledgement
    await db.query(
      'INSERT INTO alert_acknowledgements (alert_id, user_id) VALUES (?, ?)',
      [alert_id, actorId]
    );

    return res.status(201).json({
      success: true,
      message: 'Alert acknowledged successfully.',
      data: {
        alert_id: parseInt(alert_id),
        user_id: parseInt(actorId)
      }
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Error acknowledging alert.',
      error
    });
  }
};


 // Get user's acknowledged alerts

const getMyAcknowledgedAlerts = async (req, res) => {
  try {
    const actor = req.user || {};
    const actorId = String(actor.id || '');

    const [alerts] = await db.query(
      `SELECT 
         a.*,
         aa.acknowledged_at,
         u.full_name AS creator_name
       FROM alert_acknowledgements aa
       JOIN public_health_alerts a ON aa.alert_id = a.id
       LEFT JOIN \`user\` u ON a.created_by = u.user_id
       WHERE aa.user_id = ?
       ORDER BY aa.acknowledged_at DESC`,
      [actorId]
    );

    return res.status(200).json({
      success: true,
      count: alerts.length,
      data: alerts.map(alert => ({
        ...alert,
        target_cities: alert.target_cities ? JSON.parse(alert.target_cities) : null,
        target_all: !!alert.target_all
      }))
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching acknowledged alerts.',
      error
    });
  }
};


 // Get alert statistics (for admin dashboard)


const getAlertStatistics = async (req, res) => {
  try {
    // Count by status
    const [[statusCounts]] = await db.query(
      `SELECT 
         SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS active_count,
         SUM(CASE WHEN status = 'RESOLVED' THEN 1 ELSE 0 END) AS resolved_count,
         SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled_count
       FROM public_health_alerts`
    );

    // Count by severity (active only)
    const [[severityCounts]] = await db.query(
      `SELECT 
         SUM(CASE WHEN severity = 'CRITICAL' THEN 1 ELSE 0 END) AS critical_count,
         SUM(CASE WHEN severity = 'HIGH' THEN 1 ELSE 0 END) AS high_count,
         SUM(CASE WHEN severity = 'MEDIUM' THEN 1 ELSE 0 END) AS medium_count,
         SUM(CASE WHEN severity = 'LOW' THEN 1 ELSE 0 END) AS low_count
       FROM public_health_alerts
       WHERE status = 'ACTIVE'`
    );

    // Count by type (active only)
    const [typeCounts] = await db.query(
      `SELECT alert_type, COUNT(*) as count
       FROM public_health_alerts
       WHERE status = 'ACTIVE'
       GROUP BY alert_type
       ORDER BY count DESC`
    );

    // Total acknowledgements
    const [[ackCount]] = await db.query(
      'SELECT COUNT(*) as total_acknowledgements FROM alert_acknowledgements'
    );

    return res.status(200).json({
      success: true,
      data: {
        status: statusCounts,
        severity: severityCounts,
        by_type: typeCounts,
        total_acknowledgements: ackCount.total_acknowledgements
      }
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching alert statistics.',
      error
    });
  }
};

module.exports = {
  createAlert,
  getActiveAlerts,
  getAllAlerts,
  getAlertById,
  updateAlert,
  deleteAlert,
  acknowledgeAlert,
  getMyAcknowledgedAlerts,
  getAlertStatistics
};