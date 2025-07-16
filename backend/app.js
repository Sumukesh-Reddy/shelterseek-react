require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { ObjectId } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use('/public', express.static(path.join(__dirname, 'public')));

// Database connection
const hostAdminConnection = mongoose.createConnection(process.env.HOST_ADMIN_URI, {
  retryWrites: true,
  w: 'majority'
});

// Initialize GridFS
let gfsBucket;
hostAdminConnection.once('open', () => {
  gfsBucket = new mongoose.mongo.GridFSBucket(hostAdminConnection.db, {
    bucketName: 'images' // Make sure this matches your GridFS bucket name
  });
  console.log('GridFS Bucket initialized');
});

// Room Model
const RoomData = hostAdminConnection.model('RoomData', new mongoose.Schema({
  
}), 'RoomData');

// Enhanced /api/rooms endpoint with image processing
app.get('/api/rooms', async (req, res) => {
  try {
    const rooms = await RoomData.find({ status: { $regex: /^approved$/i } }).lean();

    const processedRooms = await Promise.all(rooms.map(async (room) => {
      // Process images array
      const processedImages = [];
      
      if (Array.isArray(room.images)) {
        for (const img of room.images) {
          try {
            // Case 1: Already a URL
            if (typeof img === 'string' && (img.startsWith('http') || img.startsWith('/'))) {
              processedImages.push(img);
              continue;
            }
            
            // Case 2: ObjectId reference
            if (ObjectId.isValid(img)) {
              const fileExists = await gfsBucket.find({ _id: new ObjectId(img) }).hasNext();
              if (fileExists) {
                processedImages.push(`/api/images/${img}`);
              }
              continue;
            }
          } catch (err) {
            console.error('Error processing image:', img, err);
          }
        }
      }

      return {
        ...room,
        _id: room._id.toString(),
        images: processedImages.length > 0 ? processedImages : ['/images/default-house.jpg'],
        hostImage: room.hostImage && ObjectId.isValid(room.hostImage)
          ? `/api/images/${room.hostImage}`
          : '/images/default-host.jpg'
      };
    }));

    res.json({ status: 'success', data: processedRooms });
  } catch (error) {
    console.error('Error in /api/rooms:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch rooms',
      error: error.message
    });
  }
});


app.get('/api/rooms/:id', async (req, res) => {
  try {
    const roomId = req.params.id;
    console.log('Requested room ID:', roomId); // Debug logging

    if (!ObjectId.isValid(roomId)) {
      console.log('Invalid ID format:', roomId);
      return res.status(400).json({
        status: 'error',
        message: 'Invalid room ID format'
      });
    }

    const room = await RoomData.findOne({ 
      _id: new mongoose.Types.ObjectId(roomId),
      status: { $regex: /^approved$/i }
    }).lean();

    if (!room) {
      console.log('Room not found:', roomId);
      return res.status(404).json({
        status: 'error',
        message: 'Room not found or not approved'
      });
    }

    console.log('Found room:', room._id); // Debug logging
    const processedRoom = await processRoomData(room);
    res.json({ status: 'success', data: processedRoom });
  } catch (error) {
    console.error('Error in /api/rooms/:id:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch room',
      error: error.message
    });
  }
});
// Image serving endpoint
app.get('/api/images/:id', async (req, res) => {
  try {
    const imageId = req.params.id;
    
    if (!ObjectId.isValid(imageId)) {
      return res.status(400).send('Invalid image ID');
    }
    
    const file = await gfsBucket.find({ _id: new ObjectId(imageId) }).next();
    if (!file) {
      return res.status(404).send('Image not found');
    }
    
    res.set('Content-Type', file.contentType);
    const readStream = gfsBucket.openDownloadStream(file._id);
    readStream.pipe(res);
  } catch (error) {
    console.error('Error serving image:', error);
    res.status(500).send('Server error');
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});