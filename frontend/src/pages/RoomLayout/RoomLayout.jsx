import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar/Navbar';
import 'leaflet/dist/leaflet.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faShareAlt, 
  faChevronLeft, 
  faChevronRight, 
  faStar, 
  faStarHalfAlt, 
  faStar as faStarOutline,
  faHeart,
  faExclamationCircle
} from '@fortawesome/free-solid-svg-icons';
import './RoomLayout.css';
import Footer from '../../components/Footer/Footer';
import RoomMap from '../../components/RoomMap/RoomMap';

const RoomLayout = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [likedHomes, setLikedHomes] = useState([]);
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [error, setError] = useState(null);

  const processRoomData = useCallback((roomData) => {
    const processImagePaths = (images) => {
      if (!Array.isArray(images)) return ['/images/photo1.jpg'];
      return images.map(img => {
        if (img.startsWith('http')) return img;
        if (img.startsWith('/')) return `http://localhost:3001${img}`;
        if (/^[0-9a-fA-F]{24}$/.test(img)) return `http://localhost:3001/api/images/${img}`;
        return '/images/photo1.jpg';
      });
    };

    const categorizeSize = (size) => {
      if (typeof size === 'string') {
        const lowerSize = size.toLowerCase();
        if (["small", "medium", "large"].includes(lowerSize)) {
          return lowerSize;
        }
      }
      return "medium";
    };

    // Process availability dates
    const processAvailability = (availability) => {
      if (!Array.isArray(availability)) return [];
      return availability.map(date => {
        if (date instanceof Date) return date;
        if (typeof date === 'string') return new Date(date);
        if (date && date.$date) return new Date(date.$date);
        return null;
      }).filter(date => date && !isNaN(date.getTime()));
    };
    
    return {
      id: roomData._id || roomData.id,
      title: roomData.title || "Untitled Property",
      location: roomData.location || "Location not specified",
      price: parseFloat(roomData.price) || 0,
      description: roomData.description || "",
      size: categorizeSize(roomData.roomSize),
      discountPercentage: roomData.discount || 0,
      food: roomData.foodFacility || "not-available",
      transport: roomData.transportDistance || "",
      locationType: roomData.roomLocation || "",
      host: {
        gen: roomData.hostGender || "",
        email: roomData.email || "",
        food: roomData.foodFacility || "",
        name: roomData.name || "Unknown Host",
        image: roomData.hostImage || "/images/logo.png",
        yearsWithUs: roomData.yearsWithUs || 0,
        latitude: roomData.coordinates?.lat || 0,
        longitude: roomData.coordinates?.lng || 0
      },
      maxdays: roomData.maxdays || roomData.maxDays || 10,
      availability: processAvailability(roomData.availability),
      media: processImagePaths(roomData.images),
      review_main: roomData.reviews || [],
      amenities: {
        wifi: roomData.amenities?.includes("WiFi") || roomData.amenities?.includes("wifi") || false,
        ac: roomData.amenities?.includes("Air Conditioning") || roomData.amenities?.includes("ac") || false,
        laundry: roomData.amenities?.includes("Laundry") || roomData.amenities?.includes("laundry") || false,
        hotWater: roomData.amenities?.includes("Hot Water") || roomData.amenities?.includes("hotWater") || false,
        taps: roomData.amenities?.includes("taps") || false,
        lift: roomData.amenities?.includes("lift") || false,
        carParking: roomData.amenities?.includes("carParking") || false,
        EvCharging: roomData.amenities?.includes("EvCharging") || false,
        Electricity: roomData.amenities?.includes("Electricity") || false
      }
    };
  }, []);

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/rooms');
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }

        const result = await response.json();
        if (result.status === "success" && Array.isArray(result.data)) {
          const foundRoom = result.data.find(h => h._id === id);
          if (foundRoom) {
            setRoom(processRoomData(foundRoom));
            
            // Track viewing history in MongoDB if user is logged in as traveler
            const token = localStorage.getItem('token');
            const userStr = localStorage.getItem('user');
            if (token && userStr) {
              try {
                const user = JSON.parse(userStr);
                if (user.accountType === 'traveller') {
                  await fetch('http://localhost:3001/api/traveler/viewed-rooms', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ roomId: id })
                  });
                }
              } catch (err) {
                console.error('Error tracking viewing history:', err);
                // Continue even if history tracking fails
              }
            }
          } else {
            setError("Room not found");
          }
        } else {
          setError("Failed to fetch rooms data");
        }
      } catch (error) {
        console.error("Error fetching rooms:", error);
        setError("Failed to load room details. Please try again later.");
      }
    };

    fetchRooms();
    const savedLikes = JSON.parse(localStorage.getItem("likedHomes") || "[]");
    setLikedHomes(savedLikes);
  }, [id, processRoomData]);

  const formatCurrency = (number) => {
    return new Intl.NumberFormat('en-IN', { 
      style: 'currency', 
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(number);
  };

  const generateStars = (rating) => {
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.5 ? 1 : 0;
    const emptyStars = 5 - fullStars - halfStar;
    
    return (
      <>
        {[...Array(fullStars)].map((_, i) => (
          <FontAwesomeIcon key={`full-${i}`} icon={faStar} />
        ))}
        {halfStar ? <FontAwesomeIcon icon={faStarHalfAlt} /> : null}
        {[...Array(emptyStars)].map((_, i) => (
          <FontAwesomeIcon key={`empty-${i}`} icon={faStarOutline} />
        ))}
      </>
    );
  };

  const calculateAverageRating = (reviews) => {
    if (!reviews?.length) return 0;
    const sum = reviews.reduce((total, rev) => total + (rev.rating || 0), 0);
    return (sum / reviews.length).toFixed(1);
  };

  const handlePrevImage = () => {
    setCurrentImageIndex((prevIndex) => 
      (prevIndex - 1 + room.media.length) % room.media.length
    );
  };

  const handleNextImage = () => {
    setCurrentImageIndex((prevIndex) => 
      (prevIndex + 1) % room.media.length
    );
  };

  const handleThumbnailClick = (index) => {
    setCurrentImageIndex(index);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: room.title,
        text: `Check out this ${room.size} room in ${room.location}`,
        url: window.location.href
      }).catch(err => {
        console.error('Error sharing:', err);
      });
    } else {
      const shareUrl = `${window.location.origin}/room/${room.id}`;
      prompt("Copy this link to share:", shareUrl);
    }
  };

  const handleSave = async () => {
    const isLiked = likedHomes.includes(room.id);
    let updatedLikes;
    const action = isLiked ? 'remove' : 'add';
    
    if (isLiked) {
      updatedLikes = likedHomes.filter(id => id !== room.id);
    } else {
      updatedLikes = [...likedHomes, room.id];
    }
    
    setLikedHomes(updatedLikes);
    localStorage.setItem("likedHomes", JSON.stringify(updatedLikes));
    
    // Sync to MongoDB if user is logged in as traveler
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.accountType === 'traveller') {
          const response = await fetch('http://localhost:3001/api/traveler/liked-rooms', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ roomId: room.id, action })
          });
          
          if (response.ok) {
            const data = await response.json();
            // Update localStorage with latest data from server
            if (data.likedRooms) {
              localStorage.setItem("likedHomes", JSON.stringify(data.likedRooms));
              setLikedHomes(data.likedRooms);
            }
          }
        }
      } catch (err) {
        console.error('Error syncing liked rooms to MongoDB:', err);
        // Continue with local storage update even if sync fails
      }
    }
  };

  const handleDateClick = (dateString) => {
    if (!checkInDate) {
      // Set check-in date
      setCheckInDate(dateString);
    } else if (!checkOutDate) {
      // Set check-out date
      if (dateString <= checkInDate) {
        // If clicked date is before or equal to check-in, set it as new check-in
        setCheckInDate(dateString);
        setCheckOutDate('');
      } else {
        // Validate that all dates between check-in and selected date are available
        const checkIn = new Date(checkInDate);
        const checkOut = new Date(dateString);
        const selectedDates = [];
        for (let d = new Date(checkIn); d <= checkOut; d.setDate(d.getDate() + 1)) {
          selectedDates.push(new Date(d).toISOString().split('T')[0]);
        }
        
        const availableDates = room.availability?.map(d => {
          const dDate = new Date(d);
          return dDate.toISOString().split('T')[0];
        }) || [];
        
        const allDatesAvailable = selectedDates.every(date => availableDates.includes(date));
        if (allDatesAvailable) {
          setCheckOutDate(dateString);
        } else {
          showErrorMessage("Selected date range includes unavailable dates. Please select consecutive available dates.");
        }
      }
    } else {
      // Reset and set new check-in
      setCheckInDate(dateString);
      setCheckOutDate('');
    }
  };

  const clearDates = () => {
    setCheckInDate('');
    setCheckOutDate('');
  };

  // Check if a date is in the selected range
  const isDateInRange = (dateString) => {
    if (!checkInDate || !checkOutDate) return false;
    const date = new Date(dateString);
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    return date >= checkIn && date <= checkOut;
  };

  // Check if a date is available
  const isDateAvailable = (dateString) => {
    if (!room || !room.availability || room.availability.length === 0) {
      return true; // No restrictions
    }
    const date = new Date(dateString).toISOString().split('T')[0];
    const availableDates = room.availability.map(d => {
      const dDate = new Date(d);
      return dDate.toISOString().split('T')[0];
    });
    return availableDates.includes(date);
  };

  // Format date for display
  const formatDateDisplay = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleRent = () => {
    if (!checkInDate || !checkOutDate) {
      showErrorMessage("Please select both check-in and check-out dates");
      return;
    }

    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    const days = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
    
    if (days <= 0) {
      showErrorMessage("Check-out date must be after check-in date");
      return;
    }

    if (days > room.maxdays) {
      showErrorMessage(`Maximum stay is ${room.maxdays} days`);
      return;
    }

    // Validate that all selected dates are in availability
    if (room.availability && room.availability.length > 0) {
      const selectedDates = [];
      for (let d = new Date(checkIn); d < checkOut; d.setDate(d.getDate() + 1)) {
        selectedDates.push(new Date(d).toISOString().split('T')[0]);
      }
      
      const availableDates = room.availability.map(date => {
        const d = new Date(date);
        return d.toISOString().split('T')[0];
      });
      
      const allDatesAvailable = selectedDates.every(date => availableDates.includes(date));
      if (!allDatesAvailable) {
        showErrorMessage("Selected dates are not all available. Please select from available dates only.");
        return;
      }
    }

    const pricePerNight = parseFloat(room.price);
    const totalCost = days * pricePerNight * (1 - (room.discountPercentage || 0) / 100);
    navigate(`/payment?id=${room.id}&checkIn=${checkInDate}&checkOut=${checkOutDate}&days=${days}&cost=${totalCost}&mail=${encodeURIComponent(room.host.email)}&title=${encodeURIComponent(room.title)}&location=${encodeURIComponent(room.location)}`);
  };

  const showErrorMessage = (message) => {
    setError(message);
    setTimeout(() => setError(null), 5000);
  };

  const handleMessage = () => {
    try {
      if (!room) {
        showErrorMessage("Room data not loaded yet");
        return;
      }
      navigate('/message', { 
        state: { 
          hostId: room.id,
          hostName: room.host.name,
          hostEmail: room.host.email
        }
      });
    } catch (error) {
      console.error('Navigation error:', error);
      setError('Failed to open messages. Please try again.');
    }
  };

  const getRentButtonText = () => {
    if (!checkInDate || !checkOutDate) return "Select Dates";
    
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    const days = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
    
    if (days <= 0) return "Invalid Dates";
    if (days > room.maxdays) return `Max ${room.maxdays} days allowed`;
    
    const pricePerNight = parseFloat(room.price);
    const totalCost = days * pricePerNight * (1 - (room.discountPercentage || 0) / 100);
    return `Book Now for ${formatCurrency(totalCost)}`;
  };

  const isRentButtonDisabled = () => {
    if (!checkInDate || !checkOutDate) return true;
    
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    const days = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
    
    return days <= 0 || days > room.maxdays;
  };

  if (error && typeof error === 'string') {
    return (
      <>
        <Navbar />
        <div className="room-room-details-container">
          <div className="room-global-error">
            <div className="room-error-content">
              <FontAwesomeIcon icon={faExclamationCircle} />
              <span>{error}</span>
            </div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  if (!room) {
    return (
      <>
        <Navbar />
        <div className="room-room-details-container">Loading...</div>
        <Footer />
      </>
    );
  }

  const isLiked = likedHomes.includes(room.id);
  const today = new Date().toISOString().split('T')[0];
  
  // Get available dates from availability array
  const getAvailableDates = () => {
    if (!room.availability || room.availability.length === 0) {
      return null; // No restrictions if no availability array
    }
    return room.availability.map(date => {
      const d = new Date(date);
      return d.toISOString().split('T')[0];
    }).filter(date => date >= today).sort();
  };

  const availableDates = getAvailableDates();

  return (
    <>
      <Navbar />
      <div className="room-room-details-container">
        {error && (
          <div className="room-global-error">
            <div className="room-error-content">
              <FontAwesomeIcon icon={faExclamationCircle} />
              <span>{error}</span>
            </div>
          </div>
        )}
        <div className="room-home-name">
          <h1 style={{ color: '#d72d6e' }}>{room.title}</h1>
          <div className="room-share-button-div">
            <button id="room-share-button" onClick={handleShare} aria-label="Share room">
              <FontAwesomeIcon icon={faShareAlt} />
            </button>
          </div>
        </div>

        {room.media && room.media.length > 0 ? (
          <>
            <div 
              className="room-main-image" 
              style={{ backgroundImage: `url('${room.media[currentImageIndex]}')` }}
            >
              <button id="room-prev-image" onClick={handlePrevImage} aria-label="Previous image">
                <FontAwesomeIcon icon={faChevronLeft} />
              </button>
              <button id="room-next-image" onClick={handleNextImage} aria-label="Next image">
                <FontAwesomeIcon icon={faChevronRight} />
              </button>
            </div>
            <div className="room-thumbnails">
              {room.media.map((img, index) => (
                <img 
                  key={index}
                  src={img} 
                  className={`room-thumbnail ${index === currentImageIndex ? 'room-active' : ''}`} 
                  alt={`Thumbnail ${index + 1}`}
                  onClick={() => handleThumbnailClick(index)}
                />
              ))}
            </div>
          </>
        ) : (
          <p>No images available</p>
        )}

        <div className="room-container">
          <div className="room-left-side">
            <div className="room-layout-description">
              <h2 style={{ color: '#d72d6e' }}>Description</h2>
              <p>{room.description}</p>
            </div>
            
            <div className="room-verification">
              <h2 style={{ color: '#d72d6e' }}>Amenities</h2>
              <ul className="room-amenities-grid">
                {Object.entries(room.amenities).map(([amenity, available]) => (
                  <li key={amenity}>
                    <span className="room-amenity-name">
                      {amenity.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <span className="room-separator">:</span>
                    <span id={`room-${amenity}-verify`}>
                      {available ? 'Available' : 'Not Available'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="room-room-information">
              <h2 style={{ color: '#d72d6e' }}>Room Information</h2>
              <ul className="room-amenities-grid">
                <li>
                  <span className="room-amenity-name">Type of Host</span>
                  <span style={{ color: '#d72d6e' }}>
                    {room.host.gen ? room.host.gen.toUpperCase() : 'NOT SPECIFIED'}
                  </span>
                </li>
                <li>
                  <span className="room-amenity-name">Food</span>
                  <span style={{ color: '#d72d6e' }}>
                    {room.host.food ? room.host.food.toUpperCase() : 'NOT SPECIFIED'}
                  </span>
                </li>
                <li>
                  <span className="room-amenity-name">Room Location</span>
                  <span style={{ color: '#d72d6e' }}>
                    {room.locationType ? room.locationType.toUpperCase() : 'NOT SPECIFIED'}
                  </span>
                </li>
                <li>
                  <span className="room-amenity-name">Room Size</span>
                  <span style={{ color: '#d72d6e' }}>
                    {room.size || 'NOT SPECIFIED'}
                  </span>
                </li>
                <li>
                  <span className="room-amenity-name">Nearest Transport</span>
                  <span style={{ color: '#d72d6e' }}>
                    {room.transport ? room.transport.toUpperCase() : 'NOT SPECIFIED'}
                  </span>
                </li>
                <li>
                  <span className="room-amenity-name">Location</span>
                  <span style={{ color: '#d72d6e' }}>
                    {room.location ? room.location.toUpperCase() : 'NOT SPECIFIED'}
                  </span>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="room-right-side">
            <div className="room-rent">
              <h2 style={{ color: '#d72d6e' }}>Book Your Stay</h2>
              <p>
                <strong>Cost:</strong> 
                <span id="room-cost">
                  {formatCurrency(room.price * (1 - (room.discountPercentage || 0) / 100))}
                </span> / night
              </p>
              <p>
                <strong>Rating:</strong> 
                <span id="room-rating">{calculateAverageRating(room.review_main)}</span> / 5
              </p>
              <div id="room-avg-stars">
                {generateStars(calculateAverageRating(room.review_main))}
              </div>
              <p>
                <strong>Maximum Days:</strong>
                <span> {room.maxdays || 'NOT SPECIFIED'} Days</span>
              </p>
              
              {availableDates && availableDates.length > 0 ? (
                <>
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                      Select Available Dates:
                    </label>
                    {checkInDate && (
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                        <strong>Check-in:</strong> {formatDateDisplay(checkInDate)}
                        {checkOutDate && (
                          <>
                            <br />
                            <strong>Check-out:</strong> {formatDateDisplay(checkOutDate)}
                          </>
                        )}
                        <button 
                          onClick={clearDates}
                          style={{
                            marginLeft: '10px',
                            padding: '2px 8px',
                            fontSize: '11px',
                            background: '#f0f0f0',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          Clear
                        </button>
                      </div>
                    )}
                    {!checkInDate && (
                      <p style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                        Click on a date to select check-in
                      </p>
                    )}
                    {checkInDate && !checkOutDate && (
                      <p style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                        Click on a date to select check-out
                      </p>
                    )}
                  </div>
                  
                  <div className="available-dates-grid">
                    {availableDates.map((dateStr) => {
                      const isSelected = dateStr === checkInDate || dateStr === checkOutDate;
                      const inRange = isDateInRange(dateStr);
                      const isAvailable = isDateAvailable(dateStr);
                      
                      return (
                        <button
                          key={dateStr}
                          type="button"
                          onClick={() => isAvailable && handleDateClick(dateStr)}
                          disabled={!isAvailable}
                          className={`available-date-button ${
                            dateStr === checkInDate ? 'check-in-date' : ''
                          } ${
                            dateStr === checkOutDate ? 'check-out-date' : ''
                          } ${
                            inRange && !isSelected ? 'in-range' : ''
                          } ${
                            !isAvailable ? 'unavailable' : ''
                          }`}
                          title={formatDateDisplay(dateStr)}
                        >
                          {new Date(dateStr).getDate()}
                          <span style={{ fontSize: '10px', display: 'block' }}>
                            {new Date(dateStr).toLocaleDateString('en-US', { month: 'short' })}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  
                  <p style={{ fontSize: '11px', color: '#999', marginTop: '10px', textAlign: 'center' }}>
                    {availableDates.length} available date{availableDates.length !== 1 ? 's' : ''}
                  </p>
                </>
              ) : (
                <div style={{ padding: '15px', background: '#f9f9f9', borderRadius: '8px', textAlign: 'center' }}>
                  <p style={{ color: '#666', fontSize: '14px' }}>
                    No availability restrictions. Please select dates using the calendar.
                  </p>
                  <label htmlFor="room-check-in" style={{ display: 'block', marginTop: '10px', marginBottom: '5px' }}>
                    Check-in Date:
                  </label>
                  <input 
                    type="date" 
                    id="room-check-in" 
                    name="check-in"
                    min={today}
                    value={checkInDate}
                    onChange={(e) => setCheckInDate(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                  />
                  <label htmlFor="room-check-out" style={{ display: 'block', marginTop: '10px', marginBottom: '5px' }}>
                    Check-out Date:
                  </label>
                  <input 
                    type="date" 
                    id="room-check-out" 
                    name="check-out"
                    min={checkInDate || today}
                    value={checkOutDate}
                    onChange={(e) => setCheckOutDate(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                  />
                </div>
              )}
              <button 
                id="room-rent-button" 
                onClick={handleRent}
                disabled={isRentButtonDisabled()}
              >
                {getRentButtonText()}
              </button>
              <button 
                id="room-save-button" 
                data-home-id={room.id}
                onClick={handleSave}
                className={isLiked ? 'room-liked' : ''}
              >
                <FontAwesomeIcon icon={faHeart} /> 
                {isLiked ? ' Remove from Wishlist' : ' Save to Wishlist'}
              </button>
            </div>
            
            <div className="room-host-info">
              <img 
                src={
                  room.host?.image && room.host.image.startsWith('http')
                    ? room.host.image
                    : room.host?.image && /^[0-9a-fA-F]{24}$/.test(room.host.image)
                    ? `http://localhost:3001/api/images/${room.host.image}`
                    : '/images/logo.png'
                }
                alt={`${room.host?.name || 'Host'} profile`}
                className="room-host-image"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/images/logo.png';
                }}
                loading="lazy"
                decoding="async"
              />
              <div className="room-host-details">
                <h3>Hosted by {room.host.name || 'Unknown'}</h3>
                <p style={{ fontSize: '14px', color: '#666', margin: '5px 0' }}>
                  {room.host.gen && `Gender: ${room.host.gen}`}
                </p>
                <p style={{ fontSize: '14px', color: '#666', margin: '5px 0' }}>
                  {room.host.email && `Email: ${room.host.email}`}
                </p>
                <button 
                  id="room-message" 
                  onClick={handleMessage}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#d72d6e',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    marginTop: '10px'
                  }}
                >
                  Message
                </button>
              </div>
            </div>
          </div>
        </div>

        {room && (
          <RoomMap
            latitude={room.host.latitude}
            longitude={room.host.longitude}
            title={room.title}
            description={room.description}
            price={room.price}
          />
        )}
        
        <div className="room-review-main">
          <h2 style={{ color: '#d72d6e' }}>Review from our Users</h2>
          {room.review_main && room.review_main.length ? (
            room.review_main.map((review, index) => (
              <div key={index} className="room-review-item">
                <div className="room-review-content">
                  <img 
                    src={review.image || '/images/default-user.jpg'} 
                    alt="User"
                    className="room-review-image"
                    onError={(e) => {
                      e.target.src = '/images/default-user.jpg';
                    }}
                  />
                  <div className="room-review-text">
                    <h4 className="room-review-name">
                      {review.name || 'Anonymous'}
                    </h4>
                    <div className="room-review-rating">
                      {generateStars(review.rating)}
                    </div>
                    <p className="room-review-description">
                      {review.review || 'No review text provided'}
                    </p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="room-no-reviews">No reviews yet.</p>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
};

export default RoomLayout;