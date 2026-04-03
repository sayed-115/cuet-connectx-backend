module.exports = function requireRole(requiredRole) {
  return function roleGuard(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (req.user.role !== requiredRole) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    return next();
  };
};
