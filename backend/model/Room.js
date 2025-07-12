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
  coordinates: Object,
  propertyType: String,
  capacity: Number,
  roomType: String,
  bedrooms: Number,
  beds: Number,
  maxDays: Number,
  roomSize: String,
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
  discount: {
    type: Number,
    default: 0
  },
  likes: {
    type: Number,
    default: 0
  },
  amenities: [String],
  images: [String],
  reviews: [String],
  
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { collection: 'RoomData' });

module.exports = hostConnection.model('RoomData', roomDataSchema);