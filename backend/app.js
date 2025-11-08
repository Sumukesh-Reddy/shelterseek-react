require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cors = require('cors');
const { Traveler, Host } = require('./model/usermodel');
const Image = require('./model/Image');

const app = express();
const PORT = process.env.PORT || 3001;
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// ==================== LOCAL FILE STORAGE SETUP ====================

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads', { recursive: true });
}

// Configure multer for local file storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp and random string
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Serve uploaded files statically
app.use('/uploads', express.static('uploads'));

// ==================== DATABASE SETUP ====================

// Main database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/BackendDb')
  .then(() => console.log('MongoDB connected to BackendDb'))
  .catch(err => console.error('MongoDB connection error:', err));

// Host_Admin database connection for RoomData
global.hostAdminConnection = mongoose.createConnection(
  process.env.MONGODB_URI || 'mongodb://localhost:27017/Host_Admin', 
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

global.hostAdminConnection.once('open', () => {
  console.log('Connected to Host_Admin database for RoomData');
});

global.hostAdminConnection.on('error', (err) => {
  console.error('Host_Admin database connection error:', err);
});

// ==================== MIDDLEWARE ====================

app.use(cors({ 
  origin: process.env.FRONTEND_URL || 'http://localhost:3000', 
  credentials: true 
}));
app.use(express.json());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret123',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/BackendDb',
    collectionName: 'sessions'
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24,
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true
  }
}));

// Passport configuration
app.use(passport.initialize());
app.use(passport.session());
require('./config/passport')(passport);

// ==================== ROUTES ====================

const authRoutes = require('./routes/authRoutes');
app.use('/auth', authRoutes);

const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const otpStore = {};
const verifiedEmails = new Set();

// ==================== EMAIL ENDPOINTS ====================

// Email configuration test endpoint
app.get('/test-email-config', async (req, res) => {
  try {
    const emailUser = process.env.EMAIL_USER || process.env.EMAIL;
    const hasEmailCreds = Boolean(emailUser && process.env.EMAIL_PASS);
    
    if (!hasEmailCreds) {
      return res.json({ 
        success: false, 
        message: 'Email credentials missing'
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
    res.json({ 
      success: false, 
      message: 'Email configuration error',
      error: error.message 
    });
  }
});

// Simple email test endpoint
app.post('/simple-email-test', async (req, res) => {
  try {
    const { toEmail } = req.body;
    
    if (!toEmail) {
      return res.status(400).json({ success: false, message: 'Email required' });
    }

    const emailUser = process.env.EMAIL_USER || process.env.EMAIL;
    const hasEmailCreds = Boolean(emailUser && process.env.EMAIL_PASS);
    
    if (!hasEmailCreds) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email credentials not configured'
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
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send test email',
      error: error.message 
    });
  }
});

// Environment debug endpoint
app.get('/debug-env', (req, res) => {
  res.json({
    EMAIL_USER: process.env.EMAIL_USER || 'Not set',
    EMAIL: process.env.EMAIL || 'Not set', 
    EMAIL_PASS: process.env.EMAIL_PASS ? 'Set' : 'Not set',
    NODE_ENV: process.env.NODE_ENV,
    MONGODB_URI: process.env.MONGODB_URI ? 'Set' : 'Not set'
  });
});

// ==================== OTP ENDPOINTS ====================

app.post('/send-otp', async (req, res) => {
  const { email } = req.body;
  
  if (!email) return res.status(400).json({ message: 'Email required' });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[email] = { otp, expires: Date.now() + 10 * 60 * 1000 };

  const emailUser = process.env.EMAIL_USER || process.env.EMAIL;
  const hasEmailCreds = Boolean(emailUser && process.env.EMAIL_PASS);
  const isProd = process.env.NODE_ENV === 'production';

  if (!hasEmailCreds && !isProd) {
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
    if (!isProd) {
      return res.json({ success: true, message: 'OTP generated (dev fallback)', otp });
    }
    res.status(500).json({ success: false, error: 'Failed to send OTP' });
  }
});

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

// ==================== AUTHENTICATION ENDPOINTS ====================

app.post('/signup', async (req, res) => {
  try {
    const { name, email, password, accountType } = req.body;

    if (!name || !email || !password || !accountType) {
      return res.status(400).json({ success: false, message: 'All fields required' });
    }

    if (!verifiedEmails.has(email)) {
      return res.status(400).json({ success: false, message: 'Please verify OTP before signup' });
    }

    const existingTraveler = await Traveler.findOne({ email });
    const existingHost = await Host.findOne({ email });
    
    if (existingTraveler || existingHost) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    let user;

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

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password required' });

    let user = await Traveler.findOne({ email }).select('+password');
    if (!user) {
      user = await Host.findOne({ email }).select('+password');
    }

    if (!user) return res.status(400).json({ success: false, message: 'User not found' });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid)
      return res.status(401).json({ success: false, message: 'Invalid credentials' });

    req.login(user, (err) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Login failed' });
      }
      
      const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET || 'myjwtsecret', { expiresIn: '1d' });

      const userData = {
        id: user._id,
        name: user.name,
        email: user.email,
        accountType: user.accountType
      };

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
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

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

app.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Logout failed' });
    }
    req.session.destroy();
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

// ==================== AUTHENTICATION MIDDLEWARE ====================

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ success: false, message: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'myjwtsecret');
    
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
    return res.status(403).json({ success: false, message: 'Invalid or expired token' });
  }
};

