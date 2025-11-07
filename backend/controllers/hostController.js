// controllers/hostController.js
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Define schema (but don't create model yet)
const listingSchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true,
    default: () => new mongoose.Types.ObjectId().toString()
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  location: {
    type: String,
    required: true
  },
  coordinates: {
    lat: Number,
    lng: Number
  },
  maxdays: {
    type: Number,
    required: true
  },
  propertyType: {
    type: String,
    required: true
  },
  capacity: {
    type: Number,
    required: true
  },
  roomType: {
    type: String,
    required: true
  },
  bedrooms: {
    type: Number,
    required: true
  },
  beds: {
    type: Number,
    required: true
  },
  roomSize: {
    type: String,
    required: true
  },
  roomLocation: String,
  transportDistance: String,
  hostGender: String,
  foodFacility: String,
  amenities: [String],
  discount: {
    type: Number,
    default: 0
  },
  images: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Image'
  }],
  likes: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  booking: {
    type: Boolean,
    default: false
  },
  reviews: [{
    type: String
  }],
  availability: [{
    type: Date
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'RoomData',
  versionKey: false,
  autoIndex: true,
  id: false
});

// We'll create the model only when connection is ready
let Listing;
let gfsBucket;

// Function to initialize models (called from app.js)
const initializeHostModels = () => {
  if (!global.hostAdminConnection) {
    throw new Error('hostAdminConnection is not ready');
  }
  if (!global.gfsBucket) {
    global.gfsBucket = new GridFSBucket(global.hostAdminConnection.db, { bucketName: 'images' });
  }

  Listing = global.hostAdminConnection.model('Listing', listingSchema);
  gfsBucket = global.gfsBucket;
};

// Create listing
const createListing = async (req, res) => {
  try {
    if (!Listing) {
      if (!global.hostAdminConnection || global.hostAdminConnection.readyState !== 1) {
        return res.status(503).json({
          success: false,
          message: 'Database connection not ready. Please try again in a moment.',
          error: 'hostAdminConnection is not ready'
        });
      }
      initializeHostModels();
    }

    const currentUser = JSON.parse(req.body.currentUser);
    const imageIds = [];

    // Ensure gfsBucket is available
    if (!gfsBucket) {
      gfsBucket = global.gfsBucket;
      if (!gfsBucket) {
        return res.status(503).json({
          success: false,
          message: 'File storage not ready. Please try again in a moment.',
          error: 'GridFS bucket not initialized'
        });
      }
    }

    // Upload images to GridFS
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const filePath = file.path;
        const fileStream = fs.createReadStream(filePath);
        const uploadStream = gfsBucket.openUploadStream(file.originalname, {
          contentType: file.mimetype
        });

        await new Promise((resolve, reject) => {
          fileStream.pipe(uploadStream)
            .on('error', reject)
            .on('finish', () => {
              imageIds.push(uploadStream.id.toString());
              resolve();
            });
        });

        // Clean up temp file
        fs.unlinkSync(filePath);
      }
    }

    const listingData = {
      ...req.body,
      name: currentUser.name,
      email: currentUser.email,
      images: imageIds,
      price: parseFloat(req.body.price),
      maxdays: parseInt(req.body.maxdays),
      capacity: parseInt(req.body.capacity),
      bedrooms: parseInt(req.body.bedrooms),
      beds: parseInt(req.body.beds),
      discount: parseInt(req.body.discount) || 0,
      amenities: req.body.amenities ? req.body.amenities.split(',') : [],
      coordinates: {
        lat: parseFloat(req.body.latitude),
        lng: parseFloat(req.body.longitude)
      },
      likes: 0,
      booking: false,
      reviews: [],
      availability: req.body.availability ? (Array.isArray(req.body.availability) 
        ? req.body.availability.map(date => new Date(date))
        : JSON.parse(req.body.availability).map(date => new Date(date))
      ) : []
    };

    const listing = new Listing(listingData);
    await listing.save();

    res.status(201).json({
      success: true,
      message: 'Listing created successfully',
      data: { listing }
    });

  } catch (error) {
    console.error('Create listing error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create listing',
      error: error.message
    });
  }
};

