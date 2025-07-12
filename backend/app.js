require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('fs');
const { ObjectId } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const hostAdminConnection = mongoose.createConnection(process.env.HOST_ADMIN_URI, {
  retryWrites: true,
  w: 'majority'
});


const RoomData = require('./model/Room');

app.get('/api/rooms', async (req, res) => {
  try {

    const rooms = await RoomData.find({
      status: { $regex: /^approved$/i }
    }).lean();

    if (rooms.length === 0) {
      const allRooms = await RoomData.find({}).lean();
      console.log('All rooms in DB:', allRooms);
    }

    const processedRooms = rooms.map(room => ({
      ...room,
      _id: room._id.toString(),
      status: room.status.toLowerCase(), 
      createdAt: room.createdAt.toISOString(),
      updatedAt: room.updatedAt?.toISOString() || null
    }));

    res.json({
      status: 'success',
      data: processedRooms
    });

  } catch (error) {
    console.error('Error in /api/rooms:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch rooms',
      error: error.message
    });
  }
});


// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});