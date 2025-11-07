require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cors = require('cors');
const { Traveler, Host } = require('./model/usermodel');

const app = express();
const PORT = process.env.PORT || 3001;

// ✅ Connect to MongoDB FIRST
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/yourdb')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Middleware
app.use(cors({ 
  origin: process.env.FRONTEND_URL || 'http://localhost:3000', 
  credentials: true 
}));
app.use(express.json());

// ✅ Improved session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret123',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/yourdb',
    collectionName: 'sessions'
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 1 day
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true
  }
}));

// ✅ Initialize passport AFTER session
app.use(passport.initialize());
app.use(passport.session());

// ✅ Import and use the passport configuration
require('./config/passport')(passport);

// ✅ Import routes
const authRoutes = require('./routes/authRoutes');
app.use('/auth', authRoutes);

// ---------------- OTP VERIFICATION ----------------
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const otpStore = {};
const verifiedEmails = new Set();

// ✅ Test Email Configuration Route
app.get('/test-email-config', async (req, res) => {
  try {
    const emailUser = process.env.EMAIL_USER || process.env.EMAIL;
    const hasEmailCreds = Boolean(emailUser && process.env.EMAIL_PASS);
    
    console.log('🔧 Email Config Check:', {
      EMAIL_USER: process.env.EMAIL_USER ? 'Set' : 'Missing',
      EMAIL: process.env.EMAIL ? 'Set' : 'Missing',
      EMAIL_PASS: process.env.EMAIL_PASS ? 'Set' : 'Missing',
      usingEmail: emailUser,
      hasEmailCreds: hasEmailCreds
    });

    if (!hasEmailCreds) {
      return res.json({ 
        success: false, 
        message: 'Email credentials missing',
        details: {
          EMAIL_USER: process.env.EMAIL_USER ? 'Set' : 'Missing',
          EMAIL: process.env.EMAIL ? 'Set' : 'Missing',
          EMAIL_PASS: process.env.EMAIL_PASS ? 'Set' : 'Missing'
        }
      });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.verify();
    
    res.json({ 
      success: true, 
      message: 'Email configuration is correct!',
      email: emailUser
    });
  } catch (error) {
    console.error('❌ Email config test error:', error);
    res.json({ 
      success: false, 
      message: 'Email configuration error',
      error: error.message 
    });
  }
});

// ✅ Simple Email Test Route
app.post('/simple-email-test', async (req, res) => {
  try {
    const { toEmail } = req.body;
    
    if (!toEmail) {
      return res.status(400).json({ success: false, message: 'Email required' });
    }

    const emailUser = process.env.EMAIL_USER || process.env.EMAIL;
    const hasEmailCreds = Boolean(emailUser && process.env.EMAIL_PASS);
    
    console.log('🔧 Test Email Debug:', {
      emailUser: emailUser,
      emailPassLength: process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 'Missing',
      toEmail: toEmail
    });

    if (!hasEmailCreds) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email credentials not configured',
        details: {
          emailUser: emailUser ? 'Set' : 'Missing',
          EMAIL_PASS: process.env.EMAIL_PASS ? 'Set' : 'Missing'
        }
      });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: process.env.EMAIL_PASS
      }
    });

    const testOtp = Math.floor(100000 + Math.random() * 900000).toString();
    
    const mailOptions = {
      from: emailUser,
      to: toEmail,
      subject: 'Test OTP Email - Working!',
      text: `This is a test email from your app. Your test OTP is: ${testOtp}`,
      html: `<p>This is a test email from your app. Your test OTP is: <strong>${testOtp}</strong></p>`
    };

    await transporter.sendMail(mailOptions);
    
    res.json({ 
      success: true, 
      message: 'Test email sent successfully! Check your inbox.',
      testOtp: testOtp
    });
  } catch (error) {
    console.error('❌ Test email error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send test email',
      error: error.message 
    });
  }
});

// ✅ Debug Environment Route
app.get('/debug-env', (req, res) => {
  res.json({
    EMAIL_USER: process.env.EMAIL_USER || 'Not set',
    EMAIL: process.env.EMAIL || 'Not set', 
    EMAIL_PASS: process.env.EMAIL_PASS ? 
      `Set (length: ${process.env.EMAIL_PASS.length})` : 
      'Not set',
    NODE_ENV: process.env.NODE_ENV,
    MONGODB_URI: process.env.MONGODB_URI ? 'Set' : 'Not set'
  });
});

// send OTP
app.post('/send-otp', async (req, res) => {
  const { email } = req.body;
  
  // ✅ Debug logging
  const emailUser = process.env.EMAIL_USER || process.env.EMAIL;
  console.log('🔧 OTP Request Debug:', {
    email: email,
    EMAIL_USER: process.env.EMAIL_USER ? 'Set' : 'Missing',
    EMAIL: process.env.EMAIL ? 'Set' : 'Missing',
    EMAIL_PASS: process.env.EMAIL_PASS ? 'Set' : 'Missing',
    usingEmail: emailUser,
    NODE_ENV: process.env.NODE_ENV
  });

  if (!email) return res.status(400).json({ message: 'Email required' });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[email] = { otp, expires: Date.now() + 10 * 60 * 1000 }; // 10 minutes

  const hasEmailCreds = Boolean(emailUser && process.env.EMAIL_PASS);
  const isProd = process.env.NODE_ENV === 'production';

  if (!hasEmailCreds && !isProd) {
    // Dev fallback: no email creds; return OTP to help local testing
    console.warn('⚠️ Email credentials not set. Returning OTP in dev mode.');
    return res.json({ success: true, message: 'OTP generated (dev mode)', otp });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: emailUser,
      pass: process.env.EMAIL_PASS
    }
  });

  const mailOptions = {
    from: emailUser,
    to: email,
    subject: 'Your OTP Code',
    text: `Your verification code is ${otp}. It expires in 10 minutes.`
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'OTP sent successfully!' });
  } catch (error) {
    console.error('Email error:', error);
    if (!isProd) {
      // Dev fallback on error: still return OTP to unblock
      return res.json({ success: true, message: 'OTP generated (dev fallback)', otp });
    }
    res.status(500).json({ success: false, error: 'Failed to send OTP' });
  }
});

// verify OTP
app.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body;

  if (!otpStore[email]) {
    return res.status(400).json({ success: false, message: 'OTP not found or expired' });
  }

  const otpData = otpStore[email];
  if (Date.now() > otpData.expires) {
    delete otpStore[email];
    return res.status(400).json({ success: false, message: 'OTP expired' });
  }

  if (otpData.otp === otp) {
    delete otpStore[email];
    verifiedEmails.add(email);
    return res.json({ success: true, message: 'OTP verified!' });
  }
  
  res.status(400).json({ success: false, message: 'Invalid OTP' });
});

// ------------------- USER SIGNUP -------------------
app.post('/signup', async (req, res) => {
  try {
    const { name, email, password, accountType } = req.body;

    if (!name || !email || !password || !accountType) {
      return res.status(400).json({ success: false, message: 'All fields required' });
    }

    // Require OTP verification before allowing signup
    if (!verifiedEmails.has(email)) {
      return res.status(400).json({ success: false, message: 'Please verify OTP before signup' });
    }

    // Check both collections
    const existingTraveler = await Traveler.findOne({ email });
    const existingHost = await Host.findOne({ email });
    
    if (existingTraveler || existingHost) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    let user;

    // Create user data without googleId field to avoid unique constraint issues
    // Don't pre-hash the password - let the model's pre('save') hook handle it
    const userData = {
      name, 
      email, 
      password: password, 
      accountType: accountType === 'host' ? 'host' : 'traveller',
      isVerified: true
    };

    if (accountType === 'host') {
      user = new Host(userData);
    } else {
      user = new Traveler(userData);
    }

    await user.save();

    // consume the verified email marker after successful signup
    verifiedEmails.delete(email);

    res.status(201).json({
      success: true,
      message: 'Signup successful!',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        accountType: user.accountType
      }
    });

  } catch (err) {
    console.error('Signup error:', err);
    
    // ✅ Handle duplicate key error specifically
    if (err.code === 11000) {
      if (err.keyPattern && err.keyPattern.googleId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Database configuration error. Please try again or contact support.' 
        });
      }
      if (err.keyPattern && err.keyPattern.email) {
        return res.status(400).json({ 
          success: false, 
          message: 'User with this email already exists' 
        });
      }
    }
    
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// ------------------- USER LOGIN -------------------
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password required' });

    // Check both collections
    let user = await Traveler.findOne({ email }).select('+password');
    if (!user) {
      user = await Host.findOne({ email }).select('+password');
    }

    if (!user) return res.status(400).json({ success: false, message: 'User not found' });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid)
      return res.status(401).json({ success: false, message: 'Invalid credentials' });

    // Login user with passport
    req.login(user, (err) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Login failed' });
      }
      
      const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET || 'myjwtsecret', { expiresIn: '1d' });

      // Prepare response data
      const userData = {
        id: user._id,
        name: user.name,
        email: user.email,
        accountType: user.accountType
      };

      // For travelers, include liked rooms and viewed history
      if (user.accountType === 'traveller') {
        userData.likedRooms = user.likedRooms || [];
        userData.viewedRooms = user.viewedRooms || [];
      }

      res.json({
        success: true,
        message: 'Login successful',
        token,
        user: userData
      });
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ✅ Add a test route to check if user is authenticated
app.get('/profile', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  res.json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      accountType: req.user.accountType
    }
  });
});

