const express = require('express');
const { getUsers } = require('../controllers/userController');
const { getUserById } = require('../controllers/userController');
const { updateUser } = require('../controllers/userController');
const { deleteUser } = require('../controllers/userController');

//router object
const router = express.Router();

//routes

//GET ALL USERS LIST || GET
router.get('/getallusers', getUsers);

//GET USER BY ID || GET
router.get('/getuser/:id', getUserById);

//UPDATE USER
router.put('/updateuser/:id', updateUser);

//DELETE USER
router.delete('/deleteuser/:id', deleteUser);



module.exports = router;
