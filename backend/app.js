require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');
const passport = require('passport');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cors = require('cors');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Models
const { Traveler, Host } = require('./model/usermodel');
const RoomData = require('./model/room');

const app = express();
const PORT = process.env.PORT || 3001;

// ==================== DATABASE CONNECTIONS ====================

// Main DB (Users, Sessions, Auth)
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/yourdb')
  .then(() => console.log('Main MongoDB connected'))
  .catch(err => console.error('Main DB connection error:', err));

// Host/Admin DB (Listings, GridFS)
const hostAdminUri = process.env.HOST_ADMIN_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/yourdb';
global.hostAdminConnection = mongoose.createConnection(hostAdminUri, {
  retryWrites: true,
  w: 'majority'
});

global.hostAdminConnection.on('connected', () => {
  console.log('Connected to Host_Admin database');
  
  // Initialize GridFS
  if (!global.gfsBucket) {
    global.gfsBucket = new GridFSBucket(global.hostAdminConnection.db, { bucketName: 'images' });
    console.log('GridFS bucket initialized');
  }

  // Initialize host models
  const hostController = require('./controllers/hostController');
  try {
    hostController.initializeHostModels();
    console.log('Host models initialized');
  } catch (err) {
    console.error('Failed to initialize host models:', err);
  }
});

global.hostAdminConnection.on('error', (err) => {
  console.error('Host_Admin DB connection error:', err.message);
});

// ==================== MIDDLEWARE ====================

app.use(cors({ 
  origin: process.env.FRONTEND_URL || 'http://localhost:3000', 
  credentials: true 
}));
app.use(express.json());

// Session with MongoStore
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

// Passport
app.use(passport.initialize());
app.use(passport.session());
require('./config/passport')(passport);

// Routes
const authRoutes = require('./routes/authRoutes');
const hostRoutes = require('./routes/hostRoutes');
app.use('/auth', authRoutes);
app.use('/api', hostRoutes);

// ==================== OTP & EMAIL SYSTEM ====================

const otpStore = {};
const verifiedEmails = new Set();

// Email Test: Config Check
app.get('/test-email-config', async (req, res) => {
  try {
    const emailUser = process.env.EMAIL_USER || process.env.EMAIL;
    const hasEmailCreds = Boolean(emailUser && process.env.EMAIL_PASS);

    if (!hasEmailCreds) {
      return res.json({ success: false, message: 'Email credentials missing' });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: emailUser, pass: process.env.EMAIL_PASS }
    });

    await transporter.verify();
    res.json({ success: true, message: 'Email configuration is correct!', email: emailUser });
  } catch (error) {
    res.json({ success: false, message: 'Email config error', error: error.message });
  }
});

// Email Test: Send Test OTP
app.post('/simple-email-test', async (req, res) => {
  try {
    const { toEmail } = req.body;
    if (!toEmail) return res.status(400).json({ success: false, message: 'Email required' });

    const emailUser = process.env.EMAIL_USER || process.env.EMAIL;
    const hasEmailCreds = Boolean(emailUser && process.env.EMAIL_PASS);

    if (!hasEmailCreds) {
      return res.status(400).json({ success: false, message: 'Email not configured' });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: emailUser, pass: process.env.EMAIL_PASS }
    });

    const testOtp = Math.floor(100000 + Math.random() * 900000).toString();
    await transporter.sendMail({
      from: emailUser,
      to: toEmail,
      subject: 'Test OTP Email - Working!',
      html: `<p>Your test OTP is: <strong>${testOtp}</strong></p>`
    });

    res.json({ success: true, message: 'Test email sent!', testOtp });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to send test email', error: error.message });
  }
});

// Send OTP
app.post('/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email required' });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[email] = { otp, expires: Date.now() + 10 * 60 * 1000 }; // 10 min

  const emailUser = process.env.EMAIL_USER || process.env.EMAIL;
  const hasEmailCreds = Boolean(emailUser && process.env.EMAIL_PASS);
  const isProd = process.env.NODE_ENV === 'production';

  if (!hasEmailCreds && !isProd) {
    return res.json({ success: true, message: 'OTP generated (dev)', otp });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: emailUser, pass: process.env.EMAIL_PASS }
  });

  try {
    await transporter.sendMail({
      from: emailUser,
      to: email,
      subject: 'Your OTP Code',
      text: `Your verification code is ${otp}. Expires in 10 minutes.`
    });
    res.json({ success: true, message: 'OTP sent successfully!' });
  } catch (error) {
    if (!isProd) {
      return res.json({ success: true, message: 'OTP generated (fallback)', otp });
    }
    res.status(500).json({ success: false, error: 'Failed to send OTP' });
  }
});

// Verify OTP
app.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  const data = otpStore[email];

  if (!data || Date.now() > data.expires) {
    delete otpStore[email];
    return res.status(400).json({ success: false, message: 'OTP expired or invalid' });
  }

  if (data.otp === otp) {
    delete otpStore[email];
    verifiedEmails.add(email);
    return res.json({ success: true, message: 'OTP verified!' });
  }

  res.status(400).json({ success: false, message: 'Invalid OTP' });
});

