const express = require('express');
const { signupUser, signinUser } = require('../controllers/userController');
const mysql= require('mysql2/promise')
const { requireAuth } = require("../middleware/auth");



const { getUsers } = require('../controllers/userController');
const { getUserById } = require('../controllers/userController');
const { updateUser } = require('../controllers/userController');
const { deleteUser } = require('../controllers/userController');

//router object
const router = express.Router();



//GET ALL USERS LIST || GET
router.get('/getallusers', getUsers);

//GET USER BY ID || GET
router.get('/getuser/:id', getUserById);

//UPDATE USER
router.put('/updateuser/:id', updateUser);

//DELETE USER
router.delete('/deleteuser/:id', deleteUser);

//signup || creat user
router.post("/signup", signupUser);

//signin || log in user
router.post("/signin", signinUser);


router.get("/me", requireAuth, (req, res) => {
  res.status(200).json({
    success: true,
    message: "Protected route accessed successfully!",
    user: req.user,
  });
});




//router.get("/patients", verifyToken, authorizeRoles("ADMIN", "DOCTOR"), getAllPatients);
//router.post("/patients", verifyToken, authorizeRoles("PATIENT"), createPatientProfile);



// router.get("/patients", requireAuth, authorizeRoles("DOCTOR", "THERAPIST"), (req, res) => {
//   res.json({ message: "Doctors and Therapists can view patients." });
// });




module.exports = router;
