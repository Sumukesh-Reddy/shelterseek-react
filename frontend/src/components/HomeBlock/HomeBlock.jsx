import React, { useState } from 'react';
import './HomeBlock.css';

const HomeBlock = ({ room }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [liked, setLiked] = useState(false);

  const handleLike = () => {
    setLiked(!liked);
    // Update localStorage
  };

  const nextImage = () => {
    setCurrentImageIndex((prev) => 
      prev === room.images.length - 1 ? 0 : prev + 1
    );
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => 
      prev === 0 ? room.images.length - 1 : prev - 1
    );
  };

  return (
    <div className="home-block">
      <div className="home-photos-block">
        <button 
          className={`home-like ${liked ? 'liked' : ''}`}
          onClick={handleLike}
        >
          <i className="fa fa-heart"></i>
        </button>
        
        {room.images.length > 1 && (
          <>
            <button className="img-move-left" onClick={prevImage}>&lt;</button>
            <button className="img-move-right" onClick={nextImage}>&gt;</button>
          </>
        )}
        
        <div 
          className="home-image" 
          style={{ backgroundImage: `url(${room.images[currentImageIndex] || '.../public/images/default-house.jpg'})` }}
        ></div>
      </div>
      
      <hr style={{ opacity: 0.3 }} />
      
      <div className="home-content">
        <h3>{room.title || "Untitled Property"}</h3>
        <p>Location: {room.location || "Location not specified"}</p>
        <p className="price">
          ₹{Math.round(room.price * (1 - (room.discount || 0) / 100))}
          {room.discount > 0 && (
            <>
              <span className="old-price">₹{room.price}</span>
              <span className="discount">Discount: {room.discount}% off</span>
            </>
          )}
        </p>
        <p>{room.description || ""}</p>
      </div>
    </div>
  );
};

export default HomeBlock;