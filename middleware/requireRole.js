const requireRole = (...allowedRoles) => {
  const normalizedAllowedRoles = allowedRoles.map((role) => String(role || '').toLowerCase().trim()).filter(Boolean);

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const userRole = String(req.user.role || '').toLowerCase().trim();
    if (!normalizedAllowedRoles.includes(userRole)) {
      return res.status(403).json({ success: false, message: 'Forbidden: insufficient role permission' });
    }

    return next();
  };
};

module.exports = requireRole;
