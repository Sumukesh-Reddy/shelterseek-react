// components/IntroAnimation/IntroAnimation.jsx
import React, { useState } from 'react';
import './IntroAnimation.css';

const IntroAnimation = ({ onComplete }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isFading, setIsFading] = useState(false);

  const handleOpen = () => {
    // 1. Trigger the door opening animation
    setIsOpen(true);

    // 2. Wait for the door to open (1.2s), then fade out the container
    setTimeout(() => {
      setIsFading(true);
      
      // 3. Wait for the fade out (1s), then tell Parent (HomePage) we are done
      setTimeout(() => {
        onComplete();
      }, 1000);
    }, 1200);
  };

  return (
    <div className={`intro-container ${isFading ? 'fade-out' : ''}`}>
      <div 
        className={`door-scene ${isOpen ? 'open' : ''}`} 
        onClick={handleOpen}
      >
        {/* The Reveal (Inside the door) */}
        <div className="room-reveal">
          <div className="reveal-logo">ShelterSeek</div>
        </div>

        {/* The Door */}
        <div className="door">
          <div className="door-panel"></div>
          <div class="knob"></div>
        </div>

        <div className="click-hint">Click to Enter</div>
      </div>
    </div>
  );
};

export default IntroAnimation;