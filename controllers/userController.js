const db = require('../config/db');

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

module.exports = { getUsers };
