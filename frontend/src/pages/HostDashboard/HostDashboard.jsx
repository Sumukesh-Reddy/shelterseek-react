import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
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
  faCalendarCheck
} from '@fortawesome/free-solid-svg-icons';

// All styles converted from HostDashboard.css → inline objects
const styles = {
  dashboard: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: '#f3f4f6',
    color: '#1f2937',
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },

  sidebar: {
    width: '250px',
    backgroundColor: 'white',
    boxShadow: '2px 0 8px rgba(0, 0, 0, 0.1)',
    padding: '1.5rem',
    position: 'fixed',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },

  logo: {
    marginBottom: '2rem',
  },

  logoTitle: {
    fontSize: '1.5rem',
    color: '#1f2937',
  },

  logoSubtitle: {
    fontSize: '0.875rem',
    color: '#d72d6e',
  },

  navLinks: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },

  navLink: {
    display: 'flex',
    alignItems: 'center',
    padding: '0.75rem 1rem',
    borderRadius: '0.375rem',
    color: '#4b5563',
    textDecoration: 'none',
    transition: 'all 0.2s',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    fontSize: '1rem',
  },

  navLinkActive: {
    backgroundColor: '#eff6ff',
    color: '#d72d6e',
  },

  navLinkIcon: {
    marginRight: '0.75rem',
    fontSize: '1.25rem',
  },

  mainContent: {
    flex: 1,
    marginLeft: '250px',
    padding: '2rem',
  },

  searchContainer: {
    marginBottom: '1.5rem',
  },

  searchBar: {
    width: '100%',
    maxWidth: '400px',
    padding: '0.75rem',
    border: '1px solid #e5e7eb',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    color: '#1f2937',
    outline: 'none',
  },

  listingsSection: {
    marginBottom: '2rem',
  },

  listingsContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '1.5rem',
  },

  listingCard: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '0.5rem',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },

  listingCardTitle: {
    fontSize: '1.25rem',
    marginBottom: '0.5rem',
  },

  listingCardText: {
    fontSize: '0.875rem',
    color: '#6b7280',
    marginBottom: '0.5rem',
  },

  listingHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
    paddingBottom: '0.5rem',
    borderBottom: '1px solid #e5e7eb',
  },

  listingStatusBase: {
    padding: '0.25rem 0.5rem',
    borderRadius: '0.25rem',
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'uppercase',
  },

  listingStatusActive: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },

  listingStatusInactive: {
    backgroundColor: '#fef2f2',
    color: '#991b1b',
  },

  listingStatusPending: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
  },

  listingStatusVerified: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },

  listingStatusRejected: {
    backgroundColor: '#fef2f2',
    color: '#991b1b',
  },

  listingDetails: {
    marginTop: '1rem',
    fontSize: '0.875rem',
    color: '#1f2937',
  },

  imagesContainer: {
    marginTop: '1rem',
  },

  imageGallery: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    marginTop: '0.5rem',
  },

  listingImage: {
    width: '120px',
    height: '120px',
    objectFit: 'cover',
    borderRadius: '0.375rem',
    border: '1px solid #e5e7eb',
    transition: 'transform 0.2s',
  },

  listingActions: {
    display: 'flex',
    gap: '0.5rem',
    marginTop: '1rem',
  },

  updateListingBtn: {
    padding: '0.5rem 1rem',
    border: 'none',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: '#d72d6e',
    color: 'white',
  },

  deleteListingBtn: {
    padding: '0.5rem 1rem',
    border: 'none',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: '#991b1b',
    color: 'white',
  },

  bookingsSection: {
    marginTop: '2rem',
    backgroundColor: 'white',
    borderRadius: '0.5rem',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    padding: '1.5rem',
  },

  earningsSection: {
    marginTop: '2rem',
    backgroundColor: 'white',
    borderRadius: '0.5rem',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    padding: '1.5rem',
  },

  sectionTitle: {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: '#1f2937',
    marginBottom: '1.5rem',
  },

  monthlyList: {
    listStyle: 'none',
    padding: 0,
    marginBottom: '2rem',
  },

  monthlyListItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0.75rem 1rem',
    borderBottom: '1px solid #e5e7eb',
    color: '#1f2937',
  },

  chartContainer: {
    marginTop: '2rem',
    maxWidth: '800px',
  },

  alertBase: {
    position: 'fixed',
    top: '2rem',
    right: '2rem',
    padding: '1rem 1.5rem',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    zIndex: 1000,
  },

  alertSuccess: {
    backgroundColor: '#d1fae5',
    color: '#065f46',
    border: '1px solid #86efac',
  },

  alertError: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    border: '1px solid #fca5a5',
  },

  suggestionsSimple: {
    margin: '1rem 0',
    padding: '0.75rem',
    backgroundColor: '#f8fafc',
    borderRadius: '0.375rem',
    borderLeft: '3px solid #d72d6e',
    fontSize: '0.875rem',
  },

  suggestionsSimpleSuccess: {
    margin: '1rem 0',
    padding: '0.75rem',
    backgroundColor: '#f0fdf4',
    borderRadius: '0.375rem',
    borderLeft: '3px solid #16a34a',
    fontSize: '0.875rem',
    color: '#16a34a',
  },

  suggestionsStrong: {
    color: '#d72d6e',
    fontWeight: 600,
  },

  suggestionsStrongSuccess: {
    color: '#16a34a',
    fontWeight: 600,
  },

  suggestionsList: {
    margin: '0.5rem 0 0 0',
    paddingLeft: '1.25rem',
  },

  suggestionsListItem: {
    marginBottom: '0.25rem',
    color: '#6b7280',
    lineHeight: 1.4,
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },

  chartPlaceholder: {
    padding: '2rem',
    textAlign: 'center',
    color: '#666',
  },
};

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
    const user = JSON.parse(
      localStorage.getItem('user') ||
        sessionStorage.getItem('currentUser') ||
        'null'
    );
    if (!user) {
      window.alert('Please login to view the dashboard.');
      navigate('/loginweb');
      return;
    }
    setCurrentUser(user);
    fetchListings(user.email);
  }, [navigate]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = listings.filter(
        (listing) =>
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
          (listing) => listing.email === email
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
      const response = await axios.delete(
        `${API_BASE_URL}/api/listings/${listingId}`
      );
      if (response.data.success) {
        showAlert('Listing deleted successfully!', 'success');
        setListings(listings.filter((l) => l._id !== listingId));
        setFilteredListings(
          filteredListings.filter((l) => l._id !== listingId)
        );
      } else {
        showAlert(
          response.data.message || 'Failed to delete listing.',
          'error'
        );
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
      const response = await axios.get(
        `${API_BASE_URL}/api/bookings/host/${currentUser.email}`
      );
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
      const response = await axios.get(
        `${API_BASE_URL}/api/bookings/host/${currentUser.email}`
      );
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
    bookings.forEach((booking) => {
      const date = new Date(booking.checkIn);
      const monthYear = `${date.getFullYear()}-${date.getMonth() + 1}`;
      monthlyCounts[monthYear] = (monthlyCounts[monthYear] || 0) + 1;
    });
    return monthlyCounts;
  };

  const processMonthlyEarnings = (bookings) => {
    const monthlyEarnings = {};
    bookings.forEach((booking) => {
      const date = new Date(booking.checkIn);
      const monthYear = `${date.getFullYear()}-${date.getMonth() + 1}`;
      monthlyEarnings[monthYear] =
        (monthlyEarnings[monthYear] || 0) + (booking.amount || 0);
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
        message:
          'No images found. Add at least 5 high-quality photos to increase bookings by 40%.',
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
        message:
          'No amenities listed. Essential amenities can increase bookings significantly.',
      });
    }

    const description = listing.description || '';
    if (!description || description.length < 50) {
      suggestions.push({
        type: 'description',
        priority: 'high',
        icon: faAlignLeft,
        title: 'Improve Description',
        message:
          'Description is too short or missing. Detailed descriptions increase booking rates.',
      });
    }

    if (!listing.unavailableDates || listing.unavailableDates.length === 0) {
      suggestions.push({
        type: 'unavailableDates',
        priority: 'high',
        icon: faCalendarCheck,
        title: 'Set unavailableDates',
        message:
          'No unavailableDates dates set. Set your room unavailableDates dates to accept bookings.',
      });
    }

    const price = parseFloat(listing.price) || 0;
    if (price === 0) {
      suggestions.push({
        type: 'pricing',
        priority: 'high',
        icon: faRupeeSign,
        title: 'Set Competitive Price',
        message:
          'No price set. Research similar listings in your area to set an attractive rate.',
      });
    }

    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString();
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

    return (
      <>
        <ul style={styles.monthlyList}>
          {Object.entries(bookingsData)
            .sort()
            .map(([monthYear, count]) => {
              const [year, month] = monthYear.split('-');
              const date = new Date(year, month - 1).toLocaleString('default', {
                month: 'long',
                year: 'numeric',
              });
              return (
                <li key={monthYear} style={styles.monthlyListItem}>
                  {date}: {count} booking{count > 1 ? 's' : ''}
                </li>
              );
            })}
        </ul>
        <div style={styles.chartContainer}>
          <p style={styles.chartPlaceholder}>
            Chart visualization will appear here after installing Chart.js
            <br />
            <small>Run: npm install chart.js react-chartjs-2</small>
          </p>
        </div>
      </>
    );
  };

  const renderEarningsChart = () => {
    if (!earningsData || Object.keys(earningsData).length === 0) {
      return <p>No earnings data available.</p>;
    }

    return (
      <>
        <ul style={styles.monthlyList}>
          {Object.entries(earningsData)
            .sort()
            .map(([monthYear, amount]) => {
              const [year, month] = monthYear.split('-');
              const date = new Date(year, month - 1).toLocaleString('default', {
                month: 'long',
                year: 'numeric',
              });
              return (
                <li key={monthYear} style={styles.monthlyListItem}>
                  {date}: ₹{amount.toFixed(2)}
                </li>
              );
            })}
        </ul>
        <div style={styles.chartContainer}>
          <p style={styles.chartPlaceholder}>
            Chart visualization will appear here after installing Chart.js
            <br />
            <small>Run: npm install chart.js react-chartjs-2</small>
          </p>
        </div>
      </>
    );
  };

  if (!currentUser) {
    return <div>Loading...</div>;
  }

  // Choose alert style
  const alertStyle =
    alert && alert.type === 'success'
      ? { ...styles.alertBase, ...styles.alertSuccess }
      : alert && alert.type === 'error'
      ? { ...styles.alertBase, ...styles.alertError }
      : null;

  return (
    <div style={styles.dashboard}>
      {alert && <div style={alertStyle}>{alert.message}</div>}

      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.logo}>
          <h1 style={styles.logoTitle}>ShelterSeek</h1>
          <p style={styles.logoSubtitle}>Host Dashboard</p>
        </div>
        <nav style={styles.navLinks}>
          <button
            type="button"
            onClick={() => navigate('/profile')}
            style={styles.navLink}
          >
            <FontAwesomeIcon icon={faUser} style={styles.navLinkIcon} />
            Profile
          </button>
          <button
            type="button"
            onClick={() => handleSectionChange('overview')}
            style={{
              ...styles.navLink,
              ...(activeSection === 'overview' ? styles.navLinkActive : {}),
            }}
          >
            <FontAwesomeIcon icon={faHome} style={styles.navLinkIcon} />
            Overview
          </button>
          <button
            type="button"
            onClick={() => handleSectionChange('bookings')}
            style={{
              ...styles.navLink,
              ...(activeSection === 'bookings' ? styles.navLinkActive : {}),
            }}
          >
            <FontAwesomeIcon icon={faCalendar} style={styles.navLinkIcon} />
            Bookings
          </button>
          <button
            type="button"
            onClick={() => handleSectionChange('earnings')}
            style={{
              ...styles.navLink,
              ...(activeSection === 'earnings' ? styles.navLinkActive : {}),
            }}
          >
            <FontAwesomeIcon icon={faDollarSign} style={styles.navLinkIcon} />
            Earnings
          </button>
          <button
            type="button"
            onClick={handleLogout}
            style={styles.navLink}
          >
            <FontAwesomeIcon icon={faSignOutAlt} style={styles.navLinkIcon} />
            Logout
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <div style={styles.mainContent}>
        <h2
          style={{
            fontSize: '1.5rem',
            fontWeight: 'bold',
            marginBottom: '1.5rem',
          }}
        >
          {activeSection === 'overview'
            ? 'Overview'
            : activeSection === 'bookings'
            ? 'Bookings'
            : 'Earnings'}
        </h2>

        {/* Overview Section */}
        {activeSection === 'overview' && (
          <div style={styles.listingsSection}>
            <h3 style={styles.sectionTitle}>Your Listings</h3>
            <div style={styles.searchContainer}>
              <input
                type="text"
                placeholder="Search by title or location..."
                style={styles.searchBar}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div style={styles.listingsContainer}>
              {filteredListings.length === 0 ? (
                <p>No listings found. Create your first listing!</p>
              ) : (
                filteredListings.map((listing) => {
                  const suggestions = generateSuggestions(listing);

                  // Resolve listing status style
                  let statusStyle = { ...styles.listingStatusBase };
                  if (listing.status === 'active') {
                    statusStyle = {
                      ...styles.listingStatusBase,
                      ...styles.listingStatusActive,
                    };
                  } else if (listing.status === 'inactive') {
                    statusStyle = {
                      ...styles.listingStatusBase,
                      ...styles.listingStatusInactive,
                    };
                  } else if (listing.status === 'pending') {
                    statusStyle = {
                      ...styles.listingStatusBase,
                      ...styles.listingStatusPending,
                    };
                  } else if (listing.status === 'verified') {
                    statusStyle = {
                      ...styles.listingStatusBase,
                      ...styles.listingStatusVerified,
                    };
                  } else if (listing.status === 'rejected') {
                    statusStyle = {
                      ...styles.listingStatusBase,
                      ...styles.listingStatusRejected,
                    };
                  }

                  const suggestionsContainerStyle =
                    suggestions.length > 0
                      ? styles.suggestionsSimple
                      : styles.suggestionsSimpleSuccess;

                  const suggestionsStrongStyle =
                    suggestions.length > 0
                      ? styles.suggestionsStrong
                      : styles.suggestionsStrongSuccess;

                  return (
                    <div key={listing._id} style={styles.listingCard}>
                      <div style={styles.listingHeader}>
                        <h4 style={styles.listingCardTitle}>{listing.title}</h4>
                        <div style={statusStyle}>{listing.status}</div>
                      </div>

                      <div style={styles.listingDetails}>
                        <p>
                          <strong>Description:</strong> {listing.description}
                        </p>
                        <p>
                          <strong>Price:</strong> ₹{listing.price}
                        </p>
                        <p>
                          <strong>Location:</strong> {listing.location}
                        </p>
                        <p>
                          <strong>Coordinates:</strong> (
                          {listing.coordinates?.lat || ''},{' '}
                          {listing.coordinates?.lng || ''})
                        </p>
                        <p>
                          <strong>Max Days Allowed:</strong> {listing.maxdays}
                        </p>
                        <p>
                          <strong>Property Type:</strong>{' '}
                          {listing.propertyType}
                        </p>
                        <p>
                          <strong>Capacity:</strong> {listing.capacity}
                        </p>
                        <p>
                          <strong>Room Type:</strong> {listing.roomType}
                        </p>
                        <p>
                          <strong>Bedrooms:</strong> {listing.bedrooms}
                        </p>
                        <p>
                          <strong>Beds:</strong> {listing.beds}
                        </p>
                        <p>
                          <strong>Room Size:</strong> {listing.roomSize}
                        </p>
                        <p>
                          <strong>Room Location:</strong>{' '}
                          {listing.roomLocation || 'Not specified'}
                        </p>
                        <p>
                          <strong>Transport Distance:</strong>{' '}
                          {listing.transportDistance || 'Not specified'}
                        </p>
                        <p>
                          <strong>Host Gender:</strong>{' '}
                          {listing.hostGender || 'Not specified'}
                        </p>
                        <p>
                          <strong>Food Facility:</strong>{' '}
                          {listing.foodFacility || 'Not specified'}
                        </p>
                        <p>
                          <strong>Amenities:</strong>{' '}
                          {listing.amenities?.join(', ') || 'None'}
                        </p>
                        <p>
                          <strong>Discount:</strong> {listing.discount || 0}%
                        </p>
                        <p>
                          <strong>Likes:</strong> {listing.likes || 0}
                        </p>
                        <p>
                          <strong>Status:</strong> {listing.status}
                        </p>
                        <p>
                          <strong>Booking Available:</strong>{' '}
                          {listing.booking ? 'Yes' : 'No'}
                        </p>
                        <p>
                          <strong>Reviews:</strong>{' '}
                          {listing.reviews?.join(', ') || 'None'}
                        </p>
                        <p>
                          <strong>Unavailable Days:</strong>{' '}
                          {listing.unavailableDates &&
                          listing.unavailableDates.length > 0
                            ? listing.unavailableDates.join(', ')
                            : 'None'}
                        </p>
                        <p>
                          <strong>Created At:</strong>{' '}
                          {formatDate(listing.createdAt)}
                        </p>
                      </div>

                      <div style={suggestionsContainerStyle}>
                        <strong style={suggestionsStrongStyle}>
                          Suggestions:
                        </strong>
                        {suggestions.length > 0 ? (
                          <ul style={styles.suggestionsList}>
                            {suggestions.map((suggestion, idx) => (
                              <li key={idx} style={styles.suggestionsListItem}>
                                <FontAwesomeIcon icon={suggestion.icon} />
                                {suggestion.message}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p style={{ marginTop: '0.5rem' }}>
                            Your listing looks great!
                          </p>
                        )}
                      </div>

                      {listing.images && listing.images.length > 0 && (
                        <div style={styles.imagesContainer}>
                          <strong>Images:</strong>
                          <div style={styles.imageGallery}>
                            {listing.images.map((imgId, idx) => (
                              <img
                                key={idx}
                                src={`${API_BASE_URL}/api/images/${imgId}`}
                                alt="Listing"
                                style={styles.listingImage}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      <div style={styles.listingActions}>
                        <button
                          type="button"
                          style={styles.updateListingBtn}
                          onClick={() => handleUpdate(listing._id)}
                        >
                          <FontAwesomeIcon icon={faEdit} />
                          Update
                        </button>
                        <button
                          type="button"
                          style={styles.deleteListingBtn}
                          onClick={() => handleDelete(listing._id)}
                        >
                          <FontAwesomeIcon icon={faTrash} />
                          Delete
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
          <div style={styles.bookingsSection}>
            <h3 style={styles.sectionTitle}>Bookings per Month</h3>
            {renderBookingsChart()}
          </div>
        )}

        {/* Earnings Section */}
        {activeSection === 'earnings' && (
          <div style={styles.earningsSection}>
            <h3 style={styles.sectionTitle}>Earnings per Month</h3>
            {renderEarningsChart()}
          </div>
        )}
      </div>
    </div>
  );
};

export default HostDashboard;
