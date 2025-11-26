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



 // Create a new health education guide
router.post(
  '/',
  requireAuth,
  authorizeRoles('CONTENT_EDITOR', 'ADMIN'),
  createGuide
);


 // Get all guides (with optional filtering)
 // Query par : audience  published_only  limit  offset
router.get(
  '/',
  requireAuth,
  getAllGuides
);


//Search guides by title or body content
 // Query par : q (search query)  audience  limit  offset
router.get(
  '/search',
  requireAuth,
  searchGuides
);


 // Get a specific guide by ID
router.get(
  '/:guide_id',
  requireAuth,
  getGuideById
);

 // Update a guide
router.put(
  '/:guide_id',
  requireAuth,
  authorizeRoles('CONTENT_EDITOR', 'ADMIN'),
  updateGuide
);

 // Delete a guide
router.delete(
  '/:guide_id',
  requireAuth,
  authorizeRoles('ADMIN'),
  deleteGuide
);

module.exports = router;
