// middleware/authorizeRoles.js
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      const userRole = req.user?.role;

      if (!userRole) {
        return res.status(403).json({
          success: false,
          message: "User role not found in token",
        });
      }

      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: `Access denied for role: ${userRole}`,
        });
      }

      next(); 
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Role verification failed",
      });
    }
  };
};

module.exports = { authorizeRoles };
