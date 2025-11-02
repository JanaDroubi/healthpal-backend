const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { createDoctorProfile, updateDoctorProfile, getAllDoctors, deactivateDoctor, getDoctorById, createAvailabilitySlot, listAvailabilityForDoctor, listAllAvailability, deleteAvailabilitySlot, updateAvailabilitySlot } = require('../controllers/doctorController');
const { authorizeRoles } = require("../middleware/authorizeRoles");


const router = express.Router();
//creat profile
router.post('/create/doctorprofile', requireAuth, authorizeRoles('DOCTOR'), createDoctorProfile);
//update profile
router.put('/update/doctorprofile/:user_id', requireAuth, authorizeRoles('DOCTOR', 'ADMIN'), updateDoctorProfile);
//get all doctors
router.get('/viewdoctors',requireAuth,authorizeRoles('ADMIN'), getAllDoctors);
//Deactivate doctor: delete profile + set user.status = 'INACTIVE' (transactional)
router.delete('/deletedoctor/:user_id',requireAuth,authorizeRoles('ADMIN'), deactivateDoctor);
//get by id 
router.get('/getdoctor/:user_id',requireAuth,authorizeRoles('ADMIN', 'DOCTOR'),getDoctorById);


///////////feature one//////////
//createAvailabilitySlot
router.post('/createAvailabilitySlot/:doctor_id', requireAuth, authorizeRoles('ADMIN', 'DOCTOR'), createAvailabilitySlot);
// list of availability slot for a doctor
router.get('/availabilitySlot/:doctor_id', requireAuth,authorizeRoles('DOCTOR','ADMIN'), listAvailabilityForDoctor);
// list of availability slot for all doctor
router.get('/availabilitySlot', requireAuth,authorizeRoles('ADMIN'), listAllAvailability);
// DELETE slot
router.delete('/deleteSlot/:doctor_id/:slot_id', requireAuth,authorizeRoles('DOCTOR','ADMIN'), deleteAvailabilitySlot);
// Update Slot
router.put('/updateAvailabilitySlot/:doctor_id/slots/:slot_id',requireAuth,authorizeRoles('DOCTOR','ADMIN'),updateAvailabilitySlot);

///////end feature one /////////

module.exports = router;
