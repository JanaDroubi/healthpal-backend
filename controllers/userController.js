const { User } = require('../models');
const apiResponse = require('../utils/apiResponse');

exports.createUser = async (req, res, next) => {
  try {
    const { email, password, name, role } = req.body;
    const user = await User.create({ email, password, name, role });
    res.status(201).json(apiResponse.success(user));
  } catch (err) {
    next(err);
  }
};

exports.listUsers = async (req, res, next) => {
  try {
    const users = await User.findAll();
    res.json(apiResponse.success(users));
  } catch (err) {
    next(err);
  }
};

exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json(apiResponse.error('User not found'));
    res.json(apiResponse.success(user));
  } catch (err) {
    next(err);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json(apiResponse.error('User not found'));
    await user.update(req.body);
    res.json(apiResponse.success(user));
  } catch (err) {
    next(err);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json(apiResponse.error('User not found'));
    await user.destroy();
    res.json(apiResponse.success({ message: 'Deleted' }));
  } catch (err) {
    next(err);
  }
};
