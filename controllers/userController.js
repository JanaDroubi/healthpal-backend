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



// GET USER BY ID
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query('SELECT * FROM user WHERE user_id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).send({ success: false, message: 'User not found' });
    }

    res.status(200).send({
      success: true,
      message: 'User record found',
      data: rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: 'Error in getUserById API', error });
  }
};


// UPDATE USER
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const fields = req.body;

    // لو ما في ولا قيمة مرسلة
    if (Object.keys(fields).length === 0) {
      return res.status(400).send({ success: false, message: 'No fields to update' });
    }

    const columns = Object.keys(fields)
      .map(key => `${key} = ?`)
      .join(', ');

    const values = Object.values(fields);

    const [result] = await db.query(
      `UPDATE user SET ${columns} WHERE user_id = ?`,
      [...values, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).send({ success: false, message: 'User not found' });
    }

    res.status(200).send({
      success: true,
      message: 'User updated successfully',
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: 'Error updating user', error });
  }
};


// DELETE USER
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.query('DELETE FROM user WHERE user_id=?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).send({ success: false, message: 'User not found' });
    }

    res.status(200).send({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: 'Error deleting user', error });
  }
};



module.exports = { getUsers, getUserById, updateUser, deleteUser};
