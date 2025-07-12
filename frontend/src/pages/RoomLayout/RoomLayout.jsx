import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import './RoomLayout.css';

const RoomLayout = () => {
  const { id } = useParams();
  const [room, setRoom] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [bookingDetails, setBookingDetails] = useState({
    checkIn: '',
    checkOut: '',
    guests: 1
  });

  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const response = await fetch(`/api/rooms/${id}`);
        const data = await response.json();
        if (data.status === "success") {
          setRoom(data.data);
        }
      } catch (error) {
        console.error("Error fetching room:", error);
      }
    };
    fetchRoom();
  }, [id]);

  const handleBookingChange = (e) => {
    const { name, value } = e.target;
    setBookingDetails(prev => ({ ...prev, [name]: value }));
  };

  const handleBookNow = async () => {
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomId: id,
          ...bookingDetails,
          userEmail: JSON.parse(sessionStorage.getItem('currentUser')).email
        })
      });
      const data = await response.json();
      if (data.status === "success") {
        alert("Booking successful!");
      }
    } catch (error) {
      console.error("Error creating booking:", error);
    }
  };

  if (!room) return <div>Loading...</div>;

  return (
    <div className="room-layout">
      <div className="room-images">
        <div className="main-image" style={{ backgroundImage: `url(${room.images[currentImageIndex]})` }}></div>
        <div className="thumbnail-container">
          {room.images.map((img, index) => (
            <div 
              key={index}
              className={`thumbnail ${index === currentImageIndex ? 'active' : ''}`}
              style={{ backgroundImage: `url(${img})` }}
              onClick={() => setCurrentImageIndex(index)}
            />
          ))}
        </div>
      </div>

      <div className="room-details">
        <h1>{room.title}</h1>
        <p className="location">{room.location}</p>
        <div className="price-section">
          <span className="price">₹{Math.round(room.price * (1 - (room.discount || 0) / 100))}</span>
          {room.discount > 0 && (
            <>
              <span className="old-price">₹{room.price}</span>
              <span className="discount">{room.discount}% OFF</span>
            </>
          )}
          <span className="per-night">per night</span>
        </div>

        <div className="room-info">
          <div className="info-item">
            <i className="fa fa-bed"></i>
            <span>{room.beds} beds</span>
          </div>
          <div className="info-item">
            <i className="fa fa-home"></i>
            <span>{room.bedrooms} bedrooms</span>
          </div>
          <div className="info-item">
            <i className="fa fa-users"></i>
            <span>Up to {room.capacity} guests</span>
          </div>
        </div>

        <div className="description">
          <h2>About this place</h2>
          <p>{room.description}</p>
        </div>

        <div className="amenities">
          <h2>Amenities</h2>
          <div className="amenities-grid">
            {room.amenities.map((amenity, index) => (
              <div key={index} className="amenity-item">
                <i className="fa fa-check"></i>
                <span>{amenity}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="booking-form">
          <h2>Book this room</h2>
          <div className="form-group">
            <label>Check-in</label>
            <input 
              type="date" 
              name="checkIn"
              value={bookingDetails.checkIn}
              onChange={handleBookingChange}
            />
          </div>
          <div className="form-group">
            <label>Check-out</label>
            <input 
              type="date" 
              name="checkOut"
              value={bookingDetails.checkOut}
              onChange={handleBookingChange}
            />
          </div>
          <div className="form-group">
            <label>Guests</label>
            <input 
              type="number" 
              name="guests"
              min="1"
              max={room.capacity}
              value={bookingDetails.guests}
              onChange={handleBookingChange}
            />
          </div>
          <button className="book-button" onClick={handleBookNow}>
            Book Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoomLayout;