require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path'); //j
const { GridFSBucket } = require('mongodb');
const rateLimit = require('express-rate-limit'); //j
const passport = require('passport');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cors = require('cors');
const nodemailer = require('nodemailer');//j
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');//j
const mkdirp = require('mkdirp');//j
const hostController = require('./controllers/hostController');//j
const adminController = require('./controllers/adminController');//j

// Models
const { Traveler, Host } = require('./model/usermodel');
const RoomData = require('./model/Room');//j

const app = express();
const PORT = process.env.PORT || 3001;

//j
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  max: 500,
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP',
});
app.use('/api', limiter);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// // Uploads folder
const uploadsDir = path.join(__dirname, 'public/uploads');
mkdirp.sync(uploadsDir);
const upload = multer({
  dest: uploadsDir,
  storage: multer.diskStorage({
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
  }),
});

// Main DB (Users, Sessions, Auth)


const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/loginDataBase';
const HOST_ADMIN_URI = process.env.HOST_ADMIN_URI || 'mongodb://localhost:27017/Host_Admin';
const ADMIN_TRAVELER_URI = process.env.ADMIN_TRAVELER_URI || 'mongodb://localhost:27017/Admin_Traveler';
const PAYMENT_DB_URI = process.env.PAYMENT_DB_URI || 'mongodb://localhost:27017/payment';


//j
// ==================== DATABASE CONNECTIONS ====================

// Main DB (Users, Sessions, Auth)
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/yourdb')
  .then(() => console.log('Main MongoDB connected'))
  .catch(err => console.error('Main DB connection error:', err));

//j
const loginDataSchema = new mongoose.Schema({
  name: String,
  email: String,
  accountType: String,
  createdAt: { type: Date, default: Date.now },
});
const LoginData = mongoose.model('LoginData', loginDataSchema, 'LoginData');
//j

// Host/Admin DB (Listings, GridFS)
const hostAdminUri = process.env.HOST_ADMIN_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/yourdb';
global.hostAdminConnection = mongoose.createConnection(hostAdminUri, {
  retryWrites: true,
  w: 'majority'
});

const paymentDBUri = process.env.PAYMENT_DB_URI || 'mongodb://localhost:27017/payment';
const paymentConnection = mongoose.createConnection(paymentDBUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  retryWrites: true,
  w: 'majority'
});

paymentConnection.on('connected', () => {
  console.log('Connected to Payment/Booking database');
});

paymentConnection.on('error', (err) => {
  console.error('Payment/Booking DB connection error:', err.message);
});

// Booking Model using payment database
const Booking = paymentConnection.model('Booking', require('./model/Booking').schema);
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

//j
const hostAdminConnection = mongoose.createConnection(HOST_ADMIN_URI, { useNewUrlParser: true, useUnifiedTopology: true });
const travelerConnection = mongoose.createConnection(ADMIN_TRAVELER_URI, { useNewUrlParser: true, useUnifiedTopology: true });
// const paymentConnection = mongoose.createConnection(PAYMENT_DB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

hostAdminConnection.once('open', () => console.log('Connected to Host_Admin'));
travelerConnection.once('open', () => console.log('Connected to Admin_Traveler'));
paymentConnection.once('open', () => console.log('Connected to payment'));

// // GridFS setup for Host_Admin DB
let gfsBucket;
hostAdminConnection.once('open', () => {
  gfsBucket = new GridFSBucket(hostAdminConnection.db, { bucketName: 'images' });
  console.log('GridFS Bucket initialized');
});

// const RoomData = hostAdminConnection.model('RoomData', new mongoose.Schema({}, { collection: 'RoomData' }));

// ✅ ---- ROUTES ----


// const createBookingModel = require('./model/booking');
// const Booking = createBookingModel(paymentConnection);

//j



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
      subject: '🔐 Your ShelterSeek Verification Code',
    
      html: `
        <div style="
            max-width: 480px;
            margin: auto;
            padding: 25px;
            background: #ffffff;
            border-radius: 12px;
            font-family: Arial, Helvetica, sans-serif;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
            color: #333;
            line-height: 1.6;
        ">
    
            <h2 style="
                text-align: center;
                color: #d72d6e;
                margin-bottom: 10px;
                font-size: 24px;
            ">
                🔐 ShelterSeek Verification
            </h2>
    
            <p style="font-size: 15px; margin-bottom: 18px;">
                Hello Traveler 👋,<br><br>
                Use the following One-Time Password (OTP) to verify your account:
            </p>
    
            <div style="
                text-align: center;
                background: #ffe8f1;
                border-left: 5px solid #d72d6e;
                padding: 18px 20px;
                border-radius: 8px;
                margin: 20px 0;
            ">
                <p style="
                    font-size: 34px;
                    letter-spacing: 4px;
                    color: #d72d6e;
                    font-weight: bold;
                    margin: 0;
                ">
                    ${otp}
                </p>
                <p style="font-size: 13px; color: #777; margin-top: 8px;">
                    ⏳ Valid for 10 minutes
                </p>
            </div>
    
            <p style="font-size: 14px; color:#444;">
                ⚠️ Please keep this code confidential.<br>
                Do not share it with anyone for your security.
            </p>
    
            <p style="font-size: 13px; color:#777; margin-top: 25px; text-align: center;">
                If you did not request this verification code, you may safely ignore this email ❌.
                <br><br>
                — Team ShelterSeek 💖
            </p>
    
        </div>
      `
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
    // Extract user from token if provided
    let userId = null;
    const token = req.headers['authorization']?.split(' ')[1];
    
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'myjwtsecret');
        const user = await Traveler.findById(decoded.id) || await Host.findById(decoded.id);
        if (user) {
          userId = user._id.toString();
        }
      } catch (err) {
        // Invalid token, treat as guest
      }
    }

    // Build query based on user status
    let query = {
      $or: [{ status: /verified/i }, { status: /approved/i }]
    };

    if (!userId) {
      // Guest user: only see non-booked rooms
      query.booking = { $ne: true };
    } else {
      // Logged-in user: see non-booked rooms OR rooms booked by themselves
      query = {
        $and: [
          { $or: [{ status: /verified/i }, { status: /approved/i }] },
          {
            $or: [
              { booking: { $ne: true } },  // Available rooms
              { bookedBy: userId }          // OR rooms booked by this user
            ]
          }
        ]
      };
      
      // If user is a host, show all their rooms regardless of booking status
      const user = await Traveler.findById(userId) || await Host.findById(userId);
      if (user && user.accountType === 'host') {
        query = {
          $or: [
            { email: user.email },  // Host's own rooms
            {
              $and: [
                { $or: [{ status: /verified/i }, { status: /approved/i }] },
                {
                  $or: [
                    { booking: { $ne: true } },
                    { bookedBy: userId }
                  ]
                }
              ]
            }
          ]
        };
      }
    }

    const rooms = await RoomData.find(query).lean();

    // Process each room to format the data properly
    const processed = rooms.map(room => {
      const images = room.images?.map(img => {
        if (typeof img === 'object' && img.$oid) {
          return `/api/images/${img.$oid}`;
        }
        return img;
      }) || [];

      const coordinates = room.coordinates || { lat: 13.0827, lng: 80.2707 };

      const unavailableDates = room.unavailableDates?.map(date => {
        if (date?.$date) {
          return new Date(date.$date).toISOString().split('T')[0];
        }
        return date instanceof Date ? date.toISOString().split('T')[0] : date;
      }) || [];

      return {
        _id: room._id?.toString(),
        id: room._id?.toString(),
        name: room.name || 'Unknown',
        title: room.title || 'Untitled',
        description: room.description || '',
        price: room.price || 0,
        location: room.location || '',
        coordinates,
        roomLocation: room.roomLocation || '',
        transportDistance: room.transportDistance || '',
        images,
        amenities: room.amenities || [],
        unavailableDates,
        propertyType: room.propertyType || '',
        capacity: room.capacity || 0,
        roomType: room.roomType || '',
        bedrooms: room.bedrooms || 0,
        beds: room.beds || 0,
        roomSize: room.roomSize || 'Medium',
        foodFacility: room.foodFacility || '',
        discount: room.discount || 0,
        maxdays: room.maxdays || 10,
        likes: room.likes || 0,
        reviews: room.reviews || [],
        booking: room.booking || false,
        bookedBy: room.bookedBy || null,
        isBookedByMe: userId ? room.bookedBy?.toString() === userId : false,
        status: room.status || 'pending',
        createdAt: room.createdAt,
        updatedAt: room.updatedAt
      };
    });

    res.json({
      status: 'success',
      count: processed.length,
      data: processed
    });

  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch rooms'
    });
  }
});


// Create Booking
// In app.js, replace the /api/bookings endpoint with this corrected version:

