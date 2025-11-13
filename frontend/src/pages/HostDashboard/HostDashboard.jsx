import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
// Chart.js imports - uncomment after installing: npm install chart.js react-chartjs-2
// import { Bar } from 'react-chartjs-2';
// import {
//   Chart as ChartJS,
//   CategoryScale,
//   LinearScale,
//   BarElement,
//   Title,
//   Tooltip,
//   Legend
// } from 'chart.js';

// ChartJS.register(
//   CategoryScale,
//   LinearScale,
//   BarElement,
//   Title,
//   Tooltip,
//   Legend
// );
import './HostDashboard.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUser,
  faHome,
  faCalendar,
  faDollarSign,
  faSignOutAlt,
  faEdit,
  faTrash,
  faImages,
  faStar,
  faAlignLeft,
  faRupeeSign,
  faPercentage,
  faComments,
  faMapMarkerAlt,
  faUsers,
  faBed,
  faUtensils,
  faCalendarCheck
} from '@fortawesome/free-solid-svg-icons';

// ChartJS.register(
//   CategoryScale,
//   LinearScale,
//   BarElement,
//   Title,
//   Tooltip,
//   Legend
// );

const HostDashboard = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [activeSection, setActiveSection] = useState('overview');
  const [listings, setListings] = useState([]);
  const [filteredListings, setFilteredListings] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [bookingsData, setBookingsData] = useState(null);
  const [earningsData, setEarningsData] = useState(null);
  const [alert, setAlert] = useState(null);

  const API_BASE_URL = 'http://localhost:3001';

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('currentUser') || 'null');
    if (!user) {
      alert('Please login to view the dashboard.');
      navigate('/loginweb');
      return;
    }
    setCurrentUser(user);
    fetchListings(user.email);
  }, [navigate]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = listings.filter(listing =>
        listing.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        listing.location?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredListings(filtered);
    } else {
      setFilteredListings(listings);
    }
  }, [searchTerm, listings]);

  const fetchListings = async (email) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/listings`);
      if (response.data.success) {
        const hostListings = response.data.data.listings.filter(
          listing => listing.email === email
        );
        setListings(hostListings);
        setFilteredListings(hostListings);
      }
    } catch (error) {
      console.error('Failed to fetch listings:', error);
      showAlert('Failed to load listings. Please try again later.', 'error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    sessionStorage.removeItem('currentUser');
    navigate('/loginweb');
  };

  const handleDelete = async (listingId) => {
    if (!window.confirm('Are you sure you want to delete this listing?')) {
      return;
    }

    try {
      const response = await axios.delete(`${API_BASE_URL}/api/listings/${listingId}`);
      if (response.data.success) {
        showAlert('Listing deleted successfully!', 'success');
        setListings(listings.filter(l => l._id !== listingId));
        setFilteredListings(filteredListings.filter(l => l._id !== listingId));
      } else {
        showAlert(response.data.message || 'Failed to delete listing.', 'error');
      }
    } catch (error) {
      showAlert('Failed to delete listing.', 'error');
    }
  };

  const handleUpdate = (listingId) => {
    navigate(`/host_index?listingId=${listingId}`);
  };

  const fetchBookings = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/bookings/host/${currentUser.email}`);
      if (response.data.success) {
        const bookings = response.data.data.bookings;
        const monthlyBookings = processMonthlyBookings(bookings);
        setBookingsData(monthlyBookings);
      } else {
        showAlert('Failed to load bookings.', 'error');
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
      showAlert('Failed to load bookings.', 'error');
    }
  };

  const fetchEarnings = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/bookings/host/${currentUser.email}`);
      if (response.data.success) {
        const bookings = response.data.data.bookings;
        const monthlyEarnings = processMonthlyEarnings(bookings);
        setEarningsData(monthlyEarnings);
      } else {
        showAlert('Failed to load earnings.', 'error');
      }
    } catch (error) {
      console.error('Error fetching earnings:', error);
      showAlert('Failed to load earnings.', 'error');
    }
  };

  const processMonthlyBookings = (bookings) => {
    const monthlyCounts = {};
    bookings.forEach(booking => {
      const date = new Date(booking.checkIn);
      const monthYear = `${date.getFullYear()}-${date.getMonth() + 1}`;
      monthlyCounts[monthYear] = (monthlyCounts[monthYear] || 0) + 1;
    });
    return monthlyCounts;
  };

  const processMonthlyEarnings = (bookings) => {
    const monthlyEarnings = {};
    bookings.forEach(booking => {
      const date = new Date(booking.checkIn);
      const monthYear = `${date.getFullYear()}-${date.getMonth() + 1}`;
      monthlyEarnings[monthYear] = (monthlyEarnings[monthYear] || 0) + (booking.amount || 0);
    });
    return monthlyEarnings;
  };

  const generateSuggestions = (listing) => {
    const suggestions = [];

    if (!listing.images || listing.images.length === 0) {
      suggestions.push({
        type: 'images',
        priority: 'high',
        icon: faImages,
        title: 'Add Images',
        message: 'No images found. Add at least 5 high-quality photos to increase bookings by 40%.',
      });
    } else if (listing.images.length < 3) {
      suggestions.push({
        type: 'images',
        priority: 'high',
        icon: faImages,
        title: 'More Images Needed',
        message: `Only ${listing.images.length} image(s) uploaded. Add more photos to showcase your space better.`,
      });
    }

    const amenities = listing.amenities || [];
    if (amenities.length === 0) {
      suggestions.push({
        type: 'amenities',
        priority: 'high',
        icon: faStar,
        title: 'Add Amenities',
        message: 'No amenities listed. Essential amenities can increase bookings significantly.',
      });
    }

    const description = listing.description || '';
    if (!description || description.length < 50) {
      suggestions.push({
        type: 'description',
        priority: 'high',
        icon: faAlignLeft,
        title: 'Improve Description',
        message: 'Description is too short or missing. Detailed descriptions increase booking rates.',
      });
    }

    if (!listing.availability || listing.availability.length === 0) {
      suggestions.push({
        type: 'availability',
        priority: 'high',
        icon: faCalendarCheck,
        title: 'Set Availability',
        message: 'No availability dates set. Set your room availability dates to accept bookings.',
      });
    }

    const price = parseFloat(listing.price) || 0;
    if (price === 0) {
      suggestions.push({
        type: 'pricing',
        priority: 'high',
        icon: faRupeeSign,
        title: 'Set Competitive Price',
        message: 'No price set. Research similar listings in your area to set an attractive rate.',
      });
    }

    return suggestions.sort((a, b) => {
      const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const formatAvailability = (availability) => {
    if (!availability || availability.length === 0) return 'Not set';
    const dates = availability.map(date => {
      const d = new Date(date);
      return d.toLocaleDateString();
    });
    return dates.slice(0, 5).join(', ') + (dates.length > 5 ? ` (+${dates.length - 5} more)` : '');
  };

  const showAlert = (message, type) => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 3000);
  };

  const handleSectionChange = (section) => {
    setActiveSection(section);
    if (section === 'bookings' && !bookingsData) {
      fetchBookings();
    } else if (section === 'earnings' && !earningsData) {
      fetchEarnings();
    }
  };

  const renderBookingsChart = () => {
    if (!bookingsData || Object.keys(bookingsData).length === 0) {
      return <p>No bookings data available.</p>;
    }

    const labels = Object.keys(bookingsData).sort();
    const data = labels.map(label => bookingsData[label]);
    const formattedLabels = labels.map(label => {
      const [year, month] = label.split('-');
      return new Date(year, month - 1).toLocaleString('default', { month: 'short', year: 'numeric' });
    });

    return (
      <>
        <ul className="monthly-list">
          {Object.entries(bookingsData).sort().map(([monthYear, count]) => {
            const [year, month] = monthYear.split('-');
            const date = new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
            return (
              <li key={monthYear}>
                {date}: {count} booking{count > 1 ? 's' : ''}
              </li>
            );
          })}
        </ul>
        <div className="chart-container">
          <p style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
            Chart visualization will appear here after installing Chart.js
            <br />
            <small>Run: npm install chart.js react-chartjs-2</small>
          </p>
          {/* Uncomment after installing Chart.js:
          <Bar
            data={{
              labels: formattedLabels,
              datasets: [{
                label: 'Bookings per Month',
                data: data,
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
              }]
            }}
            options={{
              scales: {
                y: {
                  beginAtZero: true,
                  title: { display: true, text: 'Number of Bookings' }
                },
                x: {
                  title: { display: true, text: 'Month' }
                }
              },
              plugins: { legend: { display: true } }
            }}
          />
          */}
        </div>
      </>
    );
  };

  const renderEarningsChart = () => {
    if (!earningsData || Object.keys(earningsData).length === 0) {
      return <p>No earnings data available.</p>;
    }

    const labels = Object.keys(earningsData).sort();
    const data = labels.map(label => earningsData[label]);
    const formattedLabels = labels.map(label => {
      const [year, month] = label.split('-');
      return new Date(year, month - 1).toLocaleString('default', { month: 'short', year: 'numeric' });
    });

    return (
      <>
        <ul className="monthly-list">
          {Object.entries(earningsData).sort().map(([monthYear, amount]) => {
            const [year, month] = monthYear.split('-');
            const date = new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
            return (
              <li key={monthYear}>
                {date}: ₹{amount.toFixed(2)}
              </li>
            );
          })}
        </ul>
        <div className="chart-container">
          <p style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
            Chart visualization will appear here after installing Chart.js
            <br />
            <small>Run: npm install chart.js react-chartjs-2</small>
          </p>
          {/* Uncomment after installing Chart.js:
          <Bar
            data={{
              labels: formattedLabels,
              datasets: [{
                label: 'Earnings per Month',
                data: data,
                backgroundColor: 'rgba(75, 192, 192, 0.6)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
              }]
            }}
            options={{
              scales: {
                y: {
                  beginAtZero: true,
                  title: { display: true, text: 'Earnings (₹)' }
                },
                x: {
                  title: { display: true, text: 'Month' }
                }
              },
              plugins: { legend: { display: true } }
            }}
          />
          */}
        </div>
      </>
    );
  };

  if (!currentUser) {
    return <div>Loading...</div>;
  }

  return (
    <div className="dashboard">
      {alert && (
        <div className={`alert alert-${alert.type}`}>
          {alert.message}
        </div>
      )}

      {/* Sidebar */}
      <div className="sidebar">
        <div className="logo">
          <h1>ShelterSeek</h1>
          <p>Host Dashboard</p>
        </div>
        <nav className="nav-links">
          <button
            className="nav-link"
            onClick={() => navigate('/profile')}
          >
            <FontAwesomeIcon icon={faUser} /> Profile
          </button>
          <button
            className={`nav-link ${activeSection === 'overview' ? 'active' : ''}`}
            onClick={() => handleSectionChange('overview')}
          >
            <FontAwesomeIcon icon={faHome} /> Overview
          </button>
          <button
            className={`nav-link ${activeSection === 'bookings' ? 'active' : ''}`}
            onClick={() => handleSectionChange('bookings')}
          >
            <FontAwesomeIcon icon={faCalendar} /> Bookings
          </button>
          <button
            className={`nav-link ${activeSection === 'earnings' ? 'active' : ''}`}
            onClick={() => handleSectionChange('earnings')}
          >
            <FontAwesomeIcon icon={faDollarSign} /> Earnings
          </button>
          <button className="nav-link logout" onClick={handleLogout}>
            <FontAwesomeIcon icon={faSignOutAlt} /> Logout
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <div className="main-content">
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
          {activeSection === 'overview' ? 'Overview' : 
           activeSection === 'bookings' ? 'Bookings' : 'Earnings'}
        </h2>

        {/* Overview Section */}
        {activeSection === 'overview' && (
          <div className="listings-section">
            <h3>Your Listings</h3>
            <div className="search-container">
              <input
                type="text"
                placeholder="Search by title or location..."
                className="host-search-bar"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="listings-container">
              {filteredListings.length === 0 ? (
                <p>No listings found. Create your first listing!</p>
              ) : (
                filteredListings.map(listing => {
                  const suggestions = generateSuggestions(listing);
                  return (
                    <div key={listing._id} className="listing-card">
                      <div className="listing-header">
                        <h4>{listing.title}</h4>
                        <div className={`listing-status ${listing.status}`}>
                          {listing.status}
                        </div>
                      </div>

                      <div className="listing-details">
                        <p><strong>Description:</strong> {listing.description}</p>
                        <p><strong>Price:</strong> ₹{listing.price}</p>
                        <p><strong>Location:</strong> {listing.location}</p>
                        <p><strong>Coordinates:</strong> ({listing.coordinates?.lat || ''}, {listing.coordinates?.lng || ''})</p>
                        <p><strong>Max Days Allowed:</strong> {listing.maxdays}</p>
                        <p><strong>Property Type:</strong> {listing.propertyType}</p>
                        <p><strong>Capacity:</strong> {listing.capacity}</p>
                        <p><strong>Room Type:</strong> {listing.roomType}</p>
                        <p><strong>Bedrooms:</strong> {listing.bedrooms}</p>
                        <p><strong>Beds:</strong> {listing.beds}</p>
                        <p><strong>Room Size:</strong> {listing.roomSize}</p>
                        <p><strong>Room Location:</strong> {listing.roomLocation || 'Not specified'}</p>
                        <p><strong>Transport Distance:</strong> {listing.transportDistance || 'Not specified'}</p>
                        <p><strong>Host Gender:</strong> {listing.hostGender || 'Not specified'}</p>
                        <p><strong>Food Facility:</strong> {listing.foodFacility || 'Not specified'}</p>
                        <p><strong>Amenities:</strong> {listing.amenities?.join(', ') || 'None'}</p>
                        <p><strong>Discount:</strong> {listing.discount || 0}%</p>
                        <p><strong>Likes:</strong> {listing.likes || 0}</p>
                        <p><strong>Status:</strong> {listing.status}</p>
                        <p><strong>Booking Available:</strong> {listing.booking ? 'Yes' : 'No'}</p>
                        <p><strong>Reviews:</strong> {listing.reviews?.join(', ') || 'None'}</p>
                        <p><strong>Availability:</strong> {formatAvailability(listing.availability)}</p>
                        <p><strong>Created At:</strong> {formatDate(listing.createdAt)}</p>
                      </div>

                      {suggestions.length > 0 ? (
                        <div className="suggestions-simple">
                          <strong>Suggestions:</strong>
                          <ul>
                            {suggestions.map((suggestion, idx) => (
                              <li key={idx}>
                                <FontAwesomeIcon icon={suggestion.icon} /> {suggestion.message}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <div className="suggestions-simple success">
                          <strong>Suggestions:</strong> Your listing looks great!
                        </div>
                      )}

                      {listing.images && listing.images.length > 0 && (
                        <div className="images-container">
                          <strong>Images:</strong>
                          <div className="image-gallery">
                            {listing.images.map((imgId, idx) => (
                              <img
                                key={idx}
                                src={`${API_BASE_URL}/api/images/${imgId}`}
                                alt="Listing Image"
                                className="listing-image"
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="listing-actions">
                        <button
                          className="update-listing-btn"
                          onClick={() => handleUpdate(listing._id)}
                        >
                          <FontAwesomeIcon icon={faEdit} /> Update
                        </button>
                        <button
                          className="delete-listing-btn"
                          onClick={() => handleDelete(listing._id)}
                        >
                          <FontAwesomeIcon icon={faTrash} /> Delete
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Bookings Section */}
        {activeSection === 'bookings' && (
          <div className="bookings-section">
            <h3>Bookings per Month</h3>
            {renderBookingsChart()}
          </div>
        )}

        {/* Earnings Section */}
        {activeSection === 'earnings' && (
          <div className="earnings-section">
            <h3>Earnings per Month</h3>
            {renderEarningsChart()}
          </div>
        )}
      </div>
    </div>
  );
};

export default HostDashboard;

