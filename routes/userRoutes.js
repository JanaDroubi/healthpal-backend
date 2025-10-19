const express = require('express');
const { getUsers, signupUser, signinUser } = require('../controllers/userController');
const mysql= require('mysql2/promise')
const { requireAuth } = require("../middleware/auth");
const { authorizeRoles } = require("../middleware/authorizeRoles");



//router object
const router = express.Router();



//GET ALL STUDENTS LIST || GET
router.get('/getallusers', getUsers);

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




// router.get("/patients", requireAuth, authorizeRoles("DOCTOR", "THERAPIST"), (req, res) => {
//   res.json({ message: "Doctors and Therapists can view patients." });
// });
//routes
module.exports = router;