app.post('/api/bookings', authenticateToken, async (req, res) => {
  try {
    const { 
      roomId, 
      checkIn, 
      checkOut, 
      days, 
      totalCost, 
      hostEmail, 
      guests = 1,
      guestDetails = [],
      specialRequests = '',
      paymentDetails = {}
    } = req.body;
    
    if (!roomId || !checkIn || !checkOut || !days || !totalCost) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Fetch room details
    const room = await RoomData.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    // Check capacity
    if (guests > room.capacity) {
      return res.status(400).json({ 
        success: false, 
        message: `Maximum capacity is ${room.capacity} guests` 
      });
    }

    // Check if room is already booked for these dates
    const existingBooking = await Booking.findOne({
      roomId: roomId,
      $or: [
        {
          checkIn: { $lte: new Date(checkOut) },
          checkOut: { $gte: new Date(checkIn) }
        }
      ],
      bookingStatus: { $in: ['confirmed', 'pending', 'checked_in'] }
    });

    if (existingBooking) {
      return res.status(400).json({ success: false, message: 'Room already booked for selected dates' });
    }

    // Generate transaction ID if not provided
    const transactionId = paymentDetails.transactionId || 
      `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // Create booking record in payment database
    const booking = new Booking({
      travelerId: req.user._id,
      travelerName: req.user.name,
      travelerEmail: req.user.email,
      roomId: roomId,
      roomTitle: room.title || room.name,
      hostId: room._id.toString(),
      hostEmail: hostEmail || room.email,
      checkIn: new Date(checkIn),
      checkOut: new Date(checkOut),
      days: days,
      totalCost: totalCost,
      guests: guests,
      guestDetails: guestDetails.map(guest => ({
        guestName: guest.guestName,
        guestAge: guest.guestAge ? parseInt(guest.guestAge) : undefined,
        guestGender: guest.guestGender,
        guestContact: guest.guestContact,
        govtIdType: guest.govtIdType,
        govtIdNumber: guest.govtIdNumber
      })),
      paymentDetails: {
        paymentMethod: paymentDetails.paymentMethod || 'credit_card',
        cardLastFour: paymentDetails.cardLastFour,
        cardType: paymentDetails.cardType,
        transactionId: transactionId,
        paymentGateway: paymentDetails.paymentGateway || 'razorpay',
        paymentDate: new Date()
      },
      bookingStatus: 'confirmed',
      paymentStatus: 'completed',
      specialRequests: specialRequests,
      bookedAt: new Date()
    });

    await booking.save();

    // Update room with booking status and unavailable dates
    await RoomData.findByIdAndUpdate(roomId, {
      booking: true,
      bookedBy: req.user._id,
      $addToSet: { unavailableDates: { $each: generateDateRange(checkIn, checkOut) } }
    });

    // Update user's booking history (for travelers)
    if (req.user.accountType === 'traveller') {
      try {
        const traveler = await Traveler.findById(req.user._id);
        if (traveler) {
          if (!traveler.bookings) traveler.bookings = [];
          
          const userBooking = {
            bookingId: booking.bookingId || booking._id.toString(),
            roomId: roomId,
            roomTitle: room.title || room.name,
            hostId: room._id.toString(),
            hostEmail: hostEmail || room.email,
            checkIn: new Date(checkIn),
            checkOut: new Date(checkOut),
            days: days,
            totalCost: totalCost,
            status: 'confirmed',
            bookedAt: new Date(),
            guests: guests,
            guestDetails: guestDetails,
            paymentStatus: 'completed',
            paymentMethod: paymentDetails.paymentMethod || 'credit_card',
            transactionId: transactionId,
            specialRequests: specialRequests
          };
          
          traveler.bookings.unshift(userBooking);
          
          if (traveler.bookings.length > 100) {
            traveler.bookings = traveler.bookings.slice(0, 100);
          }
          
          await traveler.save();
          console.log('Booking added to traveler:', traveler._id);
        }
      } catch (err) {
        console.error('Error updating traveler bookings:', err);
        // Don't fail the whole request if this fails
      }
    }

    // Update host's booking history
    if (room.email) {
      try {
        const host = await Host.findOne({ email: room.email });
        if (host) {
          if (!host.hostBookings) host.hostBookings = [];
          
          const hostBooking = {
            bookingId: booking.bookingId || booking._id.toString(),
            roomId: roomId,
            roomTitle: room.title || room.name,
            travelerId: req.user._id,
            travelerName: req.user.name,
            travelerEmail: req.user.email,
            checkIn: new Date(checkIn),
            checkOut: new Date(checkOut),
            days: days,
            totalCost: totalCost,
            status: 'confirmed',
            bookedAt: new Date(),
            guests: guests,
            guestDetails: guestDetails,
            specialRequests: specialRequests,
            transactionId: transactionId
          };
          
          host.hostBookings.unshift(hostBooking);
          
          if (host.hostBookings.length > 100) {
            host.hostBookings = host.hostBookings.slice(0, 100);
          }
          
          await host.save();
          console.log('Booking added to host:', host._id);
        }
      } catch (err) {
        console.error('Error updating host bookings:', err);
        // Don't fail the whole request if this fails
      }
    }

    // Send confirmation email (optional)
    try {
      const emailUser = process.env.EMAIL_USER || process.env.EMAIL;
      const hasEmailCreds = Boolean(emailUser && process.env.EMAIL_PASS);
      
      if (hasEmailCreds) {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: emailUser, pass: process.env.EMAIL_PASS }
        });

        await transporter.sendMail({
          from: emailUser,
          to: req.user.email,
          subject: 'Booking Confirmation - ShelterSeek',
          html: `
            <div style="
                  max-width: 520px;
                  margin: auto;
                  padding: 25px;
                  background: #ffffff;
                  border-radius: 14px;
                  font-family: 'Segoe UI', Arial, sans-serif;
                  box-shadow: 0 6px 18px rgba(0,0,0,0.1);
                  line-height: 1.5;
                  color: #333;
            ">
                  <h1 style="
                      color: #d72d6e;
                      text-align: center;
                      font-size: 28px;
                      margin-bottom: 5px;
                  ">
                      Hello Traveler! 🏡
                  </h1>

                  <h2 style="
                      text-align: center;
                      color: #d72d6e;
                      font-size: 22px;
                      margin-bottom: 20px;
                  ">
                      🎉 Your Booking is Confirmed!
                  </h2>

                  <div style="
                      background: #ffe8f1;
                      border-left: 5px solid #d72d6e;
                      padding: 15px 18px;
                      border-radius: 8px;
                      margin-bottom: 20px;
                  ">
                      <p style="margin: 8px 0;"><strong>🆔 Booking ID:</strong> ${booking.bookingId || booking._id}</p>
                      <p style="margin: 8px 0;"><strong>🏨 Room:</strong> ${room.title || room.name}</p>
                      <p style="margin: 8px 0;"><strong>📅 Check-in:</strong> ${formatDate(checkIn)}</p>
                      <p style="margin: 8px 0;"><strong>📅 Check-out:</strong> ${formatDate(checkOut)}</p>
                      <p style="margin: 8px 0;"><strong>💰 Total Cost:</strong> 
                          <span style="color:#d72d6e; font-weight:600;">₹${totalCost}</span>
                      </p>
                      <p style="margin: 8px 0;"><strong>🔖 Transaction ID:</strong> ${transactionId}</p>
                  </div>

                  <p style="font-size: 15px; color:#555; text-align:center;">
                      Thank you for choosing <strong>ShelterSeek</strong> for your stay! 💖  
                      <br>We wish you a wonderful and memorable experience 😊
                  </p>

                  <div style="text-align:center; margin-top: 18px;">
                      <a href="http://localhost:3000/BookedHistory" style="
                          padding: 10px 18px;
                          background: #d72d6e;
                          color: white;
                          text-decoration: none;
                          border-radius: 8px;
                          font-size: 15px;
                          font-weight: 600;
                      ">🔍 View Booking Details</a>
                  </div>

                  <p style="text-align:center; margin-top:25px; color:#888; font-size:13px;">
                      Need help? Contact us anytime at  
                      <a style="color:#d72d6e;" href="mailto:shelterseekrooms@gmail.com">shelterseekrooms@gmail.com</a> 📩
                  </p>
            </div>
            `

        });
      }
    } catch (emailErr) {
      console.error('Failed to send confirmation email:', emailErr);
      // Don't fail the whole request if email fails
    }

    res.json({ 
      success: true, 
      message: 'Booking confirmed successfully!', 
      bookingId: booking.bookingId || booking._id,
      transactionId: transactionId,
      booking: {
        id: booking._id,
        bookingId: booking.bookingId || booking._id,
        roomTitle: booking.roomTitle,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        totalCost: booking.totalCost
      }
    });

  } catch (error) {
    console.error('Booking error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to complete booking',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Helper functions - add these near the top of your app.js file
function generateDateRange(startDate, endDate) {
  const dates = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const current = new Date(start);
  
  while (current <= end) {
    dates.push(new Date(current).toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

// Get traveler's booking history
app.get('/api/bookings/history', authenticateToken, async (req, res) => {
  try {
    if (req.user.accountType !== 'traveller') {
      return res.status(403).json({ success: false, message: 'Only travelers can access booking history' });
    }

    // Fetch from bookings collection
    const bookings = await Booking.find({ travelerId: req.user._id })
      .sort({ bookedAt: -1 })
      .lean();

    res.json({
      success: true,
      count: bookings.length,
      bookings: bookings
    });
  } catch (error) {
    console.error('Error fetching booking history:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch booking history' });
  }
});

// Get host's bookings
app.get('/api/bookings/host', authenticateToken, async (req, res) => {
  try {
    if (req.user.accountType !== 'host') {
      return res.status(403).json({ success: false, message: 'Only hosts can access host bookings' });
    }

    const bookings = await Booking.find({ hostEmail: req.user.email })
      .sort({ bookedAt: -1 })
      .lean();

    res.json({
      success: true,
      count: bookings.length,
      bookings: bookings
    });
  } catch (error) {
    console.error('Error fetching host bookings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch host bookings' });
  }
});

app.post('/api/traveler/clear-history', authenticateToken, async (req, res) => {
  if (req.user.accountType !== 'traveller') {
    return res.status(403).json({ success: false, message: 'Traveler only' });
  }
  
  try {
    const traveler = await Traveler.findById(req.user._id);
    if (!traveler) {
      return res.status(404).json({ success: false, message: 'Traveler not found' });
    }
    
    traveler.viewedRooms = [];
    await traveler.save();
    
    res.json({ success: true, message: 'History cleared successfully' });
  } catch (error) {
    console.error('Error clearing history:', error);
    res.status(500).json({ success: false, message: 'Failed to clear history' });
  }
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

//j

app.get('/api/new-customers', async (req, res) => {
  try {
    const customers = await LoginData.find({ accountType: 'traveller' }).lean();
    res.json({ data: customers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/recent-activities', async (req, res) => {
  try {
    // Fetch last 10 updated or recently paid bookings
    const activities = await Booking.find()
      .sort({ updatedAt: -1, paymentDate: -1 })
      .limit(10)
      .lean();

    const formattedActivities = activities.map(a => ({
      name: a.userName,
      action: `booked room ${a.roomId}`,
      email: a.userEmail,
      updatedAt: a.updatedAt || a.paymentDate,
    }));

    res.json({ data: formattedActivities });
  } catch (err) {
    console.error('Error fetching recent activities:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/revenue', async (req, res) => {
  try {
    const bookings = await Booking.find({
      paymentStatus: 'completed',
      bookingStatus: { $in: ['confirmed', 'checked_in', 'completed'] }
    }).lean();

    console.log(`Found ${bookings.length} completed bookings for revenue calculation`);

    // Debug: Log first booking to check structure
    if (bookings.length > 0) {
      console.log('Sample booking structure:', {
        id: bookings[0]._id,
        totalCost: bookings[0].totalCost,
        amount: bookings[0].amount,
        checkIn: bookings[0].checkIn,
        paymentStatus: bookings[0].paymentStatus
      });
    }

    // ✅ Use totalCost instead of amount (based on your booking schema)
    const validBookings = bookings.filter(b => {
      const cost = b.totalCost || b.amount;
      return !isNaN(Number(cost)) && Number(cost) > 0;
    });

    console.log(`Valid bookings for revenue: ${validBookings.length}`);

    const totalRevenue = validBookings.reduce((sum, b) => {
      const cost = b.totalCost || b.amount || 0;
      return sum + Number(cost);
    }, 0);

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    // Get the start of current month
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    
    // Get the start of current week (Monday)
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
    startOfWeek.setHours(0, 0, 0, 0);

    const thisMonthRevenue = validBookings
      .filter(b => {
        const checkIn = new Date(b.checkIn);
        return checkIn >= startOfMonth && checkIn <= now;
      })
      .reduce((sum, b) => {
        const cost = b.totalCost || b.amount || 0;
        return sum + Number(cost);
      }, 0);

    const thisWeekRevenue = validBookings
      .filter(b => {
        const checkIn = new Date(b.checkIn);
        return checkIn >= startOfWeek && checkIn <= now;
      })
      .reduce((sum, b) => {
        const cost = b.totalCost || b.amount || 0;
        return sum + Number(cost);
      }, 0);

    // Calculate daily revenue for last 7 days
    const dailyRevenue = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayRevenue = validBookings
        .filter(b => {
          const checkIn = new Date(b.checkIn);
          checkIn.setHours(0, 0, 0, 0);
          return checkIn.getTime() === date.getTime();
        })
        .reduce((sum, b) => {
          const cost = b.totalCost || b.amount || 0;
          return sum + Number(cost);
        }, 0);
      
      dailyRevenue[dateStr] = dayRevenue;
    }

    // Calculate monthly revenue for last 6 months
    const monthlyRevenue = {};
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(currentYear, currentMonth - i, 1);
      const monthKey = monthDate.toLocaleString('default', { month: 'short', year: '2-digit' });
      
      const monthStart = new Date(currentYear, currentMonth - i, 1);
      const monthEnd = new Date(currentYear, currentMonth - i + 1, 0);
      
      const monthRev = validBookings
        .filter(b => {
          const checkIn = new Date(b.checkIn);
          return checkIn >= monthStart && checkIn <= monthEnd;
        })
        .reduce((sum, b) => {
          const cost = b.totalCost || b.amount || 0;
          return sum + Number(cost);
        }, 0);
      
      monthlyRevenue[monthKey] = monthRev;
    }

    res.json({ 
      success: true,
      totalRevenue, 
      thisMonthRevenue, 
      thisWeekRevenue,
      dailyRevenue,
      monthlyRevenue,
      currency: 'INR',
      bookingCount: validBookings.length,
      averageBookingValue: validBookings.length > 0 ? totalRevenue / validBookings.length : 0
    });
  } catch (err) {
    console.error('Error in /api/revenue:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});


app.get('/api/bookings/summary', async (req, res) => {
  try {
    const bookings = await Booking.find().lean();
    const now = new Date();

    let total = 0;
    let thisMonth = 0;
    let thisWeek = 0;

    bookings.forEach((b) => {
      if (!b.checkIn) return; // skip invalid entries
      const checkInDate = new Date(b.checkIn);
      if (isNaN(checkInDate)) return;

      total++;

      // ✅ Compare month & year to avoid cross-year errors
      if (
        checkInDate.getMonth() === now.getMonth() &&
        checkInDate.getFullYear() === now.getFullYear()
      ) {
        thisMonth++;
      }

      // ✅ Compare day difference for current week
      const diffDays = (now - checkInDate) / (1000 * 60 * 60 * 24);
      if (diffDays >= 0 && diffDays <= 7) {
        thisWeek++;
      }
    });

    res.json({ total, thisMonth, thisWeek });
  } catch (err) {
    console.error('Error in /api/bookings/summary:', err);
    res.status(500).json({ error: err.message });
  }
});
//j
app.get('/api/bookings/summarys', async (req, res) => {
  try {
    const bookings = await Booking.find({}).lean();

    const summary = bookings.map((b) => {
      // ✅ totalCost is your actual field
      const cost = Number(b.totalCost ?? 0);

      return {
        // both ids so you can use whichever you want on frontend
        _id: b._id,
        bookingId: b.bookingId || b._id,          // human-readable bookingId
        userName: b.travelerName || 'Unknown',   // guest name
        userEmail: b.travelerEmail || '',        // optional
        roomTitle: b.roomTitle || 'N/A',

        checkIn: b.checkIn || null,
        checkOut: b.checkOut || null,

        // 👇 main one
        totalCost: cost,

        // 👇 extra alias so old frontend using `booking.amount` still works
        amount: cost,
      };
    });

    res.json({
      success: true,
      totalBookings: summary.length,
      bookings: summary,
    });
  } catch (err) {
    console.error('Error in /api/bookings/summary:', err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// GET /api/traveler/:email/bookings - Get all bookings for a specific traveler
app.get('/api/traveler/:email/bookings', async (req, res) => {
  try {
    const { email } = req.params;
    
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // Find bookings for this traveler email
    const bookings = await Booking.find({ travelerEmail: email })
      .sort({ bookedAt: -1 })
      .lean();

    // Get traveler details
    const traveler = await Traveler.findOne({ email }).lean();

    res.json({
      success: true,
      traveler: traveler ? {
        name: traveler.name,
        email: traveler.email,
        accountType: traveler.accountType,
        joinedAt: traveler.createdAt
      } : null,
      bookings: bookings.map(booking => ({
        bookingId: booking.bookingId || booking._id.toString(),
        transactionId: booking.paymentDetails?.transactionId || 'N/A',
        roomTitle: booking.roomTitle || 'Untitled Room',
        roomId: booking.roomId,
        hostEmail: booking.hostEmail,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        days: booking.days || 1,
        totalCost: booking.totalCost || 0,
        guests: booking.guests || 1,
        bookingStatus: booking.bookingStatus || 'pending',
        paymentStatus: booking.paymentStatus || 'pending',
        paymentMethod: booking.paymentDetails?.paymentMethod || 'N/A',
        specialRequests: booking.specialRequests || '',
        bookedAt: booking.bookedAt,
        guestDetails: booking.guestDetails || []
      })),
      count: bookings.length,
      totalSpent: bookings.reduce((sum, b) => sum + (b.totalCost || 0), 0)
    });

  } catch (error) {
    console.error('Error fetching traveler bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch traveler bookings'
    });
  }
});

// GET /api/rooms/count - Get total rooms and available rooms count
app.get('/api/rooms/count', async (req, res) => {
  try {
    // Get total rooms count (verified/approved rooms)
    const totalRooms = await RoomData.countDocuments({
      $or: [{ status: /verified/i }, { status: /approved/i }]
    });

    // Get available rooms (not booked)
    const availableRooms = await RoomData.countDocuments({
      $or: [{ status: /verified/i }, { status: /approved/i }],
      booking: { $ne: true }
    });

    // Get booked rooms count
    const bookedRooms = totalRooms - availableRooms;

    // Get this month's booked rooms
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
    startOfWeek.setHours(0, 0, 0, 0);

    const thisMonthBooked = await RoomData.countDocuments({
      booking: true,
      updatedAt: { $gte: startOfMonth }
    });

    const thisWeekBooked = await RoomData.countDocuments({
      booking: true,
      updatedAt: { $gte: startOfWeek }
    });

    // Get rooms by status
    const roomsByStatus = await RoomData.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    // Get popular room types
    const popularRoomTypes = await RoomData.aggregate([
      {
        $match: {
          $or: [{ status: /verified/i }, { status: /approved/i }]
        }
      },
      {
        $group: {
          _id: "$roomType",
          count: { $sum: 1 },
          avgPrice: { $avg: "$price" }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    res.json({
      success: true,
      counts: {
        total: totalRooms,
        available: availableRooms,
        booked: bookedRooms,
        thisMonthBooked,
        thisWeekBooked
      },
      byStatus: roomsByStatus,
      popularTypes: popularRoomTypes,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching room counts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch room counts',
      error: error.message
    });
  }
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

//j

app.get('/api/users', async (req, res) => {
  try {
    const { accountType } = req.query; // 'host' or 'traveller'

    let filter = {};
    if (accountType) {
      filter.accountType = accountType; // filter by type
    }

    const users = await LoginData.find(filter).lean(); // or whatever your model name is
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


app.get('/api/hosts', async (req, res) => {
  try {
    const hosts = await Host.find({}).lean();
    const roomCounts = await RoomData.aggregate([
      { $group: { _id: "$email", count: { $sum: 1 } } }
    ]);

    const countsMap = {};
    roomCounts.forEach(rc => {
      countsMap[rc._id] = rc.count;
    });

    hosts.forEach(h => {
      h.roomCount = countsMap[h.email] || 0;
    });

    res.json(hosts); // ✅ send JSON for React
  } catch (error) {
    console.error('Error fetching hosts:', error);
    res.status(500).json({ hosts: [], error: error.message });
  }
});

app.get('/api/hosts/:hostId/rooms', async (req, res) => {
  try {
    const hostId = req.params.hostId;
    const host = await Host.findById(hostId);
    if (!host) return res.status(404).json([]);

    const rooms = await RoomData.find({ email: host.email });
    res.json(rooms);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

app.get('/api/rooms/host/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const rooms = await RoomData.find({ email }).lean();
    console.log(`Rooms found for ${email}:`, rooms.length);
    res.json({ roomCount: rooms.length, rooms });
  } catch (error) {
    console.error('Error fetching host rooms:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ==================== TRENDS ENDPOINTS ====================
// ===================== TRENDING ROOMS (views + likes) =====================
// ==================== ENHANCED TRENDS ENDPOINT ====================

app.get('/api/trends', async (req, res) => {
  try {
    console.log('=== TRENDS ENDPOINT CALLED ===');
    
    // Fetch all travelers with room interactions
    const travelers = await Traveler.find({}).lean();
    console.log(`Total travelers: ${travelers.length}`);
    
    // Initialize room statistics
    const roomStats = {};
    const roomDetails = {}; // To store room details
    
    // Process each traveler
    let travelersWithData = 0;
    
    travelers.forEach((traveler) => {
      let hasData = false;
      
      // Process viewed rooms
      if (traveler.viewedRooms && Array.isArray(traveler.viewedRooms)) {
        traveler.viewedRooms.forEach(view => {
          let roomId;
          
          // Extract room ID from different data structures
          if (typeof view === 'string') {
            roomId = view;
          } else if (view && typeof view === 'object') {
            // Try different possible field names
            roomId = view.roomId || view._id || view.id;
          }
          
          if (!roomId || typeof roomId !== 'string') {
            return;
          }
          
          hasData = true;
          
          if (!roomStats[roomId]) {
            roomStats[roomId] = {
              roomId: roomId,
              totalViews: 0,
              totalLikes: 0,
              uniqueViewers: new Set(),
              uniqueLikers: new Set()
            };
          }
          
          roomStats[roomId].totalViews++;
          if (traveler._id) {
            roomStats[roomId].uniqueViewers.add(traveler._id.toString());
          }
        });
      }
      
      // Process liked rooms
      if (traveler.likedRooms && Array.isArray(traveler.likedRooms)) {
        traveler.likedRooms.forEach(roomId => {
          if (!roomId || typeof roomId !== 'string') {
            return;
          }
          
          hasData = true;
          
          if (!roomStats[roomId]) {
            roomStats[roomId] = {
              roomId: roomId,
              totalViews: 0,
              totalLikes: 0,
              uniqueViewers: new Set(),
              uniqueLikers: new Set()
            };
          }
          
          roomStats[roomId].totalLikes++;
          if (traveler._id) {
            roomStats[roomId].uniqueLikers.add(traveler._id.toString());
          }
        });
      }
      
      if (hasData) travelersWithData++;
    });
    
    console.log(`Travelers with room data: ${travelersWithData}`);
    console.log(`Unique rooms found: ${Object.keys(roomStats).length}`);
    
    // Convert to array
    const trends = Object.values(roomStats).map(stat => ({
      roomId: stat.roomId,
      totalViews: stat.totalViews,
      totalLikes: stat.totalLikes,
      uniqueViewers: stat.uniqueViewers.size,
      uniqueLikers: stat.uniqueLikers.size,
      engagementRate: stat.totalViews > 0 ? 
        Math.round((stat.totalLikes / stat.totalViews) * 100) : 0
    }));
    
    // Sort by total views (descending)
    trends.sort((a, b) => b.totalViews - a.totalViews);
    
    // Fetch room details for the top rooms
    const topRoomIds = trends.slice(0, 50).map(t => t.roomId);
    
    try {
      const rooms = await RoomData.find({
        _id: { $in: topRoomIds.map(id => {
          try {
            return new mongoose.Types.ObjectId(id);
          } catch {
            return null;
          }
        }).filter(id => id !== null) }
      }).select('title name email location price').lean();
      
      // Map room details by ID
      const roomDetailsMap = {};
      rooms.forEach(room => {
        roomDetailsMap[room._id.toString()] = {
          title: room.title || 'Untitled Room',
          host: room.name || 'Unknown Host',
          location: room.location || 'Unknown Location',
          price: room.price || 0
        };
      });
      
      // Add room details to trends
      const trendsWithDetails = trends.map(trend => ({
        ...trend,
        roomName: roomDetailsMap[trend.roomId]?.title || `Room ${trend.roomId.substring(0, 8)}...`,
        host: roomDetailsMap[trend.roomId]?.host || 'Unknown',
        location: roomDetailsMap[trend.roomId]?.location || 'Unknown',
        price: roomDetailsMap[trend.roomId]?.price || 0
      }));
      
      // Calculate summary
      const summary = {
        totalRooms: trends.length,
        totalViews: trends.reduce((sum, t) => sum + t.totalViews, 0),
        totalLikes: trends.reduce((sum, t) => sum + t.totalLikes, 0),
        totalUniqueViewers: new Set(trends.flatMap(t => t.uniqueViewers)).size,
        totalUniqueLikers: new Set(trends.flatMap(t => t.uniqueLikers)).size,
        avgEngagementRate: trends.length > 0 ? 
          Math.round(trends.reduce((sum, t) => sum + t.engagementRate, 0) / trends.length) : 0
      };
      
      res.json({
        success: true,
        trends: trendsWithDetails,
        summary: summary,
        count: trends.length
      });
      
    } catch (roomError) {
      console.error('Error fetching room details:', roomError);
      
      // Return trends without room details if room fetch fails
      const summary = {
        totalRooms: trends.length,
        totalViews: trends.reduce((sum, t) => sum + t.totalViews, 0),
        totalLikes: trends.reduce((sum, t) => sum + t.totalLikes, 0)
      };
      
      res.json({
        success: true,
        trends: trends,
        summary: summary,
        count: trends.length,
        note: 'Room details not available'
      });
    }
    
  } catch (error) {
    console.error('Error in /api/trends:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trends data',
      error: error.message
    });
  }
});


app.delete('/api/users/:id', adminController.deleteUser);
//j


// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Email: ${process.env.EMAIL_USER || process.env.EMAIL || 'Not set'}`);
  console.log(`Rooms: http://localhost:${PORT}/api/rooms`);
  console.log(`Health: http://localhost:${PORT}/health`);
});