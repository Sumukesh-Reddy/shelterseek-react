const mongoose = require('mongoose');
const { Host, Traveler } = require('../model/usermodel'); // ✅ Correct import
const Booking = require('../model/Booking'); // if viewing traveler bookings
const RoomData = require('../model/Room');

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

    const users = await model.find(query).sort({ createdAt: -1 });

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
    console.error('Full error:', error);
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

    // Try both models
    let user = await Host.findByIdAndDelete(id);
    if (!user) {
      user = await Traveler.findByIdAndDelete(id);
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
};

// View host details
exports.viewHostDetails = async (req, res) => {
  try {
    const hostId = req.params.id;
    const host = await Host.findById(hostId);

    if (!host) {
      return res.status(404).send('Host not found');
    }

    const rooms = await RoomData.find({ email: host.email }).lean();

    const processedRooms = rooms.map(room => {
      const imageUrls = (room.images || []).map(imageId =>
        `/api/images/${imageId}`
      );

      return {
        ...room,
        imageUrls,
        missingImageCount: (room.images || []).length - imageUrls.length,
        missingImageIds: [] // You could add real checks if needed
      };
    });

    res.render('host_details', {
      user: host,
      rooms: processedRooms
    });
  } catch (error) {
    console.error('Error fetching host details:', error);
    res.status(500).send('Internal Server Error');
  }
};


// View traveler details and bookings
exports.viewTravelerDetails = async (req, res) => {
  try {
    const travelerId = req.params.id;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(travelerId)) {
      return res.status(400).send('Invalid traveler ID');
    }

    const traveler = await Traveler.findById(travelerId).lean();
    if (!traveler) {
      return res.status(404).send('Traveler not found');
    }

    // Connect to payment DB and get bookings
    const paymentConnection = mongoose.createConnection(process.env.PAYMENT_DB_URI);
    const bookingSchema = new mongoose.Schema({}, { strict: false });
    const Booking = paymentConnection.model('Booking', bookingSchema, 'bookings');

    const bookings = await Booking.find({ userEmail: traveler.email }).lean();
    paymentConnection.close();

    res.render('traveler_details', { traveler, bookings });
  } catch (err) {
    console.error('Error fetching traveler details:', err);
    res.status(500).send('Server error');
  }
};