// ==================== AUTH ENDPOINTS ====================

// Signup
app.post('/signup', async (req, res) => {
  try {
    const { name, email, password, accountType } = req.body;
    if (!name || !email || !password || !accountType) {
      return res.status(400).json({ success: false, message: 'All fields required' });
    }

    if (!verifiedEmails.has(email)) {
      return res.status(400).json({ success: false, message: 'Please verify OTP first' });
    }

    const exists = await Traveler.findOne({ email }) || await Host.findOne({ email });
    if (exists) return res.status(400).json({ success: false, message: 'User already exists' });

    const userData = {
      name, email, password,
      accountType: accountType === 'host' ? 'host' : 'traveller',
      isVerified: true
    };

    const user = accountType === 'host' ? new Host(userData) : new Traveler(userData);
    await user.save();
    verifiedEmails.delete(email);

    res.status(201).json({
      success: true,
      message: 'Signup successful!',
      user: { id: user._id, name: user.name, email: user.email, accountType: user.accountType }
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Login
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email & password required' });

    let user = await Traveler.findOne({ email }).select('+password') ||
               await Host.findOne({ email }).select('+password');

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    req.login(user, async (err) => {
      if (err) return res.status(500).json({ success: false, message: 'Login failed' });

      const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET || 'myjwtsecret', { expiresIn: '1d' });

      const userData = {
        id: user._id, name: user.name, email: user.email, accountType: user.accountType
      };

      if (user.accountType === 'traveller') {
        userData.likedRooms = user.likedRooms || [];
        userData.viewedRooms = user.viewedRooms || [];
      }

      res.json({ success: true, message: 'Login successful', token, user: userData });
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Profile (Authenticated)
app.get('/profile', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ success: false, message: 'Not authenticated' });
  res.json({
    success: true,
    user: { id: req.user._id, name: req.user.name, email: req.user.email, accountType: req.user.accountType }
  });
});

// Logout
app.post('/logout', (req, res) => {
  req.logout(() => {});
  req.session.destroy();
  res.json({ success: true, message: 'Logged out' });
});

// ==================== JWT MIDDLEWARE ====================

const authenticateToken = async (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'Token required' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'myjwtsecret');
    const user = await Traveler.findById(decoded.id) || await Host.findById(decoded.id);
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });
    req.user = user;
    next();
  } catch (err) {
    res.status(403).json({ success: false, message: 'Invalid token' });
  }
};

// ==================== TRAVELER FEATURES ====================

// Liked Rooms
app.post('/api/traveler/liked-rooms', authenticateToken, async (req, res) => {
  if (req.user.accountType !== 'traveller') return res.status(403).json({ success: false, message: 'Traveler only' });

  const { roomId, action } = req.body;
  const traveler = await Traveler.findById(req.user._id);
  if (!traveler) return res.status(404).json({ success: false, message: 'Not found' });

  traveler.likedRooms = traveler.likedRooms || [];
  if (action === 'add' && !traveler.likedRooms.includes(roomId)) {
    traveler.likedRooms.push(roomId);
  } else if (action === 'remove') {
    traveler.likedRooms = traveler.likedRooms.filter(id => id !== roomId);
  } else {
    return res.status(400).json({ success: false, message: 'Invalid action' });
  }

  await traveler.save();
  res.json({ success: true, likedRooms: traveler.likedRooms });
});

app.get('/api/traveler/liked-rooms', authenticateToken, async (req, res) => {
  if (req.user.accountType !== 'traveller') return res.status(403).json({ success: false, message: 'Traveler only' });
  const traveler = await Traveler.findById(req.user._id);
  res.json({ success: true, likedRooms: traveler?.likedRooms || [] });
});

// Viewed Rooms (History)
app.post('/api/traveler/viewed-rooms', authenticateToken, async (req, res) => {
  if (req.user.accountType !== 'traveller') return res.status(403).json({ success: false, message: 'Traveler only' });
  const { roomId } = req.body;
  if (!roomId) return res.status(400).json({ success: false, message: 'roomId required' });

  const traveler = await Traveler.findById(req.user._id);
  traveler.viewedRooms = traveler.viewedRooms || [];
  traveler.viewedRooms = traveler.viewedRooms.filter(r => r.roomId !== roomId);
  traveler.viewedRooms.unshift({ roomId, viewedAt: new Date() });
  if (traveler.viewedRooms.length > 50) traveler.viewedRooms.pop();

  await traveler.save();
  res.json({ success: true, viewedRooms: traveler.viewedRooms });
});

app.get('/api/traveler/viewed-rooms', authenticateToken, async (req, res) => {
  if (req.user.accountType !== 'traveller') return res.status(403).json({ success: false, message: 'Traveler only' });
  const traveler = await Traveler.findById(req.user._id);
  res.json({ success: true, viewedRooms: traveler?.viewedRooms || [] });
});

// ==================== PASSWORD RESET ====================

app.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email required' });

    const user = await Traveler.findOne({ email }) || await Host.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    user.resetToken = resetToken;
    user.resetTokenExpires = Date.now() + 3600000;
    await user.save();

    const emailUser = process.env.EMAIL_USER || process.env.EMAIL;
    const hasEmailCreds = Boolean(emailUser && process.env.EMAIL_PASS);
    const isProd = process.env.NODE_ENV === 'production';

    const resetLink = `http://localhost:3000/reset-password?email=${encodeURIComponent(email)}&token=${resetToken}`;

    if (!hasEmailCreds && !isProd) {
      console.log(`DEV RESET LINK: ${resetLink}`);
      return res.json({ success: true, message: 'Check console for link', resetLink });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: emailUser, pass: process.env.EMAIL_PASS }
    });

    await transporter.sendMail({
      from: emailUser,
      to: email,
      subject: 'Password Reset - ShelterSeek',
      html: `<p>Click <a href="${resetLink}">here</a> to reset your password. Expires in 1 hour.</p>`
    });

    res.json({ success: true, message: 'Reset email sent' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/reset-password', async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;
    if (!email || !token || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Invalid input' });
    }

    const user = await Traveler.findOne({ email, resetToken: token, resetTokenExpires: { $gt: Date.now() } }) ||
                 await Host.findOne({ email, resetToken: token, resetTokenExpires: { $gt: Date.now() } });

    if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired token' });

    user.password = newPassword;
    user.resetToken = undefined;
    user.resetTokenExpires = undefined;
    await user.save();

    res.json({ success: true, message: 'Password reset successful' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==================== ROOMS & BOOKINGS ====================

app.get('/api/rooms', async (req, res) => {
  try {
    const rooms = await RoomData.find({
      $or: [{ status: /verified/i }, { status: /approved/i }],
      booking: { $ne: true }
    }).lean();

    const processed = rooms.map(r => ({
      _id: r._id.toString(),
      id: r._id.toString(),
      name: r.name || 'Unknown',
      title: r.title || 'Untitled',
      description: r.description || '',
      price: r.price || 0,
      location: r.location || '',
      coordinates: r.coordinates || { lat: 13.0827, lng: 80.2707 },
      images: r.images || [],
      amenities: r.amenities || [],
      availability: r.availability || [],
      propertyType: r.propertyType || '',
      capacity: r.capacity || 0,
      roomType: r.roomType || '',
      bedrooms: r.bedrooms || 0,
      beds: r.beds || 0,
      maxdays: r.maxdays || 10,
      roomSize: r.roomSize || 'Medium',
      hostGender: r.hostGender || '',
      foodFacility: r.foodFacility || '',
      discount: r.discount || 0,
      likes: r.likes || 0,
      reviews: r.reviews || [],
      booking: false,
      createdAt: r.createdAt
    }));

    res.json({ status: 'success', data: processed });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch rooms' });
  }
});

// Create Booking
app.post('/api/bookings', authenticateToken, async (req, res) => {
  const { roomId, checkIn, checkOut, days, totalCost } = req.body;
  if (!roomId || !checkIn || !checkOut || !days || !totalCost) {
    return res.status(400).json({ success: false, message: 'Missing fields' });
  }

  const room = await RoomData.findById(roomId);
  if (!room || room.booking) {
    return res.status(400).json({ success: false, message: 'Room unavailable' });
  }

  room.booking = true;
  await room.save();

  res.json({ success: true, message: 'Booking confirmed', booking: { roomId, checkIn, checkOut, days, totalCost } });
});

// Update Booking Status
app.put('/api/rooms/:roomId/book', authenticateToken, async (req, res) => {
  const { booking = true } = req.body;
  const room = await RoomData.findById(req.params.roomId);
  if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

  room.booking = booking;
  await room.save();

  res.json({ success: true, message: `Room ${booking ? 'booked' : 'freed'}`, room: { _id: room._id, booking: room.booking } });
});

// ==================== DEBUG & HEALTH ====================

app.get('/debug-env', (req, res) => {
  res.json({
    EMAIL_USER: process.env.EMAIL_USER || 'Not set',
    EMAIL_PASS: process.env.EMAIL_PASS ? `Set (${process.env.EMAIL_PASS.length})` : 'Not set',
    NODE_ENV: process.env.NODE_ENV,
    MONGODB_URI: process.env.MONGODB_URI ? 'Set' : 'Not set'
  });
});

app.get('/health', (req, res) => {
  res.json({ success: true, message: 'Server running', timestamp: new Date().toISOString() });
});

app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    message: 'API working',
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

app.get('/api/user-counts', async (req, res) => {
  try {
    // Count travelers and hosts separately by filtering by accountType
    const travelerCount = await Traveler.countDocuments({ accountType: 'traveller' });
    const hostCount = await Host.countDocuments({ accountType: 'host' });
    
    res.json({
      success: true,
      travelerCount,
      hostCount
    });
  } catch (error) {
    console.error('Error fetching user counts:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error fetching user counts'
    });
  }
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Email: ${process.env.EMAIL_USER || process.env.EMAIL || 'Not set'}`);
  console.log(`Rooms: http://localhost:${PORT}/api/rooms`);
  console.log(`Health: http://localhost:${PORT}/health`);
});