// ==================== IMAGE HANDLING ENDPOINTS (LOCAL STORAGE) ====================

// ==================== FIXED UPLOAD ENDPOINT ====================

// Upload endpoint for local file storage - FIXED VERSION
app.post('/api/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    console.log('File upload details:', {
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size,
      destination: req.file.destination
    });

    // Verify file actually exists on disk
    if (!fs.existsSync(req.file.path)) {
      console.error('File was not saved to disk:', req.file.path);
      return res.status(500).json({ 
        success: false, 
        message: 'File upload failed - file not saved to disk' 
      });
    }

    // Get file stats to verify
    const stats = fs.statSync(req.file.path);
    console.log('File verified on disk:', {
      size: stats.size,
      exists: true
    });
    
    // Save to Image collection for reference
    const imageRecord = new Image({
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype,
      uploadDate: new Date()
    });
    
    await imageRecord.save();
    
    res.json({
      success: true,
      message: 'Image uploaded successfully',
      filename: req.file.filename,
      path: `/uploads/${req.file.filename}`,
      imageRecordId: imageRecord._id,
      fileSize: req.file.size
    });
  } catch (error) {
    console.error('Upload error:', error);
    
    // If there was an error, delete the partially uploaded file
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Upload failed', 
      error: error.message 
    });
  }
});

// ==================== FIXED IMAGE RETRIEVAL ENDPOINT ====================

// Get image by ID - ENHANCED WITH BETTER ERROR HANDLING
app.get('/api/image/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ success: false, message: 'Image ID required' });
    }

    console.log('Looking for image:', id);

    // First, try to find in Image collection
    let imageRecord;
    
    // Check if ID is a MongoDB ObjectId
    if (mongoose.Types.ObjectId.isValid(id)) {
      imageRecord = await Image.findById(id);
    }
    
    // If not found by ID, try by filename
    if (!imageRecord) {
      imageRecord = await Image.findOne({ filename: id });
    }

    let filePath;
    let contentType = 'image/jpeg';

    // If we found a record
    if (imageRecord) {
      console.log('Found image record:', {
        id: imageRecord._id,
        filename: imageRecord.filename,
        path: imageRecord.path
      });
      
      // Check if file exists at the recorded path
      if (imageRecord.path && fs.existsSync(imageRecord.path)) {
        filePath = imageRecord.path;
        contentType = imageRecord.mimetype || 'image/jpeg';
      } else {
        // Try the uploads directory as fallback
        const uploadsPath = path.join(__dirname, 'uploads', imageRecord.filename);
        if (fs.existsSync(uploadsPath)) {
          filePath = uploadsPath;
          contentType = imageRecord.mimetype || 'image/jpeg';
        } else {
          console.log('File not found for record:', imageRecord.filename);
          return servePlaceholder(res, `Image file missing: ${imageRecord.filename}`);
        }
      }
    } else {
      // No record found, try direct file lookup in uploads folder
      console.log('No image record found, trying direct file lookup');
      const uploadsDir = path.join(__dirname, 'uploads');
      
      // Check if uploads directory exists
      if (!fs.existsSync(uploadsDir)) {
        return servePlaceholder(res, 'Uploads directory not found');
      }
      
      // Get all files in uploads directory
      const files = fs.readdirSync(uploadsDir);
      console.log('Files in uploads directory:', files);
      
      // Try to find the file
      const foundFile = files.find(file => file === id || file.startsWith(id));
      if (foundFile) {
        filePath = path.join(uploadsDir, foundFile);
        // Guess content type from extension
        const ext = path.extname(foundFile).toLowerCase();
        const mimeTypes = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.gif': 'image/gif',
          '.webp': 'image/webp'
        };
        contentType = mimeTypes[ext] || 'image/jpeg';
      }
    }

    // If we found a file path, serve the image
    if (filePath && fs.existsSync(filePath)) {
      console.log('Serving image from:', filePath);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);

      fileStream.on('error', (error) => {
        console.error('File stream error:', error);
        servePlaceholder(res, 'Error streaming image');
      });
      
      return;
    }

    // If we get here, no image was found
    console.log('Image not found, serving placeholder');
    servePlaceholder(res, `Image not found: ${id}`);

  } catch (error) {
    console.error('Image retrieval error:', error);
    servePlaceholder(res, 'Server error retrieving image');
  }
});

