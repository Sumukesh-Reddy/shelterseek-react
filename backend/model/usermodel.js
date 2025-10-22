const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Common fields shared by both types of users
const baseUserFields = {
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/.+\@.+\..+/, 'Please enter a valid email']
  },
  password: {
    type: String,
    minlength: 8,
    select: false
  },
  googleId: {
    type: String,
    default: null
  },
  otp: {
    type: String,
    default: null
  },
  otpExpiresAt: {
    type: Date,
    default: null
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  accountType: {
    type: String,
    enum: ['traveller', 'host'],
    required: true
  },
  profilePhoto: {
    type: String, // Store GridFS file ID or Google photo URL
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
};

// Traveler Login Schema
const travelerLoginSchema = new mongoose.Schema(
  {
    ...baseUserFields,
  },
  { collection: 'LoginData' }
);

// Host Login Schema
const hostLoginSchema = new mongoose.Schema(
  {
    ...baseUserFields,
    propertyDetails: {
      type: Object,
      default: {}
    }
  },
  { collection: 'LoginData' }
);

// Hash password only if set (not for Google users)
async function hashPassword(next) {
  if (!this.isModified('password') || !this.password) return next();
  try {
    this.password = await bcrypt.hash(this.password, 12);
    next();
  } catch (err) {
    next(err);
  }
}

travelerLoginSchema.pre('save', hashPassword);
hostLoginSchema.pre('save', hashPassword);

// Compare password
travelerLoginSchema.methods.correctPassword = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

hostLoginSchema.methods.correctPassword = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

const Traveler = mongoose.model('Traveler', travelerLoginSchema);
const Host = mongoose.model('Host', hostLoginSchema);

module.exports = { Traveler, Host };
