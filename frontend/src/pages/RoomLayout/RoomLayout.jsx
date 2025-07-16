import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
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

    return {
      id: roomData._id,
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
      maxdays: roomData.maxStayDays || 10,
      media: processImagePaths(roomData.images),
      review_main: roomData.reviews || [],
      amenities: {
        wifi: roomData.amenities?.includes("wifi") || false,
        ac: roomData.amenities?.includes("ac") || false,
        laundry: roomData.amenities?.includes("laundry") || false,
        hotWater: roomData.amenities?.includes("hotWater") || false,
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

  const handleSave = () => {
    const isLiked = likedHomes.includes(room.id);
    let updatedLikes;
    
    if (isLiked) {
      updatedLikes = likedHomes.filter(id => id !== room.id);
    } else {
      updatedLikes = [...likedHomes, room.id];
    }
    
    setLikedHomes(updatedLikes);
    localStorage.setItem("likedHomes", JSON.stringify(updatedLikes));
  };

  const handleCheckInChange = (e) => {
    setCheckInDate(e.target.value);
  };

  const handleCheckOutChange = (e) => {
    setCheckOutDate(e.target.value);
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

    const pricePerNight = parseFloat(room.price);
    const totalCost = days * pricePerNight * (1 - (room.discountPercentage || 0) / 100);
    window.location.href = `/payment?id=${room.id}&checkIn=${checkInDate}&checkOut=${checkOutDate}&cost=${totalCost}&mail=${room.host.email}`;
  };

  const showErrorMessage = (message) => {
    setError(message);
    setTimeout(() => setError(null), 5000);
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
              <label htmlFor="room-check-in">Check-in Date:</label>
              <input 
                type="date" 
                id="room-check-in" 
                name="check-in"
                min={today}
                value={checkInDate}
                onChange={handleCheckInChange}
              />
              <label htmlFor="room-check-out">Check-out Date:</label>
              <input 
                type="date" 
                id="room-check-out" 
                name="check-out"
                min={checkInDate || today}
                value={checkOutDate}
                onChange={handleCheckOutChange}
              />
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
                src={room.host.image || '/images/default-user.jpg'} 
                alt="Host"
                className="room-host-image"
                onError={(e) => {
                  e.target.src = '/images/default-user.jpg';
                }}
              />
              <div className="room-host-details">
                <h3>Hosted by {room.host.name || 'Unknown'}</h3>
                <button id="room-message">
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