// Helper function to serve placeholder images
function servePlaceholder(res, message) {
  const placeholderSvg = `
    <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f8f9fa"/>
      <rect width="100%" height="100%" fill="url(#gradient)" opacity="0.2"/>
      <defs>
        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#e9ecef" />
          <stop offset="100%" stop-color="#dee2e6" />
        </linearGradient>
      </defs>
      <text x="50%" y="45%" text-anchor="middle" dy=".3em" font-family="Arial, sans-serif" font-size="16" fill="#6c757d">No Image Available</text>
      <text x="50%" y="55%" text-anchor="middle" dy=".3em" font-family="Arial, sans-serif" font-size="12" fill="#adb5bd">${message}</text>
      <circle cx="50%" cy="70%" r="20" fill="#dee2e6" stroke="#adb5bd" stroke-width="1"/>
      <path d="M195 205 L205 215 M205 205 L195 215" stroke="#6c757d" stroke-width="2"/>
    </svg>
  `;
  
  res.setHeader('Content-Type', 'image/svg+xml');
  res.send(placeholderSvg);
}

// Get all uploaded images
app.get('/api/images', async (req, res) => {
  try {
    const images = await Image.find().sort({ uploadDate: -1 });
    
    const imageList = images.map(image => ({
      id: image._id,
      filename: image.filename,
      originalName: image.originalName,
      path: `/uploads/${image.filename}`,
      apiUrl: `/api/image/${image._id}`,
      directUrl: `/uploads/${image.filename}`,
      uploadDate: image.uploadDate,
      size: image.size
    }));
    
    res.json({
      success: true,
      count: imageList.length,
      images: imageList
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching images', error: error.message });
  }
});

// Debug endpoint to check all uploaded files
app.get('/api/debug/files', async (req, res) => {
  try {
    // Get files from database
    const dbImages = await Image.find().sort({ uploadDate: -1 });
    
    // Get files from uploads directory
    const uploadDir = path.join(__dirname, 'uploads');
    let diskFiles = [];
    
    if (fs.existsSync(uploadDir)) {
      diskFiles = fs.readdirSync(uploadDir).map(filename => {
        const filePath = path.join(uploadDir, filename);
        const stats = fs.statSync(filePath);
        return {
          filename,
          size: stats.size,
          modified: stats.mtime
        };
      });
    }
    
    res.json({
      success: true,
      database: {
        count: dbImages.length,
        images: dbImages.map(img => ({
          id: img._id,
          filename: img.filename,
          path: img.path
        }))
      },
      disk: {
        count: diskFiles.length,
        files: diskFiles
      },
      missingInDb: diskFiles.filter(diskFile => 
        !dbImages.some(dbImg => dbImg.filename === diskFile.filename)
      ).map(f => f.filename),
      missingOnDisk: dbImages.filter(dbImg => 
        !diskFiles.some(diskFile => diskFile.filename === dbImg.filename)
      ).map(img => img.filename)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== ROOM ENDPOINTS ====================

const RoomData = require('./model/room');

app.get('/api/rooms', async (req, res) => {
  try {
    const rooms = await RoomData.find({ 
      $or: [
        { status: { $regex: /^verified$/i } },
        { status: { $regex: /^approved$/i } }
      ],
      booking: { $ne: true }
    }).lean();
    
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
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch rooms',
      error: error.message
    });
  }
});

// ... (keep all your other existing endpoints for traveler, bookings, password reset, etc.)

// ==================== HEALTH AND STATUS ENDPOINTS ====================

app.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Server is running', 
    timestamp: new Date().toISOString() 
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    message: 'API is working',
    endpoints: {
      auth: '/auth',
      rooms: '/api/rooms',
      upload: '/api/upload',
      images: '/api/images',
      imageById: '/api/image/:id',
      health: '/health'
    },
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    storage: 'Local file storage (uploads folder)'
  });
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Local file storage: ./uploads/`);
  console.log(`Access uploaded files at: http://localhost:${PORT}/uploads/`);
  console.log(`Access images via API: http://localhost:${PORT}/api/image/:id`);
});