const express = require('express');
const { getUsers } = require('../controllers/userController');

//router object
const router = express.Router();

//routes

//GET ALL STUDENTS LIST || GET
router.get('/getallusers', getUsers);

module.exports = router;
