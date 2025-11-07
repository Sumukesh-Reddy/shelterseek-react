import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './HomeBlock.css';

const HomeBlock = ({ room }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const navigate = useNavigate();
  const images = Array.isArray(room.images) && room.images.length > 0 
    ? room.images 
    : ['/images/default-house.jpg'];

  const prevImage = (e) => {
    e.stopPropagation();
    setCurrentImageIndex(prev => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const nextImage = (e) => {
    e.stopPropagation();
    setCurrentImageIndex(prev => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const handleClick = () => {
    navigate(`/room/${room._id}`); 
  };

  return (
    <div
      className={`home-block ${room.status === 'booked' ? 'booked' : ''}`}
      onClick={handleClick}
      style={{ cursor: 'pointer' }}
    >
      <div className="home-photos-block">
        {images.length > 1 && (
          <>
            <button
              className="image-nav-button left"
              onClick={prevImage}
            >
              &lt;
            </button>
            <button
              className="image-nav-button right"
              onClick={nextImage}
            >
              &gt;
            </button>
          </>
        )}
        <div className="home-image-container">
        <img
          src={`http://localhost:3001${images[currentImageIndex]}`}
          alt={room.title || 'Room image'}
          className="home-image"
          onError={(e) => {
            e.target.src = '/images/default-house.jpg';
          }}
        />
        </div>
        {room.status === 'booked' && (
          <div className="booked-overlay">Booked</div>
        )}
      </div>
      <hr style={{ opacity: 0.3 }} />
      <div className="home-content">
        <h3>{room.title || 'Untitled Property'}</h3>
        <p>Location: {room.location || 'Location not specified'}</p>
        <p className="price">
          ₹{Math.round(room.price * (1 - (room.discount || 0) / 100))}
          {room.discount > 0 && (
            <>
              <br />
              <span className="old-price">
                ₹{room.price}
              </span>
              <br />
              <span className="discount" >
                Discount: {room.discount}% off
              </span>
            </>
          )}
        </p>
        <p>{room.description || 'No description available'}</p>
      </div>
    </div>
  );
};

export default HomeBlock;