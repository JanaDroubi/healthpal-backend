const db = require('../config/db');
const dayjs = require('dayjs');


// GUIDES MANAGEMENT (Health Education Content)

 // Create a new health guide
 // Roles: CONTENT_EDITOR, ADMIN

const createGuide = async (req, res) => {
  try {
    const { title, body, audience, published_at } = req.body || {};

    // Validation
    if (!title || !body) {
      return res.status(400).json({
        success: false,
        message: 'Title and body are required.'
      });
    }

    // Validate audience type
    const validAudiences = ['GENERAL', 'MATERNAL', 'CHRONIC', 'FIRST_AID'];
    const audienceVal = audience ? String(audience).toUpperCase() : 'GENERAL';
    
    if (!validAudiences.includes(audienceVal)) {
      return res.status(400).json({
        success: false,
        message: `Invalid audience. Must be one of: ${validAudiences.join(', ')}`
      });
    }

    // Parse published_at if provided
    let publishedAtISO = null;
    if (published_at) {
      const parsed = dayjs(published_at, ['YYYY-MM-DD HH:mm', 'YYYY-MM-DD HH:mm:ss', dayjs.ISO_8601], true);
      if (!parsed.isValid()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid published_at format. Use YYYY-MM-DD HH:mm or ISO format.'
        });
      }
      publishedAtISO = parsed.format('YYYY-MM-DD HH:mm:ss');
    }

    // Insert guide
    const [result] = await db.query(
      `INSERT INTO guides (title, body, audience, published_at)
       VALUES (?, ?, ?, ?)`,
      [title, body, audienceVal, publishedAtISO]
    );

    // Fetch created guide
    const [[guide]] = await db.query(
      'SELECT * FROM guides WHERE id = ?',
      [result.insertId]
    );

    return res.status(201).json({
      success: true,
      message: 'Health guide created successfully.',
      data: guide
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Error creating health guide.',
      error
    });
  }
};


 // Get all guides (with optional filtering)
 // Roles: All authenticated users
 
