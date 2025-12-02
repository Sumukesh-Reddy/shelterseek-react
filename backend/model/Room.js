const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config(); 

const hostConnection = mongoose.createConnection(process.env.HOST_ADMIN_URI, {
 
  retryWrites: true,
  w: 'majority'
});

// Optional: log when connected
hostConnection.on('connected', () => {
  console.log('✅ Connected to Host_Admin database for RoomData');
});

hostConnection.on('error', (err) => {
  console.error('❌ Failed to connect to Host_Admin DB:', err.message);
});

const roomDataSchema = new mongoose.Schema({
  name: String,
  email: String,
  title: String,
  description: String,
  price: Number,
  location: String,
  coordinates: {
    lat: Number,
    lng: Number
  },
  propertyType: String,
  capacity: Number,
  roomType: String,
  bedrooms: Number,
  beds: Number,
  maxdays: Number, 
  roomSize: String,
  roomLocation: String, 
  transportDistance: String,
  hostGender: String,
  foodFacility: String,
  status: {
    type: String,
    set: function(v) { 
      return v ? v.toString().toLowerCase() : 'pending'; 
    },
    default: 'pending'
  },
  booking: {
    type: Boolean,
    default: false
  },
  bookedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  
  discount: {
    type: Number,
    default: 0
  },
  likes: {
    type: Number,
    default: 0
  },
  unavailableDates: [Date],
  amenities: [String],
  images: [mongoose.Schema.Types.ObjectId], 
  reviews: [Object], 
  
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { collection: 'RoomData' });

module.exports = hostConnection.model('RoomData', roomDataSchema);