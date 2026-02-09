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
const helmet = require('helmet');
const hostController = require('./controllers/hostController');
const adminController = require('./controllers/adminController');
const http = require('http');
const { Server } = require('socket.io');
const { Traveler, Host } = require('./model/usermodel');
const Message = require('./model/Message');
const Room = require('./model/chatRoom');
const rfs = require("rotating-file-stream");
const morgan = require('morgan');

const RoomData = require('./model/Room');
// At the top of app.js with other requires
const { MongoClient } = require('mongodb');
const { GoogleGenAI } = require('@google/genai');
const { authenticateToken, roleMiddleware } = require('./middleware/authMiddleware');


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


const logDirectory = path.join(__dirname, 'logs');
mkdirp.sync(logDirectory);
const accessLogStream = rfs.createStream('access.log', {
  interval: '1d',
  path: logDirectory,
});

app.use(helmet());

app.use(morgan('combined', { stream: accessLogStream }));

const errorLogStream = rfs.createStream('error.log', {
  interval: '1d',
  path: logDirectory,
  size: '10M',
  compress: 'gzip'
});

// Error logging middleware
const errorLogger = (req, res, next) => {
  // Store the original send function
  const originalSend = res.send;
  
  // Override the send function to catch errors
  res.send = function(body) {
    // Check if response indicates an error
    if (res.statusCode >= 400) {
      const errorLog = {
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        statusMessage: res.statusMessage,
        userId: req.user?._id || 'anonymous',
        userEmail: req.user?.email || '',
        userAccountType: req.user?.accountType || '',
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress,
        body: req.body,
        query: req.query,
        params: req.params,
        error: body.error || body.message || 'Unknown error',
        stack: body.stack || null,
        // Additional role context
        attemptedRoute: req.originalUrl,
        isAuthenticated: !!req.user,
        role: req.user?.accountType || 'unauthenticated'
      };
      
      // Write to error log file
      errorLogStream.write(JSON.stringify(errorLog) + '\n');
      
      // Also log to console in development
      if (process.env.NODE_ENV !== 'production') {
        console.error('API Error:', {
          endpoint: `${req.method} ${req.originalUrl}`,
          status: res.statusCode,
          role: req.user?.accountType || 'unauthenticated',
          error: body.error || body.message
        });
      }
    }
    
    // Call the original send function
    return originalSend.call(this, body);
  };
  
  next();
};

const otpStore = {};
const verifiedEmails = new Set();

app.get('/message', (req, res) => {
  
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

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
    res.status(403).json({ success: false, message: 'invalid token' });
  }
};

