// models/Booking.js - UPDATED
const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  bookingId: {
    type: String,
    unique: true,
    default: () => new mongoose.Types.ObjectId().toString()
  },
  travelerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Traveler',
    required: true
  },
  travelerName: {
    type: String,
    required: true
  },
  travelerEmail: {
    type: String,
    required: true
  },
  
  // Guest Information
  guests: {
    type: Number,
    default: 1
  },
  guestDetails: [{
    guestName: {
      type: String,
      required: true
    },
    guestAge: {
      type: Number,
      min: 0
    },
    guestGender: {
      type: String,
      enum: ['male', 'female', 'other']
    },
    guestContact: {
      type: String
    },
    govtIdType: {
      type: String,
      enum: ['aadhar', 'passport', 'driving_license', 'voter_id', 'pan_card', 'other']
    },
    govtIdNumber: {
      type: String
    }
  }],
  
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
  
  // Payment Information
  paymentDetails: {
    paymentMethod: {
      type: String,
      enum: ['credit_card', 'debit_card', 'upi', 'net_banking', 'wallet'],
      default: 'credit_card'
    },
    cardLastFour: {
      type: String,
      maxlength: 4
    },
    cardType: {
      type: String,
      enum: ['visa', 'mastercard', 'amex', 'rupay', 'other']
    },
    transactionId: {
      type: String,
      unique: true
    },
    paymentGateway: {
      type: String,
      default: 'razorpay'
    },
    paymentDate: {
      type: Date,
      default: Date.now
    }
  },
  
  bookingStatus: {
    type: String,
    enum: ['confirmed', 'pending', 'cancelled', 'completed', 'checked_in', 'checked_out'],
    default: 'confirmed'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded', 'partially_refunded'],
    default: 'completed'
  },
  
  bookedAt: {
    type: Date,
    default: Date.now
  },
  
  // Additional fields
  specialRequests: {
    type: String,
    default: ''
  },
  cancellationReason: {
    type: String
  },
  cancellationDate: {
    type: Date
  },
  refundAmount: {
    type: Number,
    default: 0
  },
  
  // Check-in/Check-out timestamps
  actualCheckIn: {
    type: Date
  },
  actualCheckOut: {
    type: Date
  },
  
  // Review
  reviewSubmitted: {
    type: Boolean,
    default: false
  },
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  reviewComment: {
    type: String
  }
}, {
  timestamps: true
});

bookingSchema.index({ travelerId: 1, bookedAt: -1 });
bookingSchema.index({ hostId: 1, bookedAt: -1 });
bookingSchema.index({ roomId: 1, checkIn: 1, checkOut: 1 });
bookingSchema.index({ paymentStatus: 1 });
bookingSchema.index({ bookingStatus: 1 });
bookingSchema.index({ 'paymentDetails.transactionId': 1 });

const Booking =
  mongoose.models.Booking || mongoose.model('Booking', bookingSchema);

module.exports = Booking;
module.exports.schema = bookingSchema;