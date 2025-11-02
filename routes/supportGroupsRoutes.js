const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/authorizeRoles');
const { createGroup, listGroups, joinGroup, leaveGroup, listMembers, createGroupMessage, listGroupMessages } = require('../controllers/supportGroupsController');
const router = express.Router();

//Create Groups
router.post('/', requireAuth,authorizeRoles('THERAPIST', 'DOCTOR', 'ADMIN'), createGroup);

//Get Groups
router.get('/', requireAuth, listGroups);

//Join Group
router.put('/:groupId/members/:userId', requireAuth, joinGroup);

//Leave Group
router.delete('/:groupId/members/:userId', requireAuth, leaveGroup);

// Get all members
router.get('/:groupId/members', requireAuth, listMembers);

// Create Group Message
router.post('/:groupId/messages', requireAuth, createGroupMessage);

// List Group Messages
router.get ('/:groupId/messages', requireAuth, listGroupMessages);

module.exports = router;
