// routes/authRoutes.js
const express = require('express');
const passport = require('passport');
const { logAuthError, logRouteError } = require('../utils/errorLogger');
const router = express.Router();

router.get('/google', 
  (req, res, next) => {
    try {
      passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
    } catch (error) {
      logRouteError(error, req);
      res.redirect(process.env.FRONTEND_LOGIN_URL || 'http://localhost:3000/login?error=auth_failed');
    }
  }
);

router.get('/google/callback',
  (req, res, next) => {
    passport.authenticate('google', { 
      failureRedirect: process.env.FRONTEND_LOGIN_URL || 'http://localhost:3000/login',
      failureMessage: true 
    })(req, res, (err) => {
      if (err) {
        logAuthError('Google OAuth callback error', {
          file: 'authRoutes.js',
          error: err.message,
          stack: err.stack
        });
        return res.redirect(process.env.FRONTEND_LOGIN_URL || 'http://localhost:3000/login?error=auth_failed');
      }
      
      if (!req.user) {
        logAuthError('Google OAuth callback: No user returned', {
          file: 'authRoutes.js'
        });
        return res.redirect(process.env.FRONTEND_LOGIN_URL || 'http://localhost:3000/login?error=no_user');
      }
      
      res.redirect(process.env.FRONTEND_DASHBOARD_URL || 'http://localhost:3000/dashboard');
    });
  }
);

router.get('/status', (req, res) => {
  try {
    if (req.isAuthenticated()) {
      res.json({
        authenticated: true,
        user: req.user
      });
    } else {
      res.json({ authenticated: false });
    }
  } catch (error) {
    logRouteError(error, req);
    res.status(500).json({ 
      authenticated: false, 
      error: 'Failed to check authentication status' 
    });
  }
});

// Logout route
router.post('/logout', (req, res) => {
  try {
    req.logout((err) => {
      if (err) {
        logAuthError('Logout error', {
          file: 'authRoutes.js',
          userId: req.user?._id,
          error: err.message
        });
        return res.status(500).json({ 
          success: false, 
          message: 'Logout failed' 
        });
      }
      res.json({ success: true, message: 'Logged out successfully' });
    });
  } catch (error) {
    logRouteError(error, req);
    res.status(500).json({ 
      success: false, 
      message: 'Logout failed' 
    });
  }
});

module.exports = router;