// ✅ Logout route
app.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Logout failed' });
    }
    req.session.destroy();
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

// ------------------- JWT AUTHENTICATION MIDDLEWARE -------------------
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ success: false, message: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'myjwtsecret');
    
    // Find user in database
    let user = await Traveler.findById(decoded.id);
    if (!user) {
      user = await Host.findById(decoded.id);
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Token verification error:', err);
    return res.status(403).json({ success: false, message: 'Invalid or expired token' });
  }
};

// ------------------- TRAVELER LIKED ROOMS ENDPOINTS -------------------
// Update liked rooms for a traveler
app.post('/api/traveler/liked-rooms', authenticateToken, async (req, res) => {
  try {
    const { roomId, action } = req.body; // action: 'add' or 'remove'

    if (!req.user || req.user.accountType !== 'traveller') {
      return res.status(403).json({ success: false, message: 'Only travelers can use this endpoint' });
    }

    const traveler = await Traveler.findById(req.user._id);
    if (!traveler) {
      return res.status(404).json({ success: false, message: 'Traveler not found' });
    }

    if (!traveler.likedRooms) {
      traveler.likedRooms = [];
    }

    if (action === 'add') {
      if (!traveler.likedRooms.includes(roomId)) {
        traveler.likedRooms.push(roomId);
      }
    } else if (action === 'remove') {
      traveler.likedRooms = traveler.likedRooms.filter(id => id !== roomId);
    } else {
      return res.status(400).json({ success: false, message: 'Invalid action. Use "add" or "remove"' });
    }

    await traveler.save();

    res.json({
      success: true,
      message: `Room ${action === 'add' ? 'added to' : 'removed from'} wishlist`,
      likedRooms: traveler.likedRooms
    });
  } catch (err) {
    console.error('Error updating liked rooms:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get liked rooms for a traveler
app.get('/api/traveler/liked-rooms', authenticateToken, async (req, res) => {
  try {
    if (!req.user || req.user.accountType !== 'traveller') {
      return res.status(403).json({ success: false, message: 'Only travelers can use this endpoint' });
    }

    const traveler = await Traveler.findById(req.user._id);
    if (!traveler) {
      return res.status(404).json({ success: false, message: 'Traveler not found' });
    }

    res.json({
      success: true,
      likedRooms: traveler.likedRooms || []
    });
  } catch (err) {
    console.error('Error fetching liked rooms:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ------------------- TRAVELER VIEWED ROOMS (HISTORY) ENDPOINTS -------------------
// Add room to viewing history
app.post('/api/traveler/viewed-rooms', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.body;

    if (!req.user || req.user.accountType !== 'traveller') {
      return res.status(403).json({ success: false, message: 'Only travelers can use this endpoint' });
    }

    if (!roomId) {
      return res.status(400).json({ success: false, message: 'Room ID is required' });
    }

    const traveler = await Traveler.findById(req.user._id);
    if (!traveler) {
      return res.status(404).json({ success: false, message: 'Traveler not found' });
    }

    if (!traveler.viewedRooms) {
      traveler.viewedRooms = [];
    }

    // Remove existing entry for this room if exists (to update timestamp)
    traveler.viewedRooms = traveler.viewedRooms.filter(entry => entry.roomId !== roomId);

    // Add new entry at the beginning
    traveler.viewedRooms.unshift({
      roomId: roomId,
      viewedAt: new Date()
    });

    // Keep only last 50 viewed rooms
    if (traveler.viewedRooms.length > 50) {
      traveler.viewedRooms = traveler.viewedRooms.slice(0, 50);
    }

    await traveler.save();

    res.json({
      success: true,
      message: 'Room added to history',
      viewedRooms: traveler.viewedRooms
    });
  } catch (err) {
    console.error('Error updating viewed rooms:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get viewing history for a traveler
app.get('/api/traveler/viewed-rooms', authenticateToken, async (req, res) => {
  try {
    if (!req.user || req.user.accountType !== 'traveller') {
      return res.status(403).json({ success: false, message: 'Only travelers can use this endpoint' });
    }

    const traveler = await Traveler.findById(req.user._id);
    if (!traveler) {
      return res.status(404).json({ success: false, message: 'Traveler not found' });
    }

    res.json({
      success: true,
      viewedRooms: traveler.viewedRooms || []
    });
  } catch (err) {
    console.error('Error fetching viewed rooms:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ------------------- FORGOT PASSWORD -------------------
app.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // Check if user exists in both collections
    let user = await Traveler.findOne({ email });
    if (!user) {
      user = await Host.findOne({ email });
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Generate reset token (simple implementation - in production use crypto.randomBytes)
    const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour

    // Store reset token in user document
    user.resetToken = resetToken;
    user.resetTokenExpires = resetTokenExpires;
    await user.save();

    // Send reset email using the same configuration as OTP emails
    const emailUser = process.env.EMAIL_USER || process.env.EMAIL;
    const hasEmailCreds = Boolean(emailUser && process.env.EMAIL_PASS);
    const isProd = process.env.NODE_ENV === 'production';

    if (!hasEmailCreds && !isProd) {
      // Dev fallback: no email creds; return reset link to help local testing
      const resetLink = `http://localhost:3000/reset-password?email=${encodeURIComponent(email)}&token=${resetToken}`;
      console.log(`🔧 Password reset link for ${email}: ${resetLink}`);
      return res.json({
        success: true,
        message: 'Password reset instructions sent to your email',
        resetLink: resetLink // For development
      });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: process.env.EMAIL_PASS
      }
    });

    const resetLink = `http://localhost:3000/reset-password?email=${encodeURIComponent(email)}&token=${resetToken}`;
    
    const mailOptions = {
      from: emailUser,
      to: email,
      subject: 'Password Reset - ShelterSeek',
      text: `Hello ${user.name},\n\nYou requested a password reset for your ShelterSeek account.\n\nClick the link below to reset your password:\n${resetLink}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this reset, please ignore this email.\n\nBest regards,\nShelterSeek Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>Hello ${user.name},</p>
          <p>You requested a password reset for your ShelterSeek account.</p>
          <p>Click the button below to reset your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
          </div>
          <p style="color: #666; font-size: 14px;">This link will expire in 1 hour.</p>
          <p style="color: #666; font-size: 14px;">If you didn't request this reset, please ignore this email.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px;">Best regards,<br>ShelterSeek Team</p>
        </div>
      `
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`✅ Password reset email sent to ${email}`);
      
      res.json({
        success: true,
        message: 'Password reset instructions sent to your email'
      });
    } catch (error) {
      console.error('❌ Password reset email error:', error);
      if (!isProd) {
        // Dev fallback on error: still return reset link to unblock
        const resetLink = `http://localhost:3000/reset-password?email=${encodeURIComponent(email)}&token=${resetToken}`;
        console.log(`🔧 Password reset link for ${email}: ${resetLink}`);
        return res.json({
          success: true,
          message: 'Password reset instructions sent to your email',
          resetLink: resetLink // For development
        });
      }
      throw error;
    }

  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ------------------- RESET PASSWORD -------------------
app.post('/reset-password', async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;
    
    if (!email || !token || !newPassword) {
      return res.status(400).json({ success: false, message: 'Email, token, and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long' });
    }

    // Find user with valid reset token
    let user = await Traveler.findOne({ 
      email, 
      resetToken: token,
      resetTokenExpires: { $gt: new Date() }
    });
    
    if (!user) {
      user = await Host.findOne({ 
        email, 
        resetToken: token,
        resetTokenExpires: { $gt: new Date() }
      });
    }

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }

    // Update password (let the pre('save') hook handle hashing)
    user.password = newPassword;
    user.resetToken = undefined;
    user.resetTokenExpires = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successful'
    });

  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ------------------- API ROOMS ENDPOINT -------------------
const RoomData = require('./model/room');

app.get('/api/rooms', async (req, res) => {
  try {
    console.log('🔍 Fetching rooms from database...');
    
    // Fetch verified rooms that are not booked
    // Also check for status 'verified' or 'approved' (case insensitive)
    const rooms = await RoomData.find({ 
      $or: [
        { status: { $regex: /^verified$/i } },
        { status: { $regex: /^approved$/i } }
      ],
      booking: { $ne: true } // Exclude booked rooms
    }).lean();
    
    console.log(`✅ Found ${rooms.length} available rooms`);
    
    // Process room data for the frontend
    const processedRooms = rooms.map(room => ({
      _id: room._id?.toString(),
      id: room.id || room._id?.toString(),
      name: room.name || 'Unknown Host',
      email: room.email || '',
      title: room.title || 'Untitled Room',
      description: room.description || 'No description available',
      price: room.price || 0,
      location: room.location || 'Location not specified',
      coordinates: room.coordinates || { lat: 13.0827, lng: 80.2707 },
      images: room.images || [],
      status: room.status || 'pending',
      amenities: room.amenities || [],
      availability: room.availability || [],
      propertyType: room.propertyType || '',
      capacity: room.capacity || 0,
      roomType: room.roomType || '',
      bedrooms: room.bedrooms || 0,
      beds: room.beds || 0,
      maxdays: room.maxdays || room.maxDays || 10,
      roomSize: room.roomSize || 'Medium',
      roomLocation: room.roomLocation || '',
      transportDistance: room.transportDistance || '',
      hostGender: room.hostGender || '',
      foodFacility: room.foodFacility || '',
      discount: room.discount || 0,
      likes: room.likes || 0,
      reviews: room.reviews || [],
      booking: room.booking || false,
      createdAt: room.createdAt
    }));

    res.json({
      status: 'success',
      data: processedRooms
    });

  } catch (error) {
    console.error('❌ Error fetching rooms:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch rooms',
      error: error.message
    });
  }
});

// ------------------- BOOKING ENDPOINTS -------------------
// Create a new booking
app.post('/api/bookings', authenticateToken, async (req, res) => {
  try {
    const { roomId, checkIn, checkOut, days, totalCost, hostEmail } = req.body;

    if (!roomId || !checkIn || !checkOut || !days || !totalCost) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required booking information' 
      });
    }

    // Check if room exists and is available
    const room = await RoomData.findById(roomId);
    if (!room) {
      return res.status(404).json({ 
        success: false, 
        message: 'Room not found' 
      });
    }

    if (room.booking === true) {
      return res.status(400).json({ 
        success: false, 
        message: 'Room is already booked' 
      });
    }

    // Create booking record (you might want to create a separate Booking model)
    // For now, we'll just mark the room as booked
    room.booking = true;
    await room.save();

    res.json({
      success: true,
      message: 'Booking created successfully',
      booking: {
        roomId: roomId,
        checkIn: checkIn,
        checkOut: checkOut,
        days: days,
        totalCost: totalCost,
        hostEmail: hostEmail
      }
    });

  } catch (err) {
    console.error('Error creating booking:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: err.message 
    });
  }
});

// Mark room as booked
app.put('/api/rooms/:roomId/book', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { booking, bookedDates } = req.body;

    const room = await RoomData.findById(roomId);
    if (!room) {
      return res.status(404).json({ 
        success: false, 
        message: 'Room not found' 
      });
    }

    room.booking = booking !== undefined ? booking : true;
    
    // Optionally store booked dates
    if (bookedDates && bookedDates.checkIn && bookedDates.checkOut) {
      // You could add a bookedDates field to the schema if needed
      // For now, we'll just mark it as booked
    }

    await room.save();

    res.json({
      success: true,
      message: `Room ${booking ? 'marked as booked' : 'marked as available'}`,
      room: {
        _id: room._id,
        booking: room.booking
      }
    });

  } catch (err) {
    console.error('Error updating booking status:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: err.message 
    });
  }
});

// ✅ Health check route
app.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Server is running', 
    timestamp: new Date().toISOString() 
  });
});

// ✅ API status route
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    message: 'API is working',
    endpoints: {
      auth: '/auth',
      rooms: '/api/rooms',
      health: '/health'
    },
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📧 Email User: ${process.env.EMAIL_USER || process.env.EMAIL || 'Not configured'}`);
  console.log(`🏠 Rooms API: http://localhost:${PORT}/api/rooms`);
  console.log(`❤️ Health Check: http://localhost:${PORT}/health`);
});