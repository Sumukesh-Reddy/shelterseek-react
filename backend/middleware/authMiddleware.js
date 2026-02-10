const jwt = require('jsonwebtoken');
const { Traveler, Host } = require('../model/usermodel');

// JWT authentication middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'myjwtsecret');

    // Support both Traveler and Host users
    const user =
      (await Traveler.findById(decoded.id)) ||
      (await Host.findById(decoded.id));

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    // Attach user to request for downstream middlewares/routes
    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: 'Invalid token' });
  }
};

const isRequestAuthenticated = (req) => {
  if (req.user) return true;
  if (typeof req.isAuthenticated === 'function') {
    try {
      return req.isAuthenticated();
    } catch {
      return false;
    }
  }
  return false;
};

// Role-based access control middleware
const roleMiddleware = {
  // Only travelers can access
  travelerOnly: (req, res, next) => {
    if (!isRequestAuthenticated(req)) {
      return res
        .status(401)
        .json({ success: false, message: 'Authentication required' });
    }

    if (!req.user || req.user.accountType !== 'traveller') {
      return res
        .status(403)
        .json({ success: false, message: 'Access denied: Traveler only' });
    }

    next();
  },

  // Only hosts can access
  hostOnly: (req, res, next) => {
    if (!isRequestAuthenticated(req)) {
      return res
        .status(401)
        .json({ success: false, message: 'Authentication required' });
    }

    if (!req.user || req.user.accountType !== 'host') {
      return res
        .status(403)
        .json({ success: false, message: 'Access denied: Host only' });
    }

    next();
  },

  // Only admins can access
  adminOnly: (req, res, next) => {
    if (!isRequestAuthenticated(req)) {
      return res
        .status(401)
        .json({ success: false, message: 'Authentication required' });
    }

    if (!req.user || req.user.accountType !== 'admin') {
      return res
        .status(403)
        .json({ success: false, message: 'Access denied: Admin only' });
    }

    next();
  },

  // Any authenticated user
  authenticated: (req, res, next) => {
    if (!isRequestAuthenticated(req)) {
      return res
        .status(401)
        .json({ success: false, message: 'Authentication required' });
    }
    next();
  },
};

module.exports = {
  authenticateToken,
  roleMiddleware,
};