const getAllGuides = async (req, res) => {
  try {
    const { audience, published_only } = req.query;
    
    let limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    let offset = Math.max(parseInt(req.query.offset || '0', 10), 0);

    const whereParts = [];
    const params = [];

    // Filter by audience
    if (audience) {
      const validAudiences = ['GENERAL', 'MATERNAL', 'CHRONIC', 'FIRST_AID'];
      const aud = String(audience).toUpperCase();
      if (!validAudiences.includes(aud)) {
        return res.status(400).json({
          success: false,
          message: `Invalid audience filter. Must be one of: ${validAudiences.join(', ')}`
        });
      }
      whereParts.push('audience = ?');
      params.push(aud);
    }

    // Filter published only (default behavior for non-admin users)
    const actor = req.user || {};
    const actorRole = String(actor.role || '').trim().toUpperCase();
    
    if (published_only === 'true' || !['ADMIN', 'CONTENT_EDITOR'].includes(actorRole)) {
      whereParts.push('published_at IS NOT NULL');
      whereParts.push('published_at <= NOW()');
    }

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';

    const [rows] = await db.query(
      `SELECT * FROM guides
       ${whereClause}
       ORDER BY 
         CASE WHEN published_at IS NULL THEN 1 ELSE 0 END,
         published_at DESC,
         created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching guides.',
      error
    });
  }
};


 // Get guide by ID
 // Roles: All authenticated users
 
const getGuideById = async (req, res) => {
  try {
    const { guide_id } = req.params;

    const [[guide]] = await db.query(
      'SELECT * FROM guides WHERE id = ?',
      [guide_id]
    );

    if (!guide) {
      return res.status(404).json({
        success: false,
        message: 'Guide not found.'
      });
    }

    // Check if guide is published (for non-admin users)
    const actor = req.user || {};
    const actorRole = String(actor.role || '').trim().toUpperCase();
    
    if (!['ADMIN', 'CONTENT_EDITOR'].includes(actorRole)) {
      if (!guide.published_at || dayjs(guide.published_at).isAfter(dayjs())) {
        return res.status(403).json({
          success: false,
          message: 'This guide is not yet published.'
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: guide
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching guide.',
      error
    });
  }
};


 // Update a guide
 // Roles: CONTENT_EDITOR, ADMIN

const updateGuide = async (req, res) => {
  try {
    const { guide_id } = req.params;
    const { title, body, audience, published_at } = req.body || {};

    // Check if guide exists
    const [[existingGuide]] = await db.query(
      'SELECT * FROM guides WHERE id = ?',
      [guide_id]
    );

    if (!existingGuide) {
      return res.status(404).json({
        success: false,
        message: 'Guide not found.'
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

    if (body !== undefined) {
      if (!body || String(body).trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Body cannot be empty.'
        });
      }
      updates.push('body = ?');
      params.push(body);
    }

    if (audience !== undefined) {
      const validAudiences = ['GENERAL', 'MATERNAL', 'CHRONIC', 'FIRST_AID'];
      const aud = String(audience).toUpperCase();
      if (!validAudiences.includes(aud)) {
        return res.status(400).json({
          success: false,
          message: `Invalid audience. Must be one of: ${validAudiences.join(', ')}`
        });
      }
      updates.push('audience = ?');
      params.push(aud);
    }

    if (published_at !== undefined) {
      if (published_at === null || published_at === '') {
        updates.push('published_at = NULL');
      } else {
        const parsed = dayjs(published_at, ['YYYY-MM-DD HH:mm', 'YYYY-MM-DD HH:mm:ss', dayjs.ISO_8601], true);
        if (!parsed.isValid()) {
          return res.status(400).json({
            success: false,
            message: 'Invalid published_at format. Use YYYY-MM-DD HH:mm or ISO format.'
          });
        }
        updates.push('published_at = ?');
        params.push(parsed.format('YYYY-MM-DD HH:mm:ss'));
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update.'
      });
    }

    params.push(guide_id);

    await db.query(
      `UPDATE guides SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    const [[updatedGuide]] = await db.query(
      'SELECT * FROM guides WHERE id = ?',
      [guide_id]
    );

    return res.status(200).json({
      success: true,
      message: 'Guide updated successfully.',
      data: updatedGuide
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Error updating guide.',
      error
    });
  }
};


 // Delete a guide
 // Roles: ADMIN
 
const deleteGuide = async (req, res) => {
  try {
    const { guide_id } = req.params;

    const [result] = await db.query(
      'DELETE FROM guides WHERE id = ?',
      [guide_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Guide not found.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Guide deleted successfully.'
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting guide.',
      error
    });
  }
};


 // Search guides by title or body content
 // Roles: All authenticated users
 
const searchGuides = async (req, res) => {
  try {
    const { q, audience } = req.query;

    if (!q || String(q).trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 3 characters.'
      });
    }

    let limit = Math.min(parseInt(req.query.limit || '30', 10), 100);
    let offset = Math.max(parseInt(req.query.offset || '0', 10), 0);

    const whereParts = ['(title LIKE ? OR body LIKE ?)'];
    const searchTerm = `%${q}%`;
    const params = [searchTerm, searchTerm];

    // Only show published guides for regular users
    const actor = req.user || {};
    const actorRole = String(actor.role || '').trim().toUpperCase();
    
    if (!['ADMIN', 'CONTENT_EDITOR'].includes(actorRole)) {
      whereParts.push('published_at IS NOT NULL');
      whereParts.push('published_at <= NOW()');
    }

    if (audience) {
      whereParts.push('audience = ?');
      params.push(String(audience).toUpperCase());
    }

    const whereClause = `WHERE ${whereParts.join(' AND ')}`;

    const [rows] = await db.query(
      `SELECT * FROM guides
       ${whereClause}
       ORDER BY 
         CASE WHEN title LIKE ? THEN 0 ELSE 1 END,
         published_at DESC
       LIMIT ? OFFSET ?`,
      [...params, searchTerm, limit, offset]
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      query: q,
      data: rows
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Error searching guides.',
      error
    });
  }
};

module.exports = {
  createGuide,
  getAllGuides,
  getGuideById,
  updateGuide,
  deleteGuide,
  searchGuides
};