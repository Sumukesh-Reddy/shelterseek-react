require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const { GridFSBucket } = require('mongodb');
const rateLimit = require('express-rate-limit');
const passport = require('passport');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cors = require('cors');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const mkdirp = require('mkdirp');
const qrcode = require('qrcode');
const hostController = require('./controllers/hostController');
const adminController = require('./controllers/adminController');

const { Traveler, Host } = require('./model/usermodel');
const RoomData = require('./model/Room');
// At the top of app.js with other requires
const { MongoClient } = require('mongodb');
const { GoogleGenAI } = require('@google/genai');


const app = express();
const PORT = process.env.PORT || 3001;

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

const uploadsDir = path.join(__dirname, 'public/uploads');
mkdirp.sync(uploadsDir);
const upload = multer({
  dest: uploadsDir,
  storage: multer.diskStorage({
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
  }),
});

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/loginDataBase';
const HOST_ADMIN_URI = process.env.HOST_ADMIN_URI || 'mongodb://localhost:27017/Host_Admin';
const ADMIN_TRAVELER_URI = process.env.ADMIN_TRAVELER_URI || 'mongodb://localhost:27017/Admin_Traveler';
const PAYMENT_DB_URI = process.env.PAYMENT_DB_URI || 'mongodb://localhost:27017/payment';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Main MongoDB connected'))
  .catch(err => console.error('Main DB connection error:', err));

const loginDataSchema = new mongoose.Schema({
  name: String,
  email: String,
  accountType: String,
  createdAt: { type: Date, default: Date.now },
});
const LoginData = mongoose.model('LoginData', loginDataSchema, 'LoginData');

global.hostAdminConnection = mongoose.createConnection(HOST_ADMIN_URI, {
  retryWrites: true,
  w: 'majority'
});

const paymentConnection = mongoose.createConnection(PAYMENT_DB_URI, {
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

const Booking = paymentConnection.model('Booking', require('./model/Booking').schema);

global.hostAdminConnection.on('connected', () => {
  console.log('Connected to Host_Admin database');
  
  if (!global.gfsBucket) {
    global.gfsBucket = new GridFSBucket(global.hostAdminConnection.db, { bucketName: 'images' });
    console.log('GridFS bucket initialized');
  }

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

const hostAdminConnection = mongoose.createConnection(HOST_ADMIN_URI, { useNewUrlParser: true, useUnifiedTopology: true });
const travelerConnection = mongoose.createConnection(ADMIN_TRAVELER_URI, { useNewUrlParser: true, useUnifiedTopology: true });

hostAdminConnection.once('open', () => console.log('Connected to Host_Admin'));
travelerConnection.once('open', () => console.log('Connected to Admin_Traveler'));
paymentConnection.once('open', () => console.log('Connected to payment'));

let gfsBucket;
hostAdminConnection.once('open', () => {
  gfsBucket = new GridFSBucket(hostAdminConnection.db, { bucketName: 'images' });
  console.log('GridFS Bucket initialized');
});

app.use(cors({ 
  origin: process.env.FRONTEND_URL || 'http://localhost:3000', 
  credentials: true 
}));

app.use(session({
  secret: process.env.SESSION_SECRET || 'secret123',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: MONGODB_URI,
    collectionName: 'sessions'
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24,
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true
  }
}));

app.use(passport.initialize());
app.use(passport.session());
require('./config/passport')(passport);

const authRoutes = require('./routes/authRoutes');
const hostRoutes = require('./routes/hostRoutes');
app.use('/auth', authRoutes);
app.use('/api', hostRoutes);

const otpStore = {};
const verifiedEmails = new Set();

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

app.post('/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email required' });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[email] = { otp, expires: Date.now() + 10 * 60 * 1000 };

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

app.get('/profile', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ success: false, message: 'Not authenticated' });
  res.json({
    success: true,
    user: { id: req.user._id, name: req.user.name, email: req.user.email, accountType: req.user.accountType }
  });
});

app.post('/logout', (req, res) => {
  req.logout(() => {});
  req.session.destroy();
  res.json({ success: true, message: 'Logged out' });
});

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