// Update listing
const updateListing = async (req, res) => {
  try {
    if (!Listing) initializeHostModels();

    const listingId = req.params.id;
    const currentUser = JSON.parse(req.body.currentUser);
    const removedImages = req.body.removedImages ? req.body.removedImages.split(',') : [];

    // Delete removed images from GridFS
    for (const imgId of removedImages) {
      if (imgId) {
        try {
          await gfsBucket.delete(new mongoose.Types.ObjectId(imgId));
        } catch (err) {
          console.warn(`Failed to delete image ${imgId}:`, err.message);
        }
      }
    }

    const newImageIds = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const filePath = file.path;
        const fileStream = fs.createReadStream(filePath);
        const uploadStream = gfsBucket.openUploadStream(file.originalname, {
          contentType: file.mimetype
        });

        const uploaded = await new Promise((resolve, reject) => {
          fileStream.pipe(uploadStream)
            .on('error', reject)
            .on('finish', () => resolve(uploadStream.id.toString()));
        });
        newImageIds.push(uploaded);
        fs.unlinkSync(filePath);
      }
    }

    const updatedData = {
      ...req.body,
      name: currentUser.name,
      email: currentUser.email,
      images: [...(req.body.existingImages ? JSON.parse(req.body.existingImages) : []), ...newImageIds],
      price: parseFloat(req.body.price),
      maxdays: parseInt(req.body.maxdays),
      capacity: parseInt(req.body.capacity),
      bedrooms: parseInt(req.body.bedrooms),
      beds: parseInt(req.body.beds),
      discount: parseInt(req.body.discount) || 0,
      amenities: req.body.amenities ? req.body.amenities.split(',') : [],
      coordinates: {
        lat: parseFloat(req.body.latitude),
        lng: parseFloat(req.body.longitude)
      }
    };
    
    // Handle availability dates
    if (req.body.availability) {
      updatedData.availability = Array.isArray(req.body.availability)
        ? req.body.availability.map(date => new Date(date))
        : JSON.parse(req.body.availability).map(date => new Date(date));
    }
    
    // Preserve existing reviews, likes, and booking if not being updated
    if (req.body.reviews === undefined) {
      delete updatedData.reviews;
    }
    if (req.body.likes === undefined) {
      delete updatedData.likes;
    }
    if (req.body.booking === undefined) {
      delete updatedData.booking;
    }

    const listing = await Listing.findByIdAndUpdate(listingId, updatedData, { new: true });
    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }

    res.json({
      success: true,
      message: 'Listing updated successfully',
      data: { listing }
    });

  } catch (error) {
    console.error('Update listing error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update listing',
      error: error.message
    });
  }
};

// Get listing by ID
const getListingById = async (req, res) => {
  try {
    if (!Listing) initializeHostModels();

    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }

    res.json({
      success: true,
      data: { listing }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get image
const getImage = async (req, res) => {
  try {
    if (!gfsBucket) {
      return res.status(500).json({ success: false, message: 'GridFS not initialized' });
    }

    const fileId = new mongoose.Types.ObjectId(req.params.id);
    const file = await gfsBucket.find({ _id: fileId }).next();

    if (!file) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }

    res.set('Content-Type', file.contentType);
    const downloadStream = gfsBucket.openDownloadStream(fileId);
    downloadStream.pipe(res);

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch image',
      error: error.message
    });
  }
};

// Get all listings (for admin/host)
const getListings = async (req, res) => {
  try {
    if (!Listing) initializeHostModels();

    const listings = await Listing.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      data: { listings }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch listings',
      error: error.message
    });
  }
};

// Update listing status
const updateListingStatus = async (req, res) => {
  try {
    if (!Listing) initializeHostModels();

    const { status } = req.body;
    const listing = await Listing.findByIdAndUpdate(
      req.params.listingId,
      { status },
      { new: true }
    );

    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }

    res.json({
      success: true,
      message: 'Status updated',
      data: { listing }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update status'
    });
  }
};

// Delete listing
const deleteListing = async (req, res) => {
  try {
    if (!Listing) initializeHostModels();

    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }

    // Delete images
    for (const imgId of listing.images) {
      try {
        await gfsBucket.delete(new mongoose.Types.ObjectId(imgId));
      } catch (err) {
        console.warn(`Failed to delete image ${imgId}`);
      }
    }

    await Listing.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Listing deleted'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete listing'
    });
  }
};

module.exports = {
  createListing,
  updateListing,
  getListingById,
  getImage,
  getListings,
  updateListingStatus,
  deleteListing,
  initializeHostModels
};