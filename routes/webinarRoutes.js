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



 // Create a new webinar/workshop
router.post(
  '/',
  requireAuth,
  authorizeRoles('CONTENT_EDITOR', 'ADMIN', 'DOCTOR' ,'THERAPIST'),
  createWebinar
);


  //Get all webinars (with optional filtering)
 // Query params: from, to, is_online, upcoming_only, limit, offset
router.get(
  '/',
  requireAuth,
  getAllWebinars
);


 // Get current user's registered webinars
router.get(
  '/my-registrations',
  requireAuth,
  getMyWebinars
);


 // Get a specific webinar by ID
router.get(
  '/:webinar_id',
  requireAuth,
  getWebinarById
);



 // Update a webinar
 //  Host, CONTENT_EDITOR, ADMIN
router.put(
  '/:webinar_id',
  requireAuth,
  updateWebinar
);


 // Delete a webinar
 // Host, ADMIN

router.delete(
  '/:webinar_id',
  requireAuth,
  deleteWebinar
);


 // Register current user for a webinar
router.post(
  '/:webinar_id/register',
  requireAuth,
  registerForWebinar
);


 // Unregister current user from a webinar
 // Registered user, ADMIN
router.delete(
  '/:webinar_id/register',
  requireAuth,
  unregisterFromWebinar
);


 // Get list of registrations for a webinar

router.get(
  '/:webinar_id/registrations',
  requireAuth,
  authorizeRoles('ADMIN', 'CONTENT_EDITOR', 'DOCTOR','THERAPIST'),
  getWebinarRegistrations
);


module.exports = router;