app.get('/api/rooms', async (req, res) => {
  try {
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
      }
    }

    let query = {
      $or: [{ status: /verified/i }, { status: /approved/i }]
    };

    if (!userId) {
      query.booking = { $ne: true };
    } else {
      query = {
        $and: [
          { $or: [{ status: /verified/i }, { status: /approved/i }] },
          {
            $or: [
              { booking: { $ne: true } },
              { bookedBy: userId }
            ]
          }
        ]
      };
      
      const user = await Traveler.findById(userId) || await Host.findById(userId);
      if (user && user.accountType === 'host') {
        query = {
          $or: [
            { email: user.email },
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

    const room = await RoomData.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    if (guests > room.capacity) {
      return res.status(400).json({ 
        success: false, 
        message: `Maximum capacity is ${room.capacity} guests` 
      });
    }

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

    const transactionId = paymentDetails.transactionId || 
      `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;

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

    await RoomData.findByIdAndUpdate(roomId, {
      booking: true,
      bookedBy: req.user._id,
      $addToSet: { unavailableDates: { $each: generateDateRange(checkIn, checkOut) } }
    });

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
      }
    }

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
      }
    }

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

app.get('/api/bookings/history', authenticateToken, async (req, res) => {
  try {
    if (req.user.accountType !== 'traveller') {
      return res.status(403).json({ success: false, message: 'Only travelers can access booking history' });
    }

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

app.get('/api/host/analytics', authenticateToken, async (req, res) => {
  try {
    if (req.user.accountType !== 'host') {
      return res.status(403).json({ success: false, message: 'Only hosts can access host analytics' });
    }

    const hostEmail = req.user.email;

    const bookings = await Booking.find({
      hostEmail: hostEmail,
      paymentStatus: 'completed',
      bookingStatus: { $in: ['confirmed', 'completed', 'checked_out'] }
    }).sort({ bookedAt: -1 }).lean();

    const currentDate = new Date();
    const monthlyData = [];

    for (let i = 0; i < 12; i++) {
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() - i + 1, 0, 23, 59, 59);

      const monthBookings = bookings.filter(booking => {
        const bookingDate = new Date(booking.bookedAt);
        return bookingDate >= monthStart && bookingDate <= monthEnd;
      });

      const monthEarnings = monthBookings.reduce((sum, booking) => sum + booking.totalCost, 0);

      monthlyData.unshift({
        month: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        bookings: monthBookings.length,
        earnings: monthEarnings
      });
    }

    const totalBookings = bookings.length;
    const totalEarnings = bookings.reduce((sum, booking) => sum + booking.totalCost, 0);
    const avgEarningsPerBooking = totalBookings > 0 ? totalEarnings / totalBookings : 0;

    res.json({
      success: true,
      analytics: {
        totalBookings,
        totalEarnings,
        avgEarningsPerBooking,
        monthlyData
      }
    });

  } catch (error) {
    console.error('Error fetching host analytics:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch host analytics' });
  }
});

app.get('/api/listings/:listingId/qr', authenticateToken, async (req, res) => {
  try {
    const { listingId } = req.params;
    console.log('QR Code generation requested for listingId:', listingId);
    console.log('User:', req.user.email, 'Account type:', req.user.accountType);

    const listing = await RoomData.findById(listingId);
    console.log('Listing found:', !!listing);
    if (!listing) {
      console.log('Listing not found for ID:', listingId);
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }

    console.log('Listing email:', listing.email, 'User email:', req.user.email);

    if (req.user.accountType === 'host' && listing.email !== req.user.email) {
      console.log('Access denied - listing belongs to different host');
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const listingUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/room/${listingId}`;
    console.log('Generating QR code for URL:', listingUrl);

    const qrCodeDataURL = await qrcode.toDataURL(listingUrl);
    console.log('QR code generated successfully');

    res.json({
      success: true,
      qrCode: qrCodeDataURL,
      listingUrl,
      listingTitle: listing.title
    });

  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).json({ success: false, message: 'Failed to generate QR code' });
  }
});

app.put('/api/rooms/:roomId/book', authenticateToken, async (req, res) => {
  const { booking = true } = req.body;
  const room = await RoomData.findById(req.params.roomId);
  if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

  room.booking = booking;
  await room.save();

  res.json({ success: true, message: `Room ${booking ? 'booked' : 'freed'}`, room: { _id: room._id, booking: room.booking } });
});

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

    if (bookings.length > 0) {
      console.log('Sample booking structure:', {
        id: bookings[0]._id,
        totalCost: bookings[0].totalCost,
        amount: bookings[0].amount,
        checkIn: bookings[0].checkIn,
        paymentStatus: bookings[0].paymentStatus
      });
    }

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
    
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1);
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
      if (!b.checkIn) return;
      const checkInDate = new Date(b.checkIn);
      if (isNaN(checkInDate)) return;

      total++;

      if (
        checkInDate.getMonth() === now.getMonth() &&
        checkInDate.getFullYear() === now.getFullYear()
      ) {
        thisMonth++;
      }

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

