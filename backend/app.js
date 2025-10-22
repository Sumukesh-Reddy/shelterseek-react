require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const session = require('express-session');
const MongoStore = require('connect-mongo'); // Add this
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

// send OTP
app.post('/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email required' });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[email] = { otp, expires: Date.now() + 10 * 60 * 1000 }; // 10 minutes

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Your OTP Code',
    text: `Your verification code is ${otp}. It expires in 10 minutes.`
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'OTP sent successfully!' });
  } catch (error) {
    console.error('Email error:', error);
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

    // Check both collections
    const existingTraveler = await Traveler.findOne({ email });
    const existingHost = await Host.findOne({ email });
    
    if (existingTraveler || existingHost) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    let user;

    if (accountType === 'host') {
      user = new Host({ 
        name, 
        email, 
        password: hashedPassword, 
        accountType: 'host',
        isVerified: false 
      });
    } else {
      user = new Traveler({ 
        name, 
        email, 
        password: hashedPassword, 
        accountType: 'traveller',
        isVerified: false 
      });
    }

    await user.save();

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

      res.json({
        success: true,
        message: 'Login successful',
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          accountType: user.accountType
        }
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

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});