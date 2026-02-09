const mongoose = require('mongoose');
const { Host, Traveler } = require('../model/usermodel');
const Booking = require('../model/Booking');
const RoomData = require('../model/Room');
const { logControllerError, logDatabaseError } = require('../utils/errorLogger');

// View notifications for admin
exports.getNotifications = async (req, res) => {
  try {
    const activeTab = req.query.tab || 'host';
    const dbRole = activeTab === 'host' ? 'host' : 'traveller';
    const searchQuery = req.query.search;

    const model = dbRole === 'host' ? Host : Traveler;
    const query = { accountType: dbRole };

    if (searchQuery) {
      const regex = new RegExp(searchQuery, 'i');
      query.$or = [{ name: { $regex: regex } }, { email: { $regex: regex } }];
    }

    let users;
    try {
      users = await model.find(query).sort({ createdAt: -1 });
    } catch (dbError) {
      logDatabaseError(dbError, {
        operation: 'find',
        collection: dbRole === 'host' ? 'Host' : 'Traveler',
        query: JSON.stringify(query)
      });
      throw dbError;
    }

    res.render('admin_notifications', {
      activeTab,
      users: users.map(u => ({
        _id: u._id,
        name: u.name,
        email: u.email,
        accountType: u.accountType,
        createdAt: u.createdAt
      }))
    });
  } catch (error) {
    logControllerError(error, {
      file: 'adminController.js',
      function: 'getNotifications',
      userId: req.user?._id,
      userEmail: req.user?.email,
      activeTab: req.query.tab,
      searchQuery: req.query.search
    });
    
    res.render('admin_notifications', {
      activeTab: 'host',
      users: [],
      error: 'Database query failed'
    });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    const id = req.params.id;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = new Error('Invalid user ID');
      logControllerError(error, {
        file: 'adminController.js',
        function: 'deleteUser',
        userId: req.user?._id,
        userEmail: req.user?.email,
        targetId: id
      });
      return res.status(400).json({ 
        success: false, 
        message: error.message 
      });
    }

    // Try both models
    let user;
    try {
      user = await Host.findByIdAndDelete(id);
    } catch (dbError) {
      logDatabaseError(dbError, {
        operation: 'findByIdAndDelete',
        collection: 'Host',
        targetId: id
      });
    }
    
    if (!user) {
      try {
        user = await Traveler.findByIdAndDelete(id);
      } catch (dbError) {
        logDatabaseError(dbError, {
          operation: 'findByIdAndDelete',
          collection: 'Traveler',
          targetId: id
        });
      }
    }

    if (!user) {
      const error = new Error('User not found');
      logControllerError(error, {
        file: 'adminController.js',
        function: 'deleteUser',
        userId: req.user?._id,
        userEmail: req.user?.email,
        targetId: id
      });
      return res.status(404).json({ 
        success: false, 
        message: error.message 
      });
    }

    res.json({ 
      success: true, 
      message: 'User deleted successfully' 
    });
  } catch (error) {
    logControllerError(error, {
      file: 'adminController.js',
      function: 'deleteUser',
      userId: req.user?._id,
      userEmail: req.user?.email,
      targetId: req.params.id
    });
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete user' 
    });
  }
};

// View host details
exports.viewHostDetails = async (req, res) => {
  try {
    const hostId = req.params.id;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(hostId)) {
      const error = new Error('Invalid host ID');
      logControllerError(error, {
        file: 'adminController.js',
        function: 'viewHostDetails',
        userId: req.user?._id,
        userEmail: req.user?.email,
        hostId
      });
      return res.status(400).send('Invalid host ID');
    }

    let host;
    try {
      host = await Host.findById(hostId);
    } catch (dbError) {
      logDatabaseError(dbError, {
        operation: 'findById',
        collection: 'Host',
        hostId
      });
      throw dbError;
    }

    if (!host) {
      const error = new Error('Host not found');
      logControllerError(error, {
        file: 'adminController.js',
        function: 'viewHostDetails',
        userId: req.user?._id,
        userEmail: req.user?.email,
        hostId
      });
      return res.status(404).send('Host not found');
    }

    let rooms;
    try {
      rooms = await RoomData.find({ email: host.email }).lean();
    } catch (dbError) {
      logDatabaseError(dbError, {
        operation: 'find',
        collection: 'RoomData',
        hostEmail: host.email
      });
      throw dbError;
    }

    const processedRooms = rooms.map(room => {
      const imageUrls = (room.images || []).map(imageId =>
        `/api/images/${imageId}`
      );

      return {
        ...room,
        imageUrls,
        missingImageCount: (room.images || []).length - imageUrls.length,
        missingImageIds: []
      };
    });

    res.render('host_details', {
      user: host,
      rooms: processedRooms
    });
  } catch (error) {
    logControllerError(error, {
      file: 'adminController.js',
      function: 'viewHostDetails',
      userId: req.user?._id,
      userEmail: req.user?.email,
      hostId: req.params.id
    });
    
    res.status(500).send('Internal Server Error');
  }
};

// View traveler details and bookings
exports.viewTravelerDetails = async (req, res) => {
  try {
    const travelerId = req.params.id;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(travelerId)) {
      const error = new Error('Invalid traveler ID');
      logControllerError(error, {
        file: 'adminController.js',
        function: 'viewTravelerDetails',
        userId: req.user?._id,
        userEmail: req.user?.email,
        travelerId
      });
      return res.status(400).send('Invalid traveler ID');
    }

    let traveler;
    try {
      traveler = await Traveler.findById(travelerId).lean();
    } catch (dbError) {
      logDatabaseError(dbError, {
        operation: 'findById',
        collection: 'Traveler',
        travelerId
      });
      throw dbError;
    }
    
    if (!traveler) {
      const error = new Error('Traveler not found');
      logControllerError(error, {
        file: 'adminController.js',
        function: 'viewTravelerDetails',
        userId: req.user?._id,
        userEmail: req.user?.email,
        travelerId
      });
      return res.status(404).send('Traveler not found');
    }

    // Connect to payment DB and get bookings
    let bookings = [];
    let paymentConnection;
    
    try {
      paymentConnection = mongoose.createConnection(process.env.PAYMENT_DB_URI);
      const bookingSchema = new mongoose.Schema({}, { strict: false });
      const BookingModel = paymentConnection.model('Booking', bookingSchema, 'bookings');
      bookings = await BookingModel.find({ userEmail: traveler.email }).lean();
    } catch (dbError) {
      logDatabaseError(dbError, {
        operation: 'find bookings',
        collection: 'bookings',
        travelerEmail: traveler.email
      });
      // Continue with empty bookings rather than failing completely
    } finally {
      if (paymentConnection) {
        try {
          await paymentConnection.close();
        } catch (closeError) {
          logControllerError(closeError, {
            file: 'adminController.js',
            function: 'viewTravelerDetails - close connection',
            travelerEmail: traveler.email
          });
        }
      }
    }

    res.render('traveler_details', { traveler, bookings });
  } catch (err) {
    logControllerError(err, {
      file: 'adminController.js',
      function: 'viewTravelerDetails',
      userId: req.user?._id,
      userEmail: req.user?.email,
      travelerId: req.params.id
    });
    
    res.status(500).send('Server error');
  }
};