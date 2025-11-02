const router = require('express').Router();
const { createTherapyAvailabilitySlot, listAvailabilityForTherapist, listAllTherapyAvailability, deleteTherapyAvailabilitySlot, bookTherapySlot, updateTherapyAvailabilitySlot, updateTherapySession, getTherapySessionById, listTherapySessions, getTherapyMessages} = require('../controllers/therapyController');
const { requireAuth } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/authorizeRoles');

//  createTherapyAvailabilitySlot
router.post(
  '/:therapist_id/availability',
  requireAuth,
  authorizeRoles('THERAPIST','ADMIN'),
  createTherapyAvailabilitySlot
);

// view therapy slot
router.get(
  '/:therapist_id/availability',
  requireAuth,
  authorizeRoles('PATIENT','THERAPIST','ADMIN'), 
  listAvailabilityForTherapist
);

//view all therapy slot
router.get(
  '/availability',
  requireAuth,
  authorizeRoles('PATIENT','ADMIN','THERAPIST'),
  listAllTherapyAvailability
);

// delete therapy slot
router.delete(
  '/:therapist_id/availability/:slot_id',
  requireAuth,
  authorizeRoles('THERAPIST','ADMIN'),
  deleteTherapyAvailabilitySlot
);

// Book Therapy Slot
router.post(
  '/slots/:slot_id/bookings',
  requireAuth,
  authorizeRoles('PATIENT', 'ADMIN'),
  bookTherapySlot
);
;

// Update Availability Slot
router.put(
  '/:therapist_id/availability/:slot_id',
  requireAuth,
  authorizeRoles('THERAPIST','ADMIN'),
  updateTherapyAvailabilitySlot
);

// Update Therapy Session
router.put(
  '/sessions/:session_id',
  requireAuth,
  authorizeRoles('PATIENT','THERAPIST','ADMIN'),
  updateTherapySession
);

// Get one session by id
router.get(
  '/sessions/:id',
  requireAuth,
  authorizeRoles('PATIENT','THERAPIST','ADMIN'),
  getTherapySessionById
);

// List sessions (with filters)
router.get(
  '/sessions',
  requireAuth,
  authorizeRoles('PATIENT','THERAPIST','ADMIN'),
  listTherapySessions
);


// Get Therapy Messages 
router.get(
  '/sessions/:session_id/messages',
  requireAuth,
  authorizeRoles('PATIENT', 'THERAPIST', 'ADMIN'),
  getTherapyMessages
);





module.exports = router;
