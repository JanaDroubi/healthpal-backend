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
router.get('/getallusers', requireAuth, authorizeRoles('ADMIN'), getUsers);

//GET USER BY ID || GET
router.get('/getuser/:id', requireAuth, authorizeRoles('ADMIN'), getUserById);

//UPDATE USER
router.put('/updateuser/:id', requireAuth, authorizeRoles('ADMIN'), updateUser);

//DELETE USER
router.delete('/deleteuser/:id',requireAuth, authorizeRoles('ADMIN'), deleteUser);

//signup || creat user
router.post("/signup", signupUser);

//signin || log in user
router.post("/signin", signinUser);










module.exports = router;
