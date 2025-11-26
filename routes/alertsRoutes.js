const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/authorizeRoles');
const {
  createAlert,
  getActiveAlerts,
  getAllAlerts,
  getAlertById,
  updateAlert,
  deleteAlert,
  acknowledgeAlert,
  getMyAcknowledgedAlerts,
  getAlertStatistics
} = require('../controllers/alertsController');

const router = express.Router();



 // Create a new public health alert
router.post(
  '/',
  requireAuth,
  authorizeRoles('ALERT_MANAGER', 'ADMIN'),
  createAlert
);


 // Get all active alerts (public view)
 // alert_type, severity, city, limit, offset

router.get(
  '/active',
  requireAuth,
  getActiveAlerts
);


// Get alert statistics (admin dashboard)

router.get(
  '/statistics',
  requireAuth,
  authorizeRoles('ALERT_MANAGER', 'ADMIN'),
  getAlertStatistics
);


 // Get user's acknowledged alerts

router.get(
  '/my-acknowledged',
  requireAuth,
  getMyAcknowledgedAlerts
);


 // Get all alerts (including inactive) - Admin view
 // status, alert_type, severity, limit, offset

router.get(
  '/',
  requireAuth,
  authorizeRoles('ALERT_MANAGER', 'ADMIN'),
  getAllAlerts
);


 // Get a specific alert by ID

router.get(
  '/:alert_id',
  requireAuth,
  getAlertById
);


 // Update an alert

router.put(
  '/:alert_id',
  requireAuth,
  updateAlert
);


 // Delete an alert

router.delete(
  '/:alert_id',
  requireAuth,
  authorizeRoles('ADMIN'),
  deleteAlert
);


 // Mark an alert as seen/acknowledged by current user

router.post(
  '/:alert_id/acknowledge',
  requireAuth,
  acknowledgeAlert
);

module.exports = router;