app.get('/api/bookings/summarys', async (req, res) => {
  try {
    const bookings = await Booking.find({}).lean();

    const summary = bookings.map((b) => {
      const cost = Number(b.totalCost ?? 0);

      return {
        _id: b._id,
        bookingId: b.bookingId || b._id,
        userName: b.travelerName || 'Unknown',
        userEmail: b.travelerEmail || '',
        roomTitle: b.roomTitle || 'N/A',
        checkIn: b.checkIn || null,
        checkOut: b.checkOut || null,
        totalCost: cost,
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

app.get('/api/traveler/:email/bookings', async (req, res) => {
  try {
    const { email } = req.params;
    
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const bookings = await Booking.find({ travelerEmail: email })
      .sort({ bookedAt: -1 })
      .lean();

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

app.get('/api/rooms/count', async (req, res) => {
  try {
    const totalRooms = await RoomData.countDocuments({
      $or: [{ status: /verified/i }, { status: /approved/i }]
    });

    const availableRooms = await RoomData.countDocuments({
      $or: [{ status: /verified/i }, { status: /approved/i }],
      booking: { $ne: true }
    });

    const bookedRooms = totalRooms - availableRooms;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1);
    startOfWeek.setHours(0, 0, 0, 0);

    const thisMonthBooked = await RoomData.countDocuments({
      booking: true,
      updatedAt: { $gte: startOfMonth }
    });

    const thisWeekBooked = await RoomData.countDocuments({
      booking: true,
      updatedAt: { $gte: startOfWeek }
    });

    const roomsByStatus = await RoomData.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

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

app.get('/api/users', async (req, res) => {
  try {
    const { accountType } = req.query;

    let filter = {};
    if (accountType) {
      filter.accountType = accountType;
    }

    const users = await LoginData.find(filter).lean();
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

    res.json(hosts);
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

app.get('/api/trends', async (req, res) => {
  try {
    console.log('=== TRENDS ENDPOINT CALLED ===');
    
    const travelers = await Traveler.find({}).lean();
    console.log(`Total travelers: ${travelers.length}`);
    
    const roomStats = {};
    const roomDetails = {};
    
    let travelersWithData = 0;
    
    travelers.forEach((traveler) => {
      let hasData = false;
      
      if (traveler.viewedRooms && Array.isArray(traveler.viewedRooms)) {
        traveler.viewedRooms.forEach(view => {
          let roomId;
          
          if (typeof view === 'string') {
            roomId = view;
          } else if (view && typeof view === 'object') {
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
    
    const trends = Object.values(roomStats).map(stat => ({
      roomId: stat.roomId,
      totalViews: stat.totalViews,
      totalLikes: stat.totalLikes,
      uniqueViewers: stat.uniqueViewers.size,
      uniqueLikers: stat.uniqueLikers.size,
      engagementRate: stat.totalViews > 0 ? 
        Math.round((stat.totalLikes / stat.totalViews) * 100) : 0
    }));
    
    trends.sort((a, b) => b.totalViews - a.totalViews);
    
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
      
      const roomDetailsMap = {};
      rooms.forEach(room => {
        roomDetailsMap[room._id.toString()] = {
          title: room.title || 'Untitled Room',
          host: room.name || 'Unknown Host',
          location: room.location || 'Unknown Location',
          price: room.price || 0
        };
      });
      
      const trendsWithDetails = trends.map(trend => ({
        ...trend,
        roomName: roomDetailsMap[trend.roomId]?.title || `Room ${trend.roomId.substring(0, 8)}...`,
        host: roomDetailsMap[trend.roomId]?.host || 'Unknown',
        location: roomDetailsMap[trend.roomId]?.location || 'Unknown',
        price: roomDetailsMap[trend.roomId]?.price || 0
      }));
      
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

// AI Chat bot functions
// ---- Google Gemini AI + Admin_Traveler (RoomDataTraveler) integration ----

// Initialize Google Gemini AI
if (!process.env.GOOGLE_API_KEY) {
  console.warn('GOOGLE_API_KEY not provided — AI features will be unavailable.');
}

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY || '',
});

// Global chat instance — initialized once and reused for all requests
let geminiChat = null;

function initializeGeminiChat(inventory) {
  const systemPrompt = `You are a specialized hotel booking assistant for a specific hotel chain/knowledge base ONLY.
Your ONLY function is to help users find and book hotels from the provided inventory below.
You MUST ONLY recommend hotels that exist in the inventory provided.
You MUST NOT provide general chatbot responses, general travel advice, or information outside the provided inventory.
You MUST NOT make up or suggest hotels that are NOT in the inventory.

REQUIRED INVENTORY - These are the ONLY hotels you can recommend:
${inventory.length ? JSON.stringify(inventory, null, 2) : 'NO INVENTORY PROVIDED'}

STRICT RESPONSE RULES:
1. If the user's query matches hotels in the inventory, return ONLY those matching hotels.
2. If the user's query does NOT match any hotels in the inventory, respond with an empty hotels array and explain that no matching hotels are available in your system.
3. NEVER suggest hotels outside the provided inventory.
4. NEVER provide general travel advice or act like a general chatbot.
5. Always respond with a valid JSON object containing EXACTLY these fields:
   - reply: A brief explanation of results or why no matches were found
   - hotels: An array of ONLY the matching hotel objects from the inventory with fields

If inventory is empty or no matches exist, return empty hotels array with explanation in reply.
Do NOT include any other fields or keys in your JSON response.`;

  geminiChat = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: systemPrompt,
    },
    history: [],
  });

  console.log('[DEBUG] Gemini chat instance initialized with inventory of', inventory.length, 'items');
}

// ---- Native MongoClient for Admin_Traveler.RoomDataTraveler (for AI inventory) ----
const mongo = new MongoClient(ADMIN_TRAVELER_URI, {}); // use your existing ADMIN_TRAVELER_URI
let roomsCollection = null; // points to RoomDataTraveler

async function connectMongoForGemini() {
  if (!ADMIN_TRAVELER_URI) {
    console.warn('ADMIN_TRAVELER_URI not provided — Gemini DB features disabled.');
    return;
  }

  await mongo.connect();
  const db = mongo.db('Admin_Traveler');
  roomsCollection = db.collection('RoomDataTraveler');
  console.log('Connected to MongoDB (Admin_Traveler) for Gemini inventory');

  // Initialize Gemini chat with inventory
  try {
    const docs = await roomsCollection.find().limit(50).toArray().catch(() => []);
    const inventory = (docs || []).map(d => ({
      id: d._id?.toString?.() || d.id || null,
      name: d.name || d.hotelName || d.roomName || null,
      price: d.price || d.rate || d.pricePerNight || null,
      rating: d.rating || d.reviewScore || null,
      location: d.location || d.city || d.address || null,
      description: d.description || d.details || d.roomDescription || null,
      bedrrooms: d.bedrooms || d.numBeds || null,
      beds: d.beds || d.bedCount || null,
      availability: d.availability || d.isAvailable || null,
      propertyType: d.propertyType || d.type || null,
      roomLocation: d.roomLocation || d.area || null,
      roomSize: d.roomSize || d.sizeSqFt || null,
    }));
    initializeGeminiChat(inventory);
    console.log('[DEBUG] Loaded', inventory.length, 'hotels/rooms into Gemini context');
  } catch (e) {
    console.warn('Failed to initialize Gemini with inventory:', e.message);
    initializeGeminiChat([]);
  }
}

connectMongoForGemini().catch(err => {
  console.warn('Mongo connection for Gemini failed (continuing without AI inventory):', err.message);
});

// ----- /api/ai-chat : Google Gemini API powered chat -----
app.post('/api/ai-chat', async (req, res) => {
  try {
    console.log('[DEBUG] /api/ai-chat endpoint called');
    const { message } = req.body || {};
    console.log('[DEBUG] message:', message);
    const query = (message || '').trim();
    if (!query) return res.json({ reply: 'Please tell me where to search or what you need.' });

    // If Google key available, use Gemini API
    if (process.env.GOOGLE_API_KEY) {
      console.log('[DEBUG] Google key present, attempting Gemini API...');
      try {
        console.log('[DEBUG] Calling getHotelsFromGemini...');
        const result = await getHotelsFromGemini(query);

        const reply = result.reply || `Found hotels matching "${query}".`;
        let hotels = result.hotels || [];

        // If no hotels from Gemini, try to fetch from DB (RoomDataTraveler)
        if ((!hotels || hotels.length === 0) && roomsCollection) {
          try {
            const docs = await roomsCollection
              .find({ $text: { $search: query } })
              .limit(20)
              .toArray()
              .catch(() => []);

            if (docs && docs.length) {
              hotels = docs.map(d => ({
                id: d._id?.toString?.() || d.id || null,
                name: d.name || d.hotelName || d.roomName || null,
                price: d.price || d.rate || d.pricePerNight || null,
                rating: d.rating || d.reviewScore || null,
                location: d.location || d.city || d.address || null,
                description: d.description || d.details || d.roomDescription || null,
              }));
            }
          } catch (e) {
            console.warn('DB text search failed', e.message);
          }
        }

        // If still no hotels, return empty list (mock disabled)
        return res.json({ reply, hotels });
      } catch (err) {
        console.error('Gemini API error', err);

        if (err?.message?.includes('401') || err?.message?.includes('403')) {
          return res.status(403).json({ error: 'Google Gemini auth error. Check GOOGLE_API_KEY/permissions.' });
        }
        if (err?.message?.includes('429')) {
          return res.status(429).json({ error: 'Google quota exceeded.' });
        }

        return res.json({
          reply: 'AI service temporarily unavailable — returning sample hotels.',
          hotels: mockHotelsDisabled(query),
        });
      }
    }

    // Fallback: no GOOGLE_API_KEY
    if (roomsCollection) {
      try {
        const docs = await roomsCollection
          .find({ $text: { $search: query } })
          .limit(10)
          .toArray()
          .catch(() => []);

        if (docs && docs.length) {
          const hotels = docs.map(d => ({
            id: d._id?.toString?.() || d.id || null,
            name: d.name || d.hotelName || d.roomName || null,
            price: d.price || d.rate || d.pricePerNight || null,
            rating: d.rating || d.reviewScore || null,
            location: d.location || d.city || d.address || null,
            description: d.description || d.details || d.roomDescription || null,
          }));
          return res.json({
            reply: `Found ${hotels.length} hotels for "${query}" (database search).`,
            hotels,
          });
        }
      } catch (e) {
        console.warn('DB text search failed', e.message);
      }
    }

    return res.json({
      reply: 'Returning sample hotels.',
      hotels: mockHotelsDisabled(query),
    });
  } catch (err) {
    console.error('AI chat handler error', err);
    return res.status(500).json({ error: err.message || 'server error' });
  }
});


app.delete('/api/users/:id', adminController.deleteUser);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Email: ${process.env.EMAIL_USER || process.env.EMAIL || 'Not set'}`);
  console.log(`Rooms: http://localhost:${PORT}/api/rooms`);
  console.log(`Health: http://localhost:${PORT}/health`);
});