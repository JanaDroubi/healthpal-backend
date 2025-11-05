const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/authorizeRoles');
const {
  createGuide,
  getAllGuides,
  getGuideById,
  updateGuide,
  deleteGuide,
  searchGuides
} = require('../controllers/guideController');

const router = express.Router();
// TODO: implement guide routes


/**
 * POST /api/guides
 * Create a new health education guide
 * Roles: CONTENT_EDITOR, ADMIN
 */
router.post(
  '/',
  requireAuth,
  authorizeRoles('CONTENT_EDITOR', 'ADMIN'),
  createGuide
);

/**
 * GET /api/guides
 * Get all guides (with optional filtering)
 * Query params: audience, published_only, limit, offset
 * Roles: All authenticated users
 */
router.get(
  '/',
  requireAuth,
  getAllGuides
);

/**
 * GET /api/guides/search
 * Search guides by title or body content
 * Query params: q (search query), audience, limit, offset
 * Roles: All authenticated users
 * NOTE: This must come before /:guide_id to avoid route conflicts
 */
router.get(
  '/search',
  requireAuth,
  searchGuides
);

/**
 * GET /api/guides/:guide_id
 * Get a specific guide by ID
 * Roles: All authenticated users
 */
router.get(
  '/:guide_id',
  requireAuth,
  getGuideById
);

/**
 * PUT /api/guides/:guide_id
 * Update a guide
 * Roles: CONTENT_EDITOR, ADMIN
 */
router.put(
  '/:guide_id',
  requireAuth,
  authorizeRoles('CONTENT_EDITOR', 'ADMIN'),
  updateGuide
);

/**
 * DELETE /api/guides/:guide_id
 * Delete a guide
 * Roles: ADMIN
 */
router.delete(
  '/:guide_id',
  requireAuth,
  authorizeRoles('ADMIN'),
  deleteGuide
);

module.exports = router;
