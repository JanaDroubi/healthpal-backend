const express = require('express');
const { signupUser, signinUser } = require('../controllers/userController');
const mysql= require('mysql2/promise')
const { requireAuth } = require("../middleware/auth");



const { getUsers } = require('../controllers/userController');
const { getUserById } = require('../controllers/userController');
const { updateUser } = require('../controllers/userController');
const { deleteUser } = require('../controllers/userController');
const { authorizeRoles } = require('../middleware/authorizeRoles');

//router object
const router = express.Router();


//GET ALL USERS LIST || GET

router.get('/', requireAuth, authorizeRoles('ADMIN'), getUsers);

//GET USER BY ID || GET

router.get('/:id', requireAuth, authorizeRoles('ADMIN'), getUserById);

//UPDATE USER

router.put('/:id', requireAuth, authorizeRoles('ADMIN'), updateUser);

//DELETE USER

router.delete('/:id', requireAuth, authorizeRoles('ADMIN'), deleteUser);

//signup || creat user
router.post("/signup", signupUser);

//signin || log in user
router.post("/signin", signinUser);










module.exports = router;
