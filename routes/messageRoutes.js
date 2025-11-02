const router = require('express').Router();
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/authorizeRoles');

router.get(
  '/consultations/:id/messages',
  requireAuth,
  authorizeRoles('PATIENT','DOCTOR','ADMIN'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const [rows] = await db.query(
        `SELECT id, sender_id, text_original, text_translated, lang_from, lang_to, created_at
         FROM messages WHERE consultation_id = ? ORDER BY id ASC`,
        [id]
      );
      res.json({ success: true, messages: rows });
    } catch (e) {
      console.error('messages fetch error:', e.message);
      res.status(500).json({ success:false, message:'Failed to load messages' });
    }
  }
);




module.exports = router;
