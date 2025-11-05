const express = require('express');
//router object
const { requireAuth } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/authorizeRoles');
const {
  createWebinar,
  getAllWebinars,
  getWebinarById,
  updateWebinar,
  deleteWebinar,
  registerForWebinar,
  unregisterFromWebinar,
  getWebinarRegistrations,
  getMyWebinars
} = require('../controllers/webinarController');
const router = express.Router();

// TODO: implement webinar routes

/**
 * POST /api/webinars
 * Create a new webinar/workshop
 * Roles: CONTENT_EDITOR, ADMIN, DOCTOR (host their own)
 */
router.post(
  '/',
  requireAuth,
  authorizeRoles('CONTENT_EDITOR', 'ADMIN', 'DOCTOR'),
  createWebinar
);

/**
 * GET /api/webinars
 * Get all webinars (with optional filtering)
 * Query params: from, to, is_online, upcoming_only, limit, offset
 * Roles: All authenticated users
 */
router.get(
  '/',
  requireAuth,
  getAllWebinars
);

/**
 * GET /api/webinars/my-registrations
 * Get current user's registered webinars
 * Roles: All authenticated users
 * NOTE: This must come before /:webinar_id to avoid route conflicts
 */
router.get(
  '/my-registrations',
  requireAuth,
  getMyWebinars
);

/**
 * GET /api/webinars/:webinar_id
 * Get a specific webinar by ID
 * Roles: All authenticated users
 */
router.get(
  '/:webinar_id',
  requireAuth,
  getWebinarById
);

/**
 * PUT /api/webinars/:webinar_id
 * Update a webinar
 * Roles: Host, CONTENT_EDITOR, ADMIN
 */
router.put(
  '/:webinar_id',
  requireAuth,
  updateWebinar
);

/**
 * DELETE /api/webinars/:webinar_id
 * Delete a webinar
 * Roles: Host, ADMIN
 */
router.delete(
  '/:webinar_id',
  requireAuth,
  deleteWebinar
);

/**
 * POST /api/webinars/:webinar_id/register
 * Register current user for a webinar
 * Roles: All authenticated users
 */
router.post(
  '/:webinar_id/register',
  requireAuth,
  registerForWebinar
);

/**
 * DELETE /api/webinars/:webinar_id/register
 * Unregister current user from a webinar
 * Roles: Registered user, ADMIN
 */
router.delete(
  '/:webinar_id/register',
  requireAuth,
  unregisterFromWebinar
);

/**
 * GET /api/webinars/:webinar_id/registrations
 * Get list of registrations for a webinar
 * Roles: Host, ADMIN, CONTENT_EDITOR
 */
router.get(
  '/:webinar_id/registrations',
  requireAuth,
  authorizeRoles('ADMIN', 'CONTENT_EDITOR', 'DOCTOR'),
  getWebinarRegistrations
);










module.exports = router;
