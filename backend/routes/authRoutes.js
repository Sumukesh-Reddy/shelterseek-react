// routes/authRoutes.js
const express = require('express');
const passport = require('passport');
const router = express.Router();

router.get('/google', 
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
  passport.authenticate('google', { 
    failureRedirect: process.env.FRONTEND_LOGIN_URL || 'http://localhost:3000/login',
    failureMessage: true 
  }),
  (req, res) => {
    res.redirect(process.env.FRONTEND_DASHBOARD_URL || 'http://localhost:3000/dashboard');
  }
);

router.get('/status', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      authenticated: true,
      user: req.user
    });
  } else {
    res.json({ authenticated: false });
  }
});

module.exports = router;