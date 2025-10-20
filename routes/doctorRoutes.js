const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { createDoctorProfile, updateDoctorProfile, getAllDoctors, deactivateDoctor } = require('../controllers/doctorController');
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

module.exports = router;
