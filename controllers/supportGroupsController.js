// controllers/supportGroupsController.js
const db = require('../config/db');

const ALLOWED_TOPICS = new Set([
  'PTSD', 'GRIEF', 'CHRONIC_ILLNESS', 'DISABILITY', 'LOSS', 'GENERAL'
]);
const CREATOR_ROLES = new Set(['THERAPIST', 'DOCTOR', 'ADMIN']);
//create groupe
const MIN_CAPACITY = 2;
const MAX_CAPACITY = 200;
const createGroup = async (req, res) => {
  try {
    const { name, description = null, topic, capacity } = req.body || {};
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    if (!CREATOR_ROLES.has(role)) {
      return res.status(403).json({ success: false, message: 'Only therapist/doctor/admin can create groups' });
    }
    if (!name || name.length > 200) {
      return res.status(400).json({ success: false, message: 'name is required and must be ≤ 200 chars' });
    }
    if (!ALLOWED_TOPICS.has(topic)) {
      return res.status(400).json({ success: false, message: `topic must be one of ${[...ALLOWED_TOPICS].join(', ')}` });
    }

    const [[u]] = await db.query('SELECT status FROM `user` WHERE user_id=?', [userId]);
    if (!u || u.status !== 'ACTIVE') {
      return res.status(403).json({ success: false, message: 'Inactive account' });
    }

    let cap = Number(capacity);
    if (!Number.isFinite(cap)) cap = undefined;
    else cap = Math.floor(cap);

    if (cap !== undefined) {
      if (cap < MIN_CAPACITY || cap > MAX_CAPACITY) {
        return res.status(400).json({
          success: false,
          message: `capacity must be an integer between ${MIN_CAPACITY} and ${MAX_CAPACITY}`
        });
      }
    }

    const insertSql = cap === undefined
      ? `INSERT INTO support_groups (name, description, topic, owner_id) VALUES (?,?,?,?)`
      : `INSERT INTO support_groups (name, description, topic, owner_id, capacity) VALUES (?,?,?,?,?)`;

    const params = cap === undefined
      ? [name, description, topic, userId]
      : [name, description, topic, userId, cap];

    const [result] = await db.query(insertSql, params);
    const groupId = result.insertId;
    await db.query(
      `INSERT IGNORE INTO support_group_members (group_id, user_id, role)
       VALUES (?, ?, 'FACILITATOR')`,
      [groupId, userId]
    );

    const [[g]] = await db.query('SELECT capacity FROM support_groups WHERE id=?', [groupId]);

    res.status(201)
      .location(`/support-groups/${groupId}`)
      .json({
        success: true,
        data: {
          id: groupId,
          name,
          description,
          topic,
          capacity: g?.capacity ?? cap ?? 20,
          owner_id: userId,
          _links: {
            self: `/support-groups/${groupId}`,
            members: `/support-groups/${groupId}/members`
          }
        }
      });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


//get groupes
const listGroups = async (req, res) => {
  try {
    if (req.user?.status && req.user.status !== 'ACTIVE') {
      return res.status(403).json({ success: false, message: 'Inactive account' });
    }

    let { topic, search = '', limit = '20', offset = '0' } = req.query;
    limit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    offset = Math.max(parseInt(offset, 10) || 0, 0);

    const where = [];
    const params = [];

    if (topic) {
      if (!ALLOWED_TOPICS.has(topic)) {
        return res.status(400).json({ success: false, message: `topic must be one of ${[...ALLOWED_TOPICS].join(', ')}` });
      }
      where.push('g.topic = ?');
      params.push(topic);
    }

    if (search) {
      where.push('(g.name LIKE ? OR g.description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const sql = `
      SELECT g.id, g.name, g.description, g.topic, g.owner_id, g.created_at
      FROM support_groups g
      ${whereSql}
      ORDER BY g.created_at DESC
      LIMIT ? OFFSET ?`;

    const countSql = `
      SELECT COUNT(*) AS total
      FROM support_groups g
      ${whereSql}`;

    const [rows] = await db.query(sql, [...params, limit, offset]);
    const [[cnt]] = await db.query(countSql, params);

    res.json({
      success: true,
      meta: { total: cnt.total, limit, offset },
      data: rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

//join group
const GROUP_ROLES = Object.freeze({
  FACILITATOR: 'FACILITATOR',
  DOCTOR: 'DOCTOR',
  MODERATOR: 'MODERATOR',
  MEMBER: 'MEMBER',
});

const joinGroup = async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    const authUserId = String(req.user?.id || '');
    const authRole = req.user?.role || '';
    const authStatus = req.user?.status || '';

    if (!authUserId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    if (authStatus && authStatus !== 'ACTIVE') {
      return res.status(403).json({ success: false, message: 'Inactive account' });
    }
    if (String(userId) !== authUserId && authRole !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'You can only join for yourself' });
    }

    const [[g]] = await db.query(
      'SELECT id, capacity FROM support_groups WHERE id = ?',
      [groupId]
    );
    if (!g) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    let roleInGroup = GROUP_ROLES.MEMBER;
    if (authRole === 'DOCTOR' || authRole === 'THERAPIST') roleInGroup = GROUP_ROLES.DOCTOR;
    if (authRole === 'ADMIN') roleInGroup = GROUP_ROLES.MODERATOR;

    const [[existing]] = await db.query(
      'SELECT role FROM support_group_members WHERE group_id=? AND user_id=?',
      [groupId, userId]
    );

    if (existing) {
      if (
        existing.role === GROUP_ROLES.MEMBER &&
        [GROUP_ROLES.DOCTOR, GROUP_ROLES.MODERATOR, GROUP_ROLES.FACILITATOR].includes(roleInGroup)
      ) {
        await db.query(
          'UPDATE support_group_members SET role=? WHERE group_id=? AND user_id=?',
          [roleInGroup, groupId, userId]
        );
      }
      return res.status(204).send();
    }

    const cap = Number(g.capacity) || 0;
    if (cap > 0) {
      const [[cnt]] = await db.query(
        'SELECT COUNT(*) AS c FROM support_group_members WHERE group_id=?',
        [groupId]
      );
      if (cnt.c >= cap) {
        return res.status(403).json({ success: false, message: 'GROUP_FULL' });
      }
    }

    await db.query(
      `INSERT INTO support_group_members (group_id, user_id, role)
       VALUES (?, ?, ?)`,
      [groupId, userId, roleInGroup]
    );

    return res.status(204).send();
  } catch (err) {
    console.error('joinGroup error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

//Leave group
const canModeratorKick = false;
const leaveGroup = async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    const meId = String(req.user?.id || '');
    const meRole = req.user?.role || '';
    const meStatus = req.user?.status || '';

    if (!meId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (meStatus && meStatus !== 'ACTIVE') {
      return res.status(403).json({ success: false, message: 'Inactive account' });
    }

    const [[target]] = await db.query(
      `SELECT role FROM support_group_members WHERE group_id=? AND user_id=?`,
      [groupId, userId]
    );
    if (!target) return res.status(204).send();

    if (target.role === 'FACILITATOR') {
      return res.status(409).json({
        success: false,
        message: 'Facilitator cannot be removed. Transfer ownership or delete the group.'
      });
    }

    const isSelf = String(userId) === meId;
    if (isSelf) {
      await db.query(
        `DELETE FROM support_group_members WHERE group_id=? AND user_id=? LIMIT 1`,
        [groupId, userId]
      );
      return res.status(204).send();
    }

    if (meRole === 'ADMIN') {
      await db.query(
        `DELETE FROM support_group_members WHERE group_id=? AND user_id=? LIMIT 1`,
        [groupId, userId]
      );
      return res.status(204).send();
    }

    const [[mine]] = await db.query(
      `SELECT role FROM support_group_members WHERE group_id=? AND user_id=?`,
      [groupId, meId]
    );
    if (!mine) {
      return res.status(403).json({ success: false, message: 'Not a group member' });
    }

    const iAmFacilitator = mine.role === 'FACILITATOR';
    const iAmModerator = canModeratorKick && mine.role === 'MODERATOR';

    if (!(iAmFacilitator || iAmModerator)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions to remove members' });
    }

    if (iAmModerator && target.role !== 'MEMBER') {
      return res.status(403).json({ success: false, message: 'Moderators can remove MEMBERS only' });
    }

    await db.query(
      `DELETE FROM support_group_members WHERE group_id=? AND user_id=? LIMIT 1`,
      [groupId, userId]
    );
    return res.status(204).send();

  } catch (err) {
    console.error('leaveGroup error:', err?.sqlMessage || err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};


// Get all members
const GRoules = new Set(['FACILITATOR', 'MODERATOR', 'DOCTOR', 'MEMBER']);
const PLATFORM_ROLES = new Set([
  'PATIENT', 'DOCTOR', 'THERAPIST', 'TRANSLATOR', 'DONOR', 'NGO', 'MISSION_COORDINATOR',
  'VOLUNTEER', 'COURIER', 'PHARMACY', 'HOSPITAL_STAFF', 'CONTENT_EDITOR',
  'ALERT_MANAGER', 'FINANCE_MANAGER', 'MODERATOR', 'AUDITOR', 'ADMIN'
]);

const listMembers = async (req, res) => {
  try {
    const { groupId } = req.params;
    let { search = '', role, platformRole, limit = '20', offset = '0' } = req.query;

    limit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    offset = Math.max(parseInt(offset, 10) || 0, 0);

    const [[g]] = await db.query('SELECT id FROM support_groups WHERE id=?', [groupId]);
    if (!g) return res.status(404).json({ success: false, message: 'Group not found' });

    const where = ['m.group_id = ?'];
    const params = [groupId];

    if (search) {
      where.push('(u.full_name LIKE ? OR u.email LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (role) {
      if (!GRoules.has(role)) {
        return res.status(400).json({ success: false, message: `role must be one of ${[...GRoules].join(', ')}` });
      }
      where.push('m.role = ?');
      params.push(role);
    }

    if (platformRole) {
      if (!PLATFORM_ROLES.has(platformRole)) {
        return res.status(400).json({ success: false, message: `platformRole must be one of ${[...PLATFORM_ROLES].join(', ')}` });
      }
      where.push('u.role = ?');
      params.push(platformRole);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    const sql = `
      SELECT 
        m.user_id,
        m.role      AS group_role,
        u.full_name AS name,
        u.email,
        u.role      AS platform_role,
        u.status
      FROM support_group_members m
      JOIN \`user\` u ON u.user_id = m.user_id
      ${whereSql}
      ORDER BY 
        CASE m.role 
          WHEN 'FACILITATOR' THEN 1 
          WHEN 'MODERATOR'   THEN 2
          WHEN 'DOCTOR'      THEN 3
          ELSE 4
        END,
        u.full_name ASC
      LIMIT ? OFFSET ?`;

    const countSql = `
      SELECT COUNT(*) AS total
      FROM support_group_members m
      JOIN \`user\` u ON u.user_id = m.user_id
      ${whereSql}`;

    const [rows] = await db.query(sql, [...params, limit, offset]);
    const [[cnt]] = await db.query(countSql, params);

    return res.json({
      success: true,
      meta: { total: cnt.total, limit, offset, role: role || null, platformRole: platformRole || null, search: search || null },
      data: rows
    });
  } catch (err) {
    console.error('listMembers error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Create Group Message
const createGroupMessage = async (req, res) => {
  try {
    const groupId = Number(req.params.groupId);
    const userId = req.user.id;
    const { text } = req.body || {};

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'EMPTY_TEXT' });
    }

    const [[isMember]] = await db.query(
      'SELECT 1 FROM support_group_members WHERE group_id=? AND user_id=?',
      [groupId, userId]
    );
    if (!isMember) {
      return res.status(403).json({ success: false, message: 'NOT_MEMBER' });
    }

    const [[user]] = await db.query(
      'SELECT full_name AS name FROM user WHERE user_id=?',
      [userId]
    );
    if (!user) {
      return res.status(400).json({ success: false, message: 'USER_NOT_FOUND' });
    }

    const displayName = user.name;

    const [ins] = await db.query(
      `INSERT INTO group_messages (group_id, user_id, user_name, text)
       VALUES (?, ?, ?, ?)`,
      [groupId, userId, displayName, text.trim()]
    );

    return res.status(201).json({
      id: ins.insertId,
      group_id: groupId,
      user_id: userId,
      user_name: displayName,
      text: text.trim(),
      created_at: new Date().toISOString()
    });

  } catch (err) {
    console.error('createGroupMessage error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// List Group Messages
const listGroupMessages = async (req, res) => {
  try {
    const groupId = Number(req.params.groupId);
    const userId = req.user.id;
    const afterId = Number(req.query.afterId || 0);
    const limit = Math.min(Number(req.query.limit || 50), 100);

    const [[isMember]] = await db.query(
      'SELECT 1 FROM support_group_members WHERE group_id=? AND user_id=?',
      [groupId, userId]
    );
    if (!isMember) {
      return res.status(403).json({ success: false, message: 'NOT_MEMBER' });
    }

    const [rows] = await db.query(
      `SELECT id, user_id, user_name, text, created_at
       FROM group_messages
       WHERE group_id=? AND id > ?
       ORDER BY id ASC
       LIMIT ?`,
      [groupId, afterId, limit]
    );

    return res.json({
      messages: rows,
      nextAfterId: rows.length ? rows[rows.length - 1].id : afterId
    });

  } catch (err) {
    console.error('listGroupMessages error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};





module.exports = {
  createGroup, listGroups,
  joinGroup, leaveGroup,
  listMembers, createGroupMessage,
  listGroupMessages
}