const db = require('../config/db');
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// GET USERS LIST
const getUsers = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM user');

    if (rows.length === 0) {
      return res.status(404).send({
        success: false,
        message: 'No Records found',
      });
    }

    res.status(200).send({
      success: true,
      message: 'All Users Records',
      data: rows,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      success: false,
      message: 'Error in Get All User API',
      error,
    });
  }
};



// signup || create user
const signupUser = async (req, res) => {
    try {
        const { full_name, email, password, phone, role, status } = req.body;

        if (!full_name || !email || !password || !role) {
            return res.status(400).send({
                success: false,
                message: "Full name, email, password, and role are required",
            });
        }

        // check email uniqueness
        const [exists] = await db.query(
            "SELECT user_id FROM `user` WHERE email = ?",
            [email]
        );
        if (exists.length > 0) {
            return res.status(409).send({
                success: false,
                message: "Email already in use",
            });
        }

        // hash password
        const password_hash = await bcrypt.hash(password, 10);

        // insert
        const [result] = await db.query(
            "INSERT INTO `user` (full_name, email, password_hash, phone, role, status) VALUES (?, ?, ?, ?, ?, ?)",
            [full_name, email, password_hash, phone, role || "PATIENT", status || "ACTIVE"]
        );

        // success
        return res.status(201).send({
            success: true,
            message: "User created successfully",
            user: {
                user_id: result.insertId,
                full_name,
                email,
                phone,
                role: role || "PATIENT",
                status: status || "ACTIVE",
            },
        });
    } catch (error) {
        console.log(error);
        return res.status(500).send({
            success: false,
            message: "Error in create user",
            error,
        });
    }
};


//signin || log in user
const signinUser = async (req, res) => {
    try {
        const { email, password } = req.body;


        if (!email || !password) {
            return res.status(400).send({
                success: false,
                message: "Email and password are required",
            });
        }

        const [userRows] = await db.query(
            "SELECT user_id, full_name, email, password_hash, phone, role, status FROM `user` WHERE email = ?",
            [email]
        );

        if (userRows.length === 0) {
            return res.status(401).send({
                success: false,
                message: "Invalid email or password",
            });
        }

        const user = userRows[0];

        const isMatch = await bcrypt.compare(String(password), user.password_hash);
        if (!isMatch) {
            return res.status(401).send({
                success: false,
                message: "Invalid email or password"
            });
        }


        if (user.status && user.status !== "ACTIVE") {
            return res.status(403).send({
                success: false,
                message: "User is not active"
            });
        }

    
        const payload = { id: user.user_id, role: user.role };
        const token = jwt.sign(
            payload,
            process.env.JWT_ACCESS_SECRET,
            { expiresIn: process.env.JWT_ACCESS_EXPIRES || "15m" }
        );

        
        return res.status(200).send({
            success: true,
            message: "Logged in successfully",
            token, 
            user: {
                user_id: user.user_id,
                full_name: user.full_name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                status: user.status
            }
        });



    } catch (error) {
        console.log(error);
        return res.status(500).send({
            success: false,
            message: "Error in sign in user",
            error,
        });
    }
};

module.exports = { getUsers, signupUser, signinUser };