app.post('/api/traveler/liked-rooms', authenticateToken, roleMiddleware.travelerOnly, errorLogger, async (req, res) => {
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

app.get('/api/traveler/liked-rooms', authenticateToken, roleMiddleware.travelerOnly, errorLogger, async (req, res) => {
  if (req.user.accountType !== 'traveller') return res.status(403).json({ success: false, message: 'Traveler only' });
  const traveler = await Traveler.findById(req.user._id);
  res.json({ success: true, likedRooms: traveler?.likedRooms || [] });
});

app.post('/api/traveler/viewed-rooms', authenticateToken, roleMiddleware.travelerOnly, errorLogger, async (req, res) => {
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

app.get('/api/traveler/viewed-rooms', authenticateToken, roleMiddleware.travelerOnly, errorLogger, async (req, res) => {
  if (req.user.accountType !== 'traveller') return res.status(403).json({ success: false, message: 'Traveler only' });
  const traveler = await Traveler.findById(req.user._id);
  res.json({ success: true, viewedRooms: traveler?.viewedRooms || [] });
});

app.post('/api/traveler/clear-history', authenticateToken, roleMiddleware.travelerOnly, async (req, res) => {
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

app.get('/api/rooms', errorLogger, async (req, res) => {
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

    // Process rooms and optionally enrich with host info if email is missing
    const processed = await Promise.all(rooms.map(async (room) => {
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

      // Try to get host email - from room data or by looking up Host collection
      let hostEmail = room.email || '';
      let hostGender = room.hostGender || '';
      let hostImage = room.hostImage || null;
      
      // If email is missing but we have room name, try to find host by name
      if (!hostEmail && room.name) {
        try {
          const hostByName = await Host.findOne({ name: room.name }).select('email profilePhoto').lean();
          if (hostByName) {
            hostEmail = hostEmail || hostByName.email || '';
            hostImage = hostImage || hostByName.profilePhoto || null;
          }
        } catch (err) {
          // Silently fail - not critical
        }
      }

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
        updatedAt: room.updatedAt,
        // Include host-related fields for chat functionality
        email: hostEmail,
        hostGender: hostGender,
        hostImage: hostImage,
        yearsWithUs: room.yearsWithUs || 0
      };
    }));

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

app.post('/api/bookings', authenticateToken, roleMiddleware.travelerOnly, errorLogger, async (req, res) => {
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

app.get('/api/bookings/history', authenticateToken, roleMiddleware.travelerOnly, async (req, res) => {
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

app.get('/api/bookings/host', authenticateToken, roleMiddleware.hostOnly, async (req, res) => {
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

app.get('/api/host/analytics', authenticateToken, roleMiddleware.hostOnly, async (req, res) => {
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

app.get('/api/listings/:listingId/qr', authenticateToken, roleMiddleware.hostOnly, async (req, res) => {
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

app.put('/api/rooms/:roomId/book', authenticateToken, roleMiddleware.travelerOnly, async (req, res) => {
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
    // Fetch latest 5 travelers
    const travelers = await Traveler.find({ accountType: 'traveller' })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name email accountType createdAt profilePhoto')
      .lean();

    // Fetch latest 5 hosts
    const hosts = await Host.find({ accountType: 'host' })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name email accountType createdAt profilePhoto')
      .lean();

    // Combine and sort by creation date (newest first)
    const allCustomers = [...travelers, ...hosts]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 4); // Take only top 5 newest overall

    // Format the response
    const formattedCustomers = allCustomers.map(customer => ({
      id: customer._id,
      name: customer.name || 'Unknown User',
      email: customer.email,
      accountType: customer.accountType === 'traveller' ? 'Traveler' : 'Host',
      joinedDate: customer.createdAt ? 
        new Date(customer.createdAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        }) : 'Recently',
      avatar: customer.profilePhoto || 
        (customer.accountType === 'traveller' ? 
          'https://ui-avatars.com/api/?name=' + encodeURIComponent(customer.name || 'User') + '&background=4e73df&color=fff' :
          'https://ui-avatars.com/api/?name=' + encodeURIComponent(customer.name || 'Host') + '&background=1cc88a&color=fff'
        ),
      isNew: customer.createdAt ? 
        (Date.now() - new Date(customer.createdAt).getTime()) < (7 * 24 * 60 * 60 * 1000) : true
    }));

    res.json({ 
      success: true,
      data: formattedCustomers,
      count: formattedCustomers.length,
      summary: {
        travelersCount: travelers.length,
        hostsCount: hosts.length,
        totalNewCustomers: formattedCustomers.length
      }
    });
  } catch (err) {
    console.error('Error fetching new customers:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

app.get('/api/recent-activities', async (req, res) => {
  try {
    const limit = parseInt(7 || req.query.limit);
    const allActivities = [];

    // 1. Get recent bookings
    const bookings = await Booking.find({
      bookingStatus: { $in: ['confirmed', 'checked_in', 'completed'] }
    })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();

    for (const booking of bookings) {
      let roomTitle = 'Room';
      
      try {
        const room = await RoomData.findById(booking.roomId).select('title').lean();
        if (room?.title) roomTitle = room.title;
      } catch (err) {
        console.log(`Could not fetch room ${booking.roomId}:`, err.message);
      }
      
      const bookingId = booking.bookingId || booking._id.toString().substring(0, 8);
      const date = booking.updatedAt || booking.paymentDate || booking.createdAt;
      
      allActivities.push({
        type: 'booking',
        id: booking._id,
        name: booking.travelerName || 'Guest',
        action: `Room Booked "${roomTitle}" with ${bookingId}`,
        email: booking.userEmail,
        date: date,
        dateFormatted: date ? new Date(date).toLocaleDateString() : 'N/A',
        timeFormatted: date ? new Date(date).toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        }) : 'N/A',
        timestamp: date ? new Date(date).getTime() : Date.now()
      });
    }

    // 2. Get recent room uploads (last 7 days)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const roomUploads = await RoomData.find({
      createdAt: { $gte: weekAgo }
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    for (const room of roomUploads) {
      allActivities.push({
        type: 'room_upload',
        id: room._id,
        name: room.name || 'Host',
        action: `uploaded a new room named "${room.title || 'New Room'}"`,
        email: room.email,
        details: {
          roomName: room.title,
          location: room.location,
          price: room.price
        },
        date: room.createdAt,
        dateFormatted: room.createdAt ? new Date(room.createdAt).toLocaleDateString() : 'N/A',
        timeFormatted: room.createdAt ? new Date(room.createdAt).toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        }) : 'N/A',
        timestamp: room.createdAt ? new Date(room.createdAt).getTime() : Date.now()
      });
    }

    // Sort by timestamp and take top limit
    const sortedActivities = allActivities
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);

    res.json({ 
      success: true,
      data: sortedActivities,
      count: sortedActivities.length,
      types: {
        bookings: allActivities.filter(a => a.type === 'booking').length,
        roomUploads: allActivities.filter(a => a.type === 'room_upload').length
      }
    });
  } catch (err) {
    console.error('Error fetching recent activities:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

app.get('/api/revenue', async (req, res) => {
  try {
    const bookings = await Booking.find({
      paymentStatus: 'completed',
      bookingStatus: { $in: ['confirmed', 'checked_in', 'completed'] }
    })
    .sort({ paymentDate: -1 })
    .lean();

    console.log(`Found ${bookings.length} completed bookings for revenue calculation`);

    // Use paymentDate as primary date for revenue calculation
    const validBookings = bookings.filter(b => {
      const cost = b.totalCost || b.amount;
      const paymentDate = b.paymentDate || b.createdAt || b.checkIn;
      return !isNaN(Number(cost)) && Number(cost) > 0 && paymentDate;
    });

    console.log(`Valid bookings for revenue: ${validBookings.length}`);

    // Helper function to get date from booking
    const getBookingDate = (booking) => {
      return new Date(booking.paymentDate || booking.createdAt || booking.checkIn);
    };

    // Calculate total revenue
    const totalRevenue = validBookings.reduce((sum, b) => {
      const cost = b.totalCost || b.amount || 0;
      return sum + Number(cost);
    }, 0);

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    // Get start of current month
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    
    // Get start of current week (Monday)
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
    startOfWeek.setHours(0, 0, 0, 0);

    // Get start of today
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    // Calculate revenues
    const thisMonthRevenue = validBookings
      .filter(b => {
        const bookingDate = getBookingDate(b);
        return bookingDate >= startOfMonth && bookingDate <= now;
      })
      .reduce((sum, b) => {
        const cost = b.totalCost || b.amount || 0;
        return sum + Number(cost);
      }, 0);

    const thisWeekRevenue = validBookings
      .filter(b => {
        const bookingDate = getBookingDate(b);
        return bookingDate >= startOfWeek && bookingDate <= now;
      })
      .reduce((sum, b) => {
        const cost = b.totalCost || b.amount || 0;
        return sum + Number(cost);
      }, 0);

    const todayRevenue = validBookings
      .filter(b => {
        const bookingDate = getBookingDate(b);
        return bookingDate >= startOfToday && bookingDate <= now;
      })
      .reduce((sum, b) => {
        const cost = b.totalCost || b.amount || 0;
        return sum + Number(cost);
      }, 0);

    // Debug logging
    console.log('Revenue summary:', {
      total: totalRevenue,
      thisMonth: thisMonthRevenue,
      thisWeek: thisWeekRevenue,
      today: todayRevenue,
      bookingsInMonth: validBookings.filter(b => getBookingDate(b) >= startOfMonth).length,
      bookingsInWeek: validBookings.filter(b => getBookingDate(b) >= startOfWeek).length,
      dateRange: {
        monthStart: startOfMonth.toISOString(),
        weekStart: startOfWeek.toISOString(),
        todayStart: startOfToday.toISOString(),
        now: now.toISOString()
      }
    });

    // For debugging, log some sample dates
    if (validBookings.length > 0) {
      console.log('Sample booking dates:');
      validBookings.slice(0, 3).forEach((b, i) => {
        console.log(`Booking ${i + 1}:`, {
          paymentDate: b.paymentDate,
          createdAt: b.createdAt,
          checkIn: b.checkIn,
          amount: b.totalCost || b.amount,
          dateObj: getBookingDate(b).toISOString()
        });
      });
    }

    res.json({ 
      success: true,
      totalRevenue, 
      thisMonthRevenue, 
      thisWeekRevenue,
      todayRevenue,
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
    const bookings = await Booking.find({
      bookingStatus: { $in: ['confirmed', 'checked_in', 'completed'] }
    }).lean();
    
    const now = new Date();
    
    // Get current month boundaries
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    // Start of current month
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    
    // End of current month
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);
    
    // Get start of current week (Monday)
    const startOfWeek = new Date(now);
    const day = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const diffToMonday = day === 0 ? -6 : 1 - day; // If Sunday, go back 6 days
    startOfWeek.setDate(now.getDate() + diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);
    
    // Get end of current week (Sunday)
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    let total = 0;
    let thisMonth = 0;
    let thisWeek = 0;

    bookings.forEach((b) => {
      // Use bookedAt date for monthly/weekly counts (when booking was made)
      // Use checkIn date for total counts
      const bookingDate = b.bookedAt || b.createdAt || b.checkIn;
      
      if (!bookingDate) return;
      
      const bookingDateObj = new Date(bookingDate);
      if (isNaN(bookingDateObj)) return;

      total++;

      // Check if booking was MADE in current month (not when check-in is)
      if (bookingDateObj >= startOfMonth && bookingDateObj <= endOfMonth) {
        thisMonth++;
      }

      // Check if booking was MADE in current week
      if (bookingDateObj >= startOfWeek && bookingDateObj <= endOfWeek) {
        thisWeek++;
      }
    });

    res.json({ 
      success: true,
      total, 
      thisMonth, 
      thisWeek,
      dateRange: {
        weekStart: startOfWeek.toISOString(),
        weekEnd: endOfWeek.toISOString(),
        monthStart: startOfMonth.toISOString(),
        monthEnd: endOfMonth.toISOString(),
        currentDate: now.toISOString()
      }
    });
  } catch (err) {
    console.error('Error in /api/bookings/summary:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

app.get('/api/bookings/summarys', async (req, res) => {
  try {
    const bookings = await Booking.find({}).lean();

    const summary = bookings.map((b) => {
      const cost = Number(b.totalCost ?? 0);

      return {
        _id: b._id,
        transactionId: b.paymentDetails.transactionId || b._id,
        userName: b.travelerName || 'Unknown',
        userEmail: b.travelerEmail || '',
        roomTitle: b.roomTitle || 'N/A',
        checkIn: b.checkIn || null,
        checkOut: b.checkOut || null,
        totalCost: cost,
        amount: cost,
        // Add cardType here
        cardType: b.paymentDetails.cardType || 'Not specified',
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

// GET /api/rooms/count - Get total rooms with accurate booked counts
app.get('/api/rooms/count', async (req, res) => {
  try {
    // 1) TOTAL + AVAILABLE from RoomData (verified/approved rooms only)
    const totalRooms = await RoomData.countDocuments({
      $or: [{ status: /verified/i }, { status: /approved/i }]
    });

    const availableRooms = await RoomData.countDocuments({
      $or: [{ status: /verified/i }, { status: /approved/i }],
      booking: { $ne: true }
    });

    // 2) BOOKED ROOMS FROM BOOKINGS COLLECTION (NOT total - available)
    //    Here we’re counting all confirmed bookings.
    //    Adjust filter if you only want paymentStatus completed, etc.
    const totalBookedRooms = await Booking.countDocuments({
      bookingStatus: /confirmed/i
    });

    // 3) This month & this week booked (also from Booking)
    const now = new Date();

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    // Monday as start of week
    startOfWeek.setDate(now.getDate() - now.getDay() + 1);
    startOfWeek.setHours(0, 0, 0, 0);

    const thisMonthBooked = await Booking.countDocuments({
      bookingStatus: /confirmed/i,
      checkIn: { $gte: startOfMonth }
    });

    const thisWeekBooked = await Booking.countDocuments({
      bookingStatus: /confirmed/i,
      checkIn: { $gte: startOfWeek }
    });

    // 4) Group by status from RoomData (same as before)
    const roomsByStatus = await RoomData.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    // 5) Popular room types (Shared / Full / Any, etc.)
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

    // 6) Final response
    res.json({
      success: true,
      counts: {
        total: totalRooms,
        available: availableRooms,
        booked: totalBookedRooms,      //  NOW FROM BOOKINGS
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

app.get('/api/rooms/host/:email', authenticateToken, roleMiddleware.hostOnly, async (req, res) => {
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
// ======================================================
// ========== SIMPLIFIED AI CHAT INTEGRATION ===========
// ======================================================

// Global inventory
let aiInventory = [];

// -------------------------------
// Fetch Rooms from Existing API
// -------------------------------
async function fetchRoomsFromAPI(query = null) {
  try {
    console.log("[AI] Fetching rooms from /api/rooms endpoint");
    
    // Use your existing rooms endpoint
    const apiUrl = "http://localhost:3001/api/rooms";
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.status === "success" && Array.isArray(data.data)) {
      console.log(`[AI] Fetched ${data.data.length} rooms from API`);
      
      // Transform API data to our format
      const rooms = data.data.map(room => ({
        id: room._id || room.id,
        _id: room._id || room.id,
        name: room.title || room.name || "Untitled Room",
        price: room.price || 0,
        location: room.location || "Location not specified",
        description: room.description || "No description available",
        bedrooms: room.bedrooms || 1,
        beds: room.beds || 1,
        capacity: room.capacity || 2,
        propertyType: room.propertyType || "Accommodation",
        roomType: room.roomType || "Standard",
        amenities: Array.isArray(room.amenities) ? room.amenities : [],
        foodFacility: room.foodFacility || "Not specified",
        discount: room.discount || 0,
        status: room.status || "pending",
        booking: room.booking || false,
        images: Array.isArray(room.images) ? room.images : [],
        coordinates: room.coordinates || null,
        unavailableDates: Array.isArray(room.unavailableDates) ? room.unavailableDates : []
      }));
      
      // Filter by query if provided
      if (query && query.trim()) {
        const searchTerm = query.toLowerCase().trim();
        return rooms.filter(room => {
          const searchableText = [
            room.name,
            room.location,
            room.description,
            room.propertyType,
            room.roomType,
            ...room.amenities
          ].join(' ').toLowerCase();
          
          return searchableText.includes(searchTerm);
        });
      }
      
      return rooms;
    } else {
      console.error("[AI] Invalid API response format:", data);
      return [];
    }
    
  } catch (error) {
    console.error("[AI] Error fetching rooms from API:", error.message);
    return [];
  }
}

// -------------------------------
// Handle Greetings and Small Talk
// -------------------------------
function isGreetingOrSmallTalk(query) {
  const greetings = [
    "hi", "hello", "hey", "good morning", "good afternoon", "good evening",
    "how are you", "what's up", "hi there", "hello there", "morning", "evening"
  ];
  
  const smallTalk = [
    "thanks", "thank you", "ok", "okay", "bye", "goodbye", "see you",
    "help", "what can you do", "who are you", "what are you", "can you help",
    "nice", "good", "great", "awesome", "cool", "perfect", "excellent"
  ];
  
  const lowerQuery = query.toLowerCase().trim();
  
  return greetings.some(greeting => lowerQuery === greeting) ||
         smallTalk.some(talk => lowerQuery.includes(talk));
}

// -------------------------------
// Generate Greeting Response
// -------------------------------
async function generateGreetingResponse(query) {
  const lowerQuery = query.toLowerCase().trim();
  
  // Count rooms from API
  let roomCount = 0;
  try {
    const rooms = await fetchRoomsFromAPI();
    roomCount = rooms.length;
  } catch (error) {
    roomCount = 0;
  }
  
  const responses = {
    "hi": `Hello! 👋 I'm your ShelterSeek booking assistant. I can help you find ${roomCount > 0 ? `${roomCount} accommodations` : 'hotels and accommodations'} across India. What are you looking for today?`,
    "hello": `Hi there! 🏨 I'm here to help you find the perfect place to stay. ${roomCount > 0 ? `I have ${roomCount} properties in my database.` : ''} Where would you like to go?`,
    "hey": "Hey! ✨ Welcome to ShelterSeek. I'm your AI assistant for finding hotels, resorts, and homestays. Tell me what you need!",
    "good morning": "Good morning! ☀️ Ready to find your perfect stay for the day?",
    "good afternoon": "Good afternoon! 🌤️ How can I help you find accommodation today?",
    "good evening": "Good evening! 🌙 Looking for a place to stay tonight?",
    "how are you": "I'm great, thanks! Ready to help you find amazing accommodations. What's on your mind?",
    "what can you do": `I can help you search through ${roomCount} properties! I can find hotels by location, price, type, and amenities. Try asking me something like:
• "Hotels in Goa"
• "Budget stays under 2000"
• "Beach resorts"
• "Family rooms with pool"`,
    "who are you": "I'm ShelterSeek AI, your personal hotel booking assistant! I search through our database to find the perfect accommodations for you.",
    "what are you": "I'm an AI-powered booking assistant for ShelterSeek. I help travelers find and book hotels, resorts, and homestays across India.",
    "help": `I can help you find hotels, resorts, homestays, and more! Just tell me what you're looking for. Examples:\n• "Hotels in Hyderabad"\n• "Budget stays under ₹1500"\n• "Resorts"\n• "Family rooms with pool"\n• "Luxury hotels"\n• "Properties near airport"`,
    "thanks": "You're welcome! 😊 Let me know if you need anything else.",
    "thank you": "My pleasure! Happy to help you find the perfect stay.",
    "bye": "Goodbye! 👋 Have a great day and safe travels!",
    "goodbye": "Take care! Hope to help you again soon. 🏡",
    "see you": "See you later! 😊 Safe travels!"
  };
  
  // Find exact match
  for (const [key, response] of Object.entries(responses)) {
    if (lowerQuery === key) {
      return {
        reply: response,
        showRooms: false,
        isGreeting: true
      };
    }
  }
  
  // Find partial match for longer greetings
  for (const [key, response] of Object.entries(responses)) {
    if (lowerQuery.includes(key) && key.length > 3) {
      return {
        reply: response,
        showRooms: false,
        isGreeting: true
      };
    }
  }
  
  // Default greeting
  return {
    reply: `Hi! I'm ShelterSeek bot — your hotel booking assistant. I have ${roomCount} properties in my database. Where would you like to stay and when?`,
    showRooms: false,
    isGreeting: true
  };
}

// -------------------------------
// Smart Room Search
// -------------------------------
async function searchRooms(query) {
  if (!query || query.trim() === "") {
    // Return all rooms for empty query
    const rooms = await fetchRoomsFromAPI();
    return rooms.slice(0, 10);
  }
  
  const searchTerm = query.toLowerCase().trim();
  console.log(`[AI] Searching for: "${searchTerm}"`);
  
  // First, try API search
  let rooms = await fetchRoomsFromAPI(searchTerm);
  
  // If we found results, return them
  if (rooms.length > 0) {
    console.log(`[AI] Found ${rooms.length} rooms with direct search`);
    return rooms;
  }
  
  // If no direct results, fetch all and filter locally
  console.log(`[AI] No direct matches, fetching all rooms for intelligent filtering`);
  const allRooms = await fetchRoomsFromAPI();
  
  if (allRooms.length === 0) {
    return [];
  }
  
  // Intelligent filtering based on search intent
  const scoredRooms = allRooms.map(room => {
    let score = 0;
    
    // Name match (highest priority)
    if (room.name.toLowerCase().includes(searchTerm)) score += 100;
    
    // Location match (high priority)
    if (room.location.toLowerCase().includes(searchTerm)) score += 80;
    
    // Property type match
    if (room.propertyType.toLowerCase().includes(searchTerm)) score += 60;
    
    // Description match
    if (room.description.toLowerCase().includes(searchTerm)) score += 40;
    
    // Room type match
    if (room.roomType.toLowerCase().includes(searchTerm)) score += 50;
    
    // Amenities match
    room.amenities.forEach(amenity => {
      if (amenity.toLowerCase().includes(searchTerm)) score += 20;
    });
    
    // Price search
    const priceMatch = searchTerm.match(/\d+/);
    if (priceMatch) {
      const targetPrice = parseInt(priceMatch[0]);
      if (!isNaN(targetPrice)) {
        // Close price match
        const priceDiff = Math.abs(room.price - targetPrice);
        if (priceDiff < 500) score += 40;
        // Bonus for cheaper than target
        if (room.price <= targetPrice) score += 30;
      }
    }
    
    // Common search patterns with synonyms
    const searchPatterns = {
      "budget": ["cheap", "affordable", "economy", "low cost", "inexpensive"],
      "luxury": ["premium", "deluxe", "5-star", "high-end", "exclusive"],
      "hostel": ["dormitory", "backpacker"],
      "resort": ["vacation", "holiday"],
      "apartment": ["flat", "unit"],
      "family": ["kids", "children", "large", "spacious"],
      "pool": ["swimming", "jacuzzi", "hot tub"],
      "wifi": ["internet", "connection", "online"],
      "breakfast": ["meal", "food", "dining"]
    };
    
    // Check each pattern
    for (const [pattern, synonyms] of Object.entries(searchPatterns)) {
      if (searchTerm.includes(pattern) || synonyms.some(syn => searchTerm.includes(syn))) {
        // Check if room matches the pattern
        const roomText = [
          room.description,
          room.propertyType,
          room.roomType,
          ...room.amenities
        ].join(' ').toLowerCase();
        
        if (roomText.includes(pattern) || synonyms.some(syn => roomText.includes(syn))) {
          score += 35;
        }
        
        // Specific pattern bonuses
        if (pattern === "budget" && room.price < 2000) score += 25;
        if (pattern === "luxury" && room.price > 4000) score += 25;
        if (pattern === "family" && room.capacity >= 4) score += 20;
      }
    }
    
    // Popular location detection
    const popularLocations = {
      "hyderabad": ["hyderabad", "hyd"],
      "chitoor": ["chittoor", "chittor"],
      "sricity": ["sri city", "sri-city"],
      "goa": ["north goa", "south goa", "panaji", "calangute", "baga"],
      "mumbai": ["bandra", "colaba", "juhu", "andheri", "navi mumbai"]
    };
    
    for (const [location, aliases] of Object.entries(popularLocations)) {
      if (searchTerm.includes(location) || aliases.some(alias => searchTerm.includes(alias))) {
        if (room.location.toLowerCase().includes(location)) {
          score += 70;
        }
      }
    }
    
    // Boost verified/approved rooms
    if (room.status === "verified" || room.status === "approved") {
      score += 15;
    }
    
    // Boost available rooms (not booked)
    if (!room.booking) {
      score += 10;
    }
    
    return { ...room, score };
  });
  
  // Filter and sort by score
  const relevantRooms = scoredRooms
    .filter(room => room.score > 0)
    .sort((a, b) => b.score - a.score);
  
  console.log(`[AI] Intelligent filtering found ${relevantRooms.length} relevant rooms`);
  
  // If still no results, return some recent rooms
  if (relevantRooms.length === 0 && allRooms.length > 0) {
    console.log(`[AI] No matches found, returning recent rooms`);
    return allRooms.slice(0, 5);
  }
  
  return relevantRooms.slice(0, 8); // Limit to 8 results
}

// -------------------------------
// Generate Search Response
// -------------------------------
function generateSearchResponse(query, foundRooms) {
  if (foundRooms.length === 0) {
    return {
      reply: `I searched our database but couldn't find any rooms matching "${query}".\n\n**Try searching by:**\n• Location (e.g., "Hyderabad", "Chitoor")\n• Price range (e.g., "under 2000", "budget")\n• Room type (e.g., "hostel", "resort", "apartment")\n• Features (e.g., "with pool", "family room")\n\nOr simply browse all available rooms!`,
      suggestions: [
        "Show all rooms",
        "Search by location",
        "Filter by price",
        "Contact support"
      ]
    };
  }
  
  // Analyze found rooms
  const locations = [...new Set(foundRooms.map(r => r.location).filter(l => l && l !== "Location not specified"))];
  const propertyTypes = [...new Set(foundRooms.map(r => r.propertyType).filter(t => t))];
  const prices = foundRooms.map(r => r.price).filter(p => p > 0);
  
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
  
  // Build response
  let reply = `🔍 **Search Results for "${query}"**\n\n`;
  reply += ` Found **${foundRooms.length} room${foundRooms.length !== 1 ? 's' : ''}** `;
  
  if (locations.length === 1) {
    reply += `in **${locations[0]}** `;
  } else if (locations.length > 0 && locations.length <= 3) {
    reply += `in **${locations.join(', ')}** `;
  }
  
  if (minPrice > 0 && maxPrice > 0) {
    reply += `with prices from **₹${minPrice}** to **₹${maxPrice}** per night.\n\n`;
  } else {
    reply += `\n\n`;
  }
  
  // Show top rooms
  reply += `🏆 **Top Recommendations**\n\n`;
  
  foundRooms.slice(0, 3).forEach((room, index) => {
    const rankEmoji = index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉";
    
    reply += `${rankEmoji} **${room.name}**\n`;
    reply += `📍 ${room.location} | 👥 ${room.capacity} guests | 🏠 ${room.propertyType}\n`;
    reply += `💰 **₹${room.price}/night**`;
    
    if (room.discount > 0) {
      reply += ` (🎁 ${room.discount}% OFF)`;
    }
    
    // Add key amenities
    const keyAmenities = room.amenities.slice(0, 3);
    if (keyAmenities.length > 0) {
      reply += `\n✨ ${keyAmenities.join(' • ')}`;
    }
    
    // Short description
    if (room.description) {
      const shortDesc = room.description.length > 70 
        ? room.description.substring(0, 70) + "..."
        : room.description;
      reply += `\n📝 ${shortDesc}\n\n`;
    } else {
      reply += `\n\n`;
    }
  });
  
  if (foundRooms.length > 3) {
    reply += `📋 **Plus ${foundRooms.length - 3} more options available**\n\n`;
  }
  
  reply += `💡 **Need more details?** Click on any room or ask me specific questions!`;
  
  return {
    reply,
    suggestions: generateSearchSuggestions(foundRooms, query)
  };
}

// -------------------------------
// Generate Search Suggestions
// -------------------------------
function generateSearchSuggestions(foundRooms, query) {
  const suggestions = new Set();
  
  // Basic suggestions
  suggestions.add("Show all rooms");
  suggestions.add("Contact support");
  
  // Location-based from actual results
  const locations = [...new Set(foundRooms.map(r => r.location).filter(l => l))];
  locations.slice(0, 2).forEach(location => {
    suggestions.add(`More in ${location}`);
  });
  
  // Price range suggestions
  const prices = foundRooms.map(r => r.price).filter(p => p > 0);
  if (prices.length > 0) {
    const avgPrice = prices.reduce((a, b) => a + b) / prices.length;
    
    if (avgPrice < 2000) {
      suggestions.add("Mid-range ₹2000-₹4000");
      suggestions.add("Luxury ₹4000+");
    } else if (avgPrice < 4000) {
      suggestions.add("Budget under ₹2000");
      suggestions.add("Premium ₹4000+");
    } else {
      suggestions.add("Affordable under ₹3000");
      suggestions.add("Mid-range ₹3000-₹6000");
    }
  }
  
  // Property type suggestions
  const propertyTypes = [...new Set(foundRooms.map(r => r.propertyType).filter(t => t))];
  propertyTypes.slice(0, 2).forEach(type => {
    suggestions.add(`Browse ${type}s`);
  });
  
  // Common amenities suggestions
  const allAmenities = foundRooms.flatMap(r => r.amenities);
  const amenityCount = {};
  allAmenities.forEach(amenity => {
    if (amenity && typeof amenity === 'string') {
      amenityCount[amenity] = (amenityCount[amenity] || 0) + 1;
    }
  });
  
  const commonAmenities = Object.entries(amenityCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([amenity]) => amenity);
  
  commonAmenities.forEach(amenity => {
    suggestions.add(`With ${amenity}`);
  });
  
  // Query-specific suggestions
  if (query) {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes("hyderabad")) {
      suggestions.add("Hostels in Hyderabad");
      suggestions.add("Apartments in Hyderabad");
    }
    
    if (lowerQuery.includes("chitoor")) {
      suggestions.add("Resorts in Chitoor");
    }
    
    if (lowerQuery.includes("budget") || lowerQuery.includes("cheap")) {
      suggestions.add("Under ₹2000");
      suggestions.add("Best value");
    }
    
    if (lowerQuery.includes("luxury") || lowerQuery.includes("premium")) {
      suggestions.add("Premium amenities");
      suggestions.add("Exclusive stays");
    }
  }
  
  // Add popular search terms
  suggestions.add("With breakfast");
  suggestions.add("Free parking");
  suggestions.add("WiFi included");
  
  return Array.from(suggestions).slice(0, 6);
}

// -------------------------------
// Generate Initial Suggestions
// -------------------------------
async function generateInitialSuggestions() {
  try {
    const rooms = await fetchRoomsFromAPI();
    const locations = [...new Set(rooms.map(r => r.location).filter(l => l))];
    
    // Generate suggestions based on actual data
    const suggestions = [
      `Hotels in ${locations[0] || "Hyderabad"}`,
      "Budget stays",
      "Resorts",
      "Family rooms",
      "With WiFi",
      "Free parking"
    ];
    
    return suggestions;
  } catch (error) {
    return [
      "Search hotels in Hyderabad",
      "Show budget hotels",
      "Beachfront properties",
      "Luxury resorts",
      "Family rooms",
      "City center hotels"
    ];
  }
}

// ======================================================
// ===============   MAIN CHAT ENDPOINT   ===============
// ======================================================

app.post('/api/ai-chat', async (req, res) => {
  console.log("[AI Chat] Request received");
  
  try {
    const { message, history } = req.body;
    const query = message ? message.trim() : "";
    
    console.log(`[AI Chat] Processing query: "${query}"`);
    
    // Handle empty query
    if (!query) {
      const suggestions = await generateInitialSuggestions();
      return res.json({
        reply: "Hello! I'm your ShelterSeek booking assistant. How can I help you find the perfect accommodation today?",
        hotels: [],
        suggestions: suggestions
      });
    }
    
    // Handle greetings and small talk
    if (isGreetingOrSmallTalk(query)) {
      console.log("[AI Chat] Detected greeting/small talk");
      const greetingResponse = await generateGreetingResponse(query);
      
      // For greetings, return greeting without rooms
      return res.json({
        reply: greetingResponse.reply,
        hotels: [],
        suggestions: greetingResponse.isGreeting ? await generateInitialSuggestions() : []
      });
    }
    
    // Search for rooms
    const foundRooms = await searchRooms(query);
    
    // Generate response based on search results
    const response = generateSearchResponse(query, foundRooms);
    
    // Format rooms for frontend
    const formattedRooms = foundRooms.slice(0, 5).map(room => ({
      id: room.id,
      _id: room._id,
      name: room.name,
      price: room.price,
      location: room.location,
      description: room.description,
      capacity: room.capacity,
      propertyType: room.propertyType,
      roomType: room.roomType,
      amenities: room.amenities,
      discount: room.discount,
      images: room.images,
      status: room.status,
      booking: room.booking
    }));
    
    const result = {
      hotels: formattedRooms,
      suggestions: response.suggestions
    };
    
    console.log(`[AI Chat] Response ready: ${formattedRooms.length} rooms, ${response.suggestions.length} suggestions`);
    
    res.json(result);
    
  } catch (error) {
    console.error("[AI Chat] Error:", error);
    
    // Emergency fallback response with sample data from your API
    res.json({
      reply: "Hello! I'm your ShelterSeek booking assistant. Here are some available rooms. What type of accommodation are you looking for?",
      hotels: [
        {
          id: "69309fbea01d9d40e442be48",
          _id: "69309fbea01d9d40e442be48",
          name: "Shiva lodge",
          price: 2500,
          location: "Hyderabad",
          description: "Well-organized room featuring a comfortable bed and clean surroundings."
        },
        {
          id: "6930a0078fda3853d42237b7",
          _id: "6930a0078fda3853d42237b7",
          name: "Zen Hotel",
          price: 4500,
          location: "chitoor",
          description: "Clean, comfortable room with all basic necessities for a pleasant stay."
        },
        {
          id: "6930a1b0ec4639fa8f62344d",
          _id: "6930a1b0ec4639fa8f62344d",
          name: "Resort",
          price: 3500,
          location: "Hyderabad",
          description: "A bright, well-ventilated room with contemporary decor and smart space usage."
        }
      ],
      suggestions: [
        "Search in Hyderabad",
        "Budget stays",
        "Resorts",
        "Family rooms",
        "With amenities",
        "Contact support"
      ]
    });
  }
});
// errors are logged above

// ===============   INITIALIZATION   ===================
// ===============   Sai Part ended   ===================

// ========== CHAT ROUTES ==========

// Get or Create Direct Chat Room
app.post('/api/chat/room', authenticateToken, roleMiddleware.authenticated, async (req, res) => {
  try {
    const { participantId } = req.body;

    if (!participantId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Participant ID is required' 
      });
    }

    // Determine current user's model
    const currentUserModel = req.user.accountType === 'traveller' ? 'Traveler' : 'Host';
    
    // Find participant and determine their model
    let participant = await Traveler.findById(participantId);
    let participantModel = 'Traveler';
    
    if (!participant) {
      participant = await Host.findById(participantId);
      participantModel = 'Host';
    }
    
    if (!participant) {
      return res.status(404).json({ 
        success: false, 
        message: 'Participant not found' 
      });
    }

    // Find or create room
    let room = await Room.findOne({
      isGroup: false,
      participants: { 
        $all: [req.user._id, participantId],
        $size: 2 
      }
    });

    if (!room) {
      room = await Room.create({
        participants: [req.user._id, participantId],
        participantModels: [currentUserModel, participantModel],
        isGroup: false
      });
    }

    // Fetch room with populated participants
    room = await Room.findById(room._id);
    
    // Manually add participant details since we can't populate with different models
    const participants = [];
    
    // Get current user details
    const currentUser = currentUserModel === 'Traveler' 
      ? await Traveler.findById(req.user._id).select('name email profilePhoto online lastSeen')
      : await Host.findById(req.user._id).select('name email profilePhoto online lastSeen');
    
    // Get other participant details
    const otherParticipant = participantModel === 'Traveler'
      ? await Traveler.findById(participantId).select('name email profilePhoto online lastSeen')
      : await Host.findById(participantId).select('name email profilePhoto online lastSeen');
    
    participants.push({
      _id: req.user._id,
      name: currentUser?.name || 'Unknown',
      email: currentUser?.email || '',
      profilePhoto: currentUser?.profilePhoto || null,
      online: currentUser?.online || false,
      lastSeen: currentUser?.lastSeen || new Date()
    });
    
    participants.push({
      _id: participantId,
      name: otherParticipant?.name || 'Unknown',
      email: otherParticipant?.email || '',
      profilePhoto: otherParticipant?.profilePhoto || null,
      online: otherParticipant?.online || false,
      lastSeen: otherParticipant?.lastSeen || new Date()
    });

    const roomWithDetails = {
      ...room.toObject(),
      participants
    };

    res.json({
      success: true,
      room: roomWithDetails
    });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create chat room' 
    });
  }
});

// Get User's Chat Rooms
// In app.js, update the /api/chat/rooms endpoint
app.get('/api/chat/rooms', authenticateToken, roleMiddleware.authenticated, async (req, res) => {
  try {
    const rooms = await Room.find({
      participants: req.user._id
    })
    .populate('lastMessage')
    .sort({ updatedAt: -1 });

    // Manually populate participants for each room
    const roomsWithParticipants = await Promise.all(rooms.map(async (room) => {
      const participants = [];
      
      for (let i = 0; i < room.participants.length; i++) {
        const participantId = room.participants[i];
        const modelType = room.participantModels?.[i] || 'Traveler';
        
        let participant;
        if (modelType === 'Traveler') {
          participant = await Traveler.findById(participantId)
            .select('name email profilePhoto online lastSeen');
        } else {
          participant = await Host.findById(participantId)
            .select('name email profilePhoto online lastSeen');
        }
        
        if (participant) {
          participants.push({
            _id: participantId,
            name: participant.name || 'Unknown',
            email: participant.email || '',
            profilePhoto: participant.profilePhoto || null,
            online: participant.online || false,
            lastSeen: participant.lastSeen || new Date()
          });
        }
      }
      
      // Calculate unread count
      const unreadCount = await Message.countDocuments({
        roomId: room._id,
        sender: { $ne: req.user._id },
        read: false
      });
      
      return {
        ...room.toObject(),
        participants,
        unreadCount
      };
    }));

    res.json({
      success: true,
      rooms: roomsWithParticipants
    });
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch chat rooms' 
    });
  }
});

// Delete a Chat Room
app.delete('/api/chat/room/:roomId', authenticateToken, roleMiddleware.authenticated, async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    const isParticipant = room.participants.some(p => p.toString() === req.user._id.toString());
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this room' });
    }

    await Message.deleteMany({ roomId });
    await Room.findByIdAndDelete(roomId);

    res.json({ success: true, message: 'Chat deleted' });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete chat' });
  }
});

// Get Messages for a Room
app.get('/api/chat/messages/:roomId', authenticateToken, roleMiddleware.authenticated, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const room = await Room.findOne({
      _id: roomId,
      participants: req.user._id
    });

    if (!room) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }

    const messages = await Message.find({
      roomId,
      deleted: false
    })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: 1 });

    // Manually populate sender details
    const messagesWithSenders = await Promise.all(messages.map(async (msg) => {
      let sender;
      if (msg.senderModel === 'Traveler') {
        sender = await Traveler.findById(msg.sender).select('name profilePhoto');
      } else {
        sender = await Host.findById(msg.sender).select('name profilePhoto');
      }
      
      return {
        ...msg.toObject(),
        sender: {
          _id: msg.sender,
          name: sender?.name || 'Unknown',
          profilePhoto: sender?.profilePhoto || null
        }
      };
    }));

    // Mark messages as read
    await Message.updateMany(
      {
        roomId,
        sender: { $ne: req.user._id },
        read: false
      },
      {
        read: true,
        readAt: new Date()
      }
    );

    res.json({
      success: true,
      messages: messagesWithSenders,
      page,
      total: await Message.countDocuments({ roomId, deleted: false })
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch messages' 
    });
  }
});

// In app.js, update the search endpoint
app.get('/api/users/search', authenticateToken, roleMiddleware.authenticated, async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim().length < 2) {
      return res.json({ success: true, users: [] });
    }

    const searchTerm = query.trim().toLowerCase();
    
    const isEmailSearch = searchTerm.includes('@');
    
    const emailRegex = isEmailSearch 
      ? { $regex: `^${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
      : { $regex: searchTerm, $options: 'i' };
    
    const [travelers, hosts] = await Promise.all([
      Traveler.find({
        _id: { $ne: req.user._id },
        $or: [
          { name: { $regex: searchTerm, $options: 'i' } },
          { email: emailRegex }
        ]
      })
      .select('name email profilePhoto online lastSeen accountType')
      .limit(10)
      .lean(),

      Host.find({
        _id: { $ne: req.user._id },
        $or: [
          { name: { $regex: searchTerm, $options: 'i' } },
          { email: emailRegex }
        ]
      })
      .select('name email profilePhoto online lastSeen accountType')
      .limit(10)
      .lean()
    ]);

    console.log(`[Search] Query: "${searchTerm}", Found ${travelers.length} travelers, ${hosts.length} hosts`);

    // FIX: Create a Set to track seen IDs and emails
    const seenIds = new Set();
    const seenEmails = new Set();
    
    // Combine and format results
    const users = [...travelers, ...hosts]
      .map(user => ({
        _id: user._id.toString(),
        name: user.name || 'Unknown User',
        email: user.email || '',
        profilePhoto: user.profilePhoto || null,
        online: user.online || false,
        lastSeen: user.lastSeen || new Date(),
        accountType: user.accountType
      }))
      // Filter duplicates: check both ID AND email
      .filter(user => {
        // Skip current user
        if (user._id === req.user._id.toString()) return false;
        
        // Skip if we've seen this ID before
        if (seenIds.has(user._id)) return false;
        
        // Also skip if we've seen this email before (for extra safety)
        const email = user.email.toLowerCase();
        if (email && seenEmails.has(email)) return false;
        
        // Add to seen sets
        seenIds.add(user._id);
        if (email) seenEmails.add(email);
        
        return true;
      })
      // If searching by email, prioritize exact matches
      .sort((a, b) => {
        if (isEmailSearch) {
          const aMatch = (a.email || '').toLowerCase() === searchTerm;
          const bMatch = (b.email || '').toLowerCase() === searchTerm;
          if (aMatch && !bMatch) return -1;
          if (!aMatch && bMatch) return 1;
        }
        return 0;
      })
      .slice(0, 20);

    res.json({
      success: true,
      users,
      count: users.length
    });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to search users' 
    });
  }
});

// In app.js, add a test endpoint
app.post('/api/test-message', authenticateToken, roleMiddleware.authenticated, async (req, res) => {
  try {
    const { content, roomId } = req.body;
    
    const message = await Message.create({
      sender: req.user._id,
      senderModel: req.user.accountType === 'traveller' ? 'Traveler' : 'Host',
      content,
      type: 'text',
      roomId
    });
    
    console.log('Test message saved:', message);
    res.json({ success: true, message });
  } catch (error) {
    console.error('Test message error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== WEBSOCKET SETUP ==========
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ["GET", "POST"],
    credentials: true
  }
});
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || 
                  socket.handshake.headers.authorization?.split(' ')[1];
    
    if (!token) {
      console.log('No token provided for socket connection');
      return next(new Error('Authentication error: No token'));
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'myjwtsecret');
    
    // Find user in either Traveler or Host collections
    let user = await Traveler.findById(decoded.id);
    if (!user) {
      user = await Host.findById(decoded.id);
    }
    
    if (!user) {
      console.log('User not found for socket connection:', decoded.id);
      return next(new Error('User not found'));
    }

    // Attach user info to socket
    socket.userId = user._id;
    socket.user = {
      _id: user._id,
      name: user.name,
      email: user.email,
      accountType: user.accountType,
      profilePhoto: user.profilePhoto
    };
    
    console.log('Socket authenticated for user:', user.email);
    next();
  } catch (error) {
    console.error('Socket authentication error:', error.message);
    next(new Error('Authentication error'));
  }
});

const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.userId);
  
  onlineUsers.set(socket.userId.toString(), socket.id);
  
  // Update online status for both Traveler and Host models
  Traveler.findByIdAndUpdate(socket.userId, {
    online: true,
    lastSeen: new Date()
  }).exec().catch(() => {
    // If not found in Traveler, try Host
    Host.findByIdAndUpdate(socket.userId, {
      online: true,
      lastSeen: new Date()
    }).exec().catch(err => console.error('Error updating online status:', err));
  });

  socket.broadcast.emit('user-online', { userId: socket.userId });

  socket.join(`user:${socket.userId}`);

  socket.on('join-room', (roomId) => {
    if (!roomId) return;
    socket.join(roomId);
    console.log(`User ${socket.userId} joined room: ${roomId}`);
  });

  socket.on('leave-room', (roomId) => {
    if (!roomId) return;
    socket.leave(roomId);
    console.log(`User ${socket.userId} left room: ${roomId}`);
  });

  

socket.on('send-message', async (data) => {
  try {
    console.log('[WebSocket] Send message received:', data);
    console.log('[WebSocket] User ID:', socket.userId);
    
    const { roomId, content, type = 'text', mediaUrl } = data || {};

    if (!roomId || !content || !content.trim()) {
      
      return socket.emit('message-error', { error: 'Room ID and message content are required' });
    }
    
    // Make sure room exists and user is a participant
    const room = await Room.findById(roomId);
    if (!room) {
      
      return socket.emit('message-error', { error: 'Chat room not found' });
    }

    const isParticipant = room.participants.some(
      (p) => p.toString() === socket.userId.toString()
    );
    if (!isParticipant) {
      
      return socket.emit('message-error', { error: 'You are not a participant in this room' });
    }
    
    // Determine sender model
    let senderModel = 'Traveler';
    let sender = await Traveler.findById(socket.userId);
    if (!sender) {
      sender = await Host.findById(socket.userId);
      senderModel = 'Host';
    }

    
    const message = await Message.create({
      sender: socket.userId,
      senderModel,
      content: content.trim(),
      type,
      mediaUrl,
      roomId
    });
    
    room.lastMessage = message._id;
    room.updatedAt = new Date();
    await room.save();

    
    const populatedSender = {
      _id: socket.userId,
      name: sender?.name || 'Unknown',
      profilePhoto: sender?.profilePhoto || null,
      email: sender?.email || ''
    };

    const outMessage = {
      ...message.toObject(),
      sender: populatedSender
    };

    console.log('[WebSocket] Emitting to room:', roomId);
    
    // Emit to all sockets in the room (users who joined the room)
    io.to(roomId).emit('receive-message', outMessage);

    // CRITICAL FIX: Also emit to each participant's personal room
    // This ensures messages are delivered even if receiver hasn't joined the specific room
    for (const participantId of room.participants) {
      const pid = participantId.toString();
      
      // Skip sender (they already get the message via room emission)
      if (pid === socket.userId.toString()) continue;
      
      console.log('[WebSocket] Sending to participant:', pid);
      
      // Emit to the receiver's personal room
      io.to(`user:${pid}`).emit('receive-message', outMessage);
      
      // Also emit room-updated event to update the sidebar
      io.to(`user:${pid}`).emit('room-updated', {
        ...room.toObject(),
        lastMessage: outMessage,
        updatedAt: new Date()
      });
    }

    // Acknowledge back to sender
    socket.emit('message-sent', outMessage);
    
  } catch (error) {
    console.error('[WebSocket] Send message error:', error);
    console.error('[WebSocket] Error details:', error.message);
    socket.emit('message-error', { error: 'Failed to send message' });
  }
});

  socket.on('typing', (data) => {
    const { roomId, isTyping } = data;
    socket.to(roomId).emit('user-typing', {
      userId: socket.userId,
      userName: socket.user.name,
      isTyping
    });
  });

  socket.on('mark-read', async (data) => {
    try {
      const { messageId } = data;
      
      await Message.findByIdAndUpdate(messageId, {
        read: true,
        readAt: new Date()
      });

      const message = await Message.findById(messageId);
      io.to(message.roomId).emit('message-read', {
        messageId,
        userId: socket.userId,
        readAt: new Date()
      });
    } catch (error) {
      console.error('Mark read error:', error);
    }
  });

  
  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.userId);
    
    onlineUsers.delete(socket.userId?.toString());
    
    if (socket.userId) {
      // Update both Traveler and Host models
      try {
        await Traveler.findByIdAndUpdate(socket.userId, {
          online: false,
          lastSeen: new Date()
        });
        
        await Host.findByIdAndUpdate(socket.userId, {
          online: false,
          lastSeen: new Date()
        });
      } catch (err) {
        console.error('Error updating online status:', err);
      }
      
      socket.broadcast.emit('user-offline', { userId: socket.userId });
    }
  });
  
});

// Load initial inventory
setTimeout(async () => {
  try {
    const rooms = await fetchRoomsFromAPI();
    console.log(`[AI] Initial inventory loaded: ${rooms.length} rooms from API`);
    if (rooms.length > 0) {
      console.log("[AI] Sample rooms:", rooms.slice(0, 2).map(r => ({
        name: r.name,
        location: r.location,
        price: r.price
      })));
    }
  } catch (err) {
    console.error("[AI] Error loading initial inventory:", err.message);
  }
}, 1000);

console.log("[AI] Chat system initialized using /api/rooms endpoint");
app.delete('/api/users/:id', authenticateToken, roleMiddleware.adminOnly, adminController.deleteUser);

app.get('/api/error-logs', authenticateToken, roleMiddleware.adminOnly, async (req, res) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    
    const errorLogPath = path.join(logDirectory, 'error.log');
    
    try {
      const logContent = await fs.readFile(errorLogPath, 'utf8');
      const lines = logContent.trim().split('\n').filter(line => line);
      const logs = lines.map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return { raw: line };
        }
      });
      
      res.json({
        success: true,
        count: logs.length,
        logs: logs.reverse().slice(0, 100) 
      });
    } catch (err) {
      if (err.code === 'ENOENT') {
        res.json({ success: true, count: 0, logs: [], message: 'No error logs yet' });
      } else {
        throw err;
      }
    }
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch error logs' });
  }
});


const cleanupOldLogs = () => {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const files = fs.readdirSync(logDirectory);
    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    
    files.forEach(file => {
      if (file.endsWith('.log') || file.endsWith('.gz')) {
        const filePath = path.join(logDirectory, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtimeMs < thirtyDaysAgo) {
          fs.unlinkSync(filePath);
          console.log(`Deleted old log file: ${file}`);
        }
      }
    });
  } catch (err) {
    console.error('Error cleaning up old logs:', err);
  }
};


setInterval(cleanupOldLogs, 7 * 24 * 60 * 60 * 1000);

cleanupOldLogs();

console.log('Error logging middleware initialized');

// Test routes to verify role-based access
app.get('/api/test/traveler-only', authenticateToken, roleMiddleware.travelerOnly, (req, res) => {
  res.json({ success: true, message: 'Welcome traveler!', user: req.user.email });
});

app.get('/api/test/host-only', authenticateToken, roleMiddleware.hostOnly, (req, res) => {
  res.json({ success: true, message: 'Welcome host!', user: req.user.email });
});

app.get('/api/test/admin-only', authenticateToken, roleMiddleware.adminOnly, (req, res) => {
  res.json({ success: true, message: 'Welcome admin!', user: req.user.email });
});

app.get('/api/test/authenticated-only', authenticateToken, roleMiddleware.authenticated, (req, res) => {
  res.json({ success: true, message: 'Welcome authenticated user!', user: req.user.email });
});

// 404 error handler for unauthorized route attempts
app.use((req, res, next) => {
  // Log 404 errors
  const errorLog = {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl,
    statusCode: 404,
    statusMessage: 'Not Found',
    userId: req.user?._id || 'anonymous',
    userEmail: req.user?.email || '',
    userAccountType: req.user?.accountType || '',
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    attemptedAccess: 'Invalid route'
  };
  
  errorLogStream.write(JSON.stringify(errorLog) + '\n');
  
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Global error handler middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  
  const errorLog = {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl,
    statusCode: 500,
    statusMessage: 'Internal Server Error',
    userId: req.user?._id || 'anonymous',
    userEmail: req.user?.email || '',
    userAccountType: req.user?.accountType || '',
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : null
  };
  
  errorLogStream.write(JSON.stringify(errorLog) + '\n');
  
  res.status(500).json({ 
    success: false, 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Email: ${process.env.EMAIL_USER || process.env.EMAIL || 'Not set'}`);
  console.log(`Rooms: http://localhost:${PORT}/api/rooms`);
  console.log(`Health: http://localhost:${PORT}/health`);
});