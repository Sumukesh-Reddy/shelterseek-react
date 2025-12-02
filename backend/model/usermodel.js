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
  resetToken: {
    type: String,
    default: null
  },
  resetTokenExpires: {
    type: Date,
    default: null
  },
  accountType: {
    type: String,
    enum: ['traveller', 'host'],
    required: true
  },
  profilePhoto: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
};

// usermodel.js - UPDATED booking schema
const bookingSchema = new mongoose.Schema({
  bookingId: {
    type: String,
    required: true
  },
  roomId: {
    type: String,
    required: true
  },
  roomTitle: {
    type: String,
    required: true
  },
  hostId: {
    type: String,
    required: true
  },
  hostEmail: {
    type: String,
    required: true
  },
  checkIn: {
    type: Date,
    required: true
  },
  checkOut: {
    type: Date,
    required: true
  },
  days: {
    type: Number,
    required: true
  },
  totalCost: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['confirmed', 'pending', 'cancelled', 'completed', 'checked_in', 'checked_out'],
    default: 'confirmed'
  },
  bookedAt: {
    type: Date,
    default: Date.now
  },
  guests: {
    type: Number,
    default: 1
  },
  guestDetails: [{
    guestName: String,
    guestAge: Number,
    guestGender: String,
    guestContact: String,
    govtIdType: String,
    govtIdNumber: String
  }],
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded', 'partially_refunded'],
    default: 'completed'
  },
  paymentMethod: {
    type: String,
    enum: ['credit_card', 'debit_card', 'upi', 'net_banking', 'wallet'],
    default: 'credit_card'
  },
  specialRequests: {
    type: String,
    default: ''
  },
  transactionId: {
    type: String
  }
}, { 
  _id: false,
  timestamps: false
});
// Traveler Login Schema
const travelerLoginSchema = new mongoose.Schema(
  {
    ...baseUserFields,
    likedRooms: {
      type: [String],
      default: []
    },
    viewedRooms: {
      type: [{
        roomId: {
          type: String,
          required: true
        },
        viewedAt: {
          type: Date,
          default: Date.now
        }
      }],
      default: []
    },
    bookings: [bookingSchema] // Add bookings array for travelers
  },
  { 
    collection: 'LoginData'
  }
);

// Host Login Schema
const hostLoginSchema = new mongoose.Schema(
  {
    ...baseUserFields,
    propertyDetails: {
      type: Object,
      default: {}
    },
    hostBookings: [bookingSchema] // Add bookings array for hosts
  },
  { 
    collection: 'LoginData'
  }
);

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