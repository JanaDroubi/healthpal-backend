const jwt = require('jsonwebtoken');
require('dotenv').config();

exports.authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Missing auth header' });
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Invalid auth header' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'changeme');
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
