import React, { useState } from 'react';
import './Navbar.css';

const Navbar = ({ searchKeywords, onSearchChange }) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleUserMenu = () => {
    setIsUserMenuOpen(!isUserMenuOpen);
    setIsMobileMenuOpen(false);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
    setIsUserMenuOpen(false);
  };

  return (
    <div className="traveler_navbar">
      <div id="traveler_logo">
        <a href="/" style={{ textDecoration: 'none' }}>
          <div>
            <span id="logo-s">S</span>
            <span id="logo-r">helter</span>
            <span id="logo-s">S</span>
            <span id="logo-r">eek</span>
          </div>
        </a>
      </div>

      <div id="traveler_searchbar">
        <input
          type="text"
          id="search-bar"
          name="destination"
          placeholder="Where to go!"
          value={searchKeywords}
          onChange={onSearchChange}
        />
        <button>
          <i className="fa fa-search" id="search-button"></i>
        </button>
      </div>

      <div className="cart">
        <a href="/wishlist">
          <i className="fa fa-heart" aria-hidden="true"></i>
        </a>
      </div>

      <div className="about">
        <a href="/about">About</a>
      </div>

      <div className="inbox">
        <a href="/messages">
          <i className="fa fa-envelope" aria-hidden="true" id="i-inbox"></i>
        </a>
      </div>

      <div className="traveler" style={{ position: 'relative' }}>
        <button 
          id="user-button" 
          onClick={toggleUserMenu}
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <i className="fa fa-user" aria-hidden="true"></i>
        </button>

        {isUserMenuOpen && (
          <div className="user-menu">
            <button
              className="user-close-btn"
              onClick={toggleUserMenu}
            >
              ×
            </button>
            <ul>
              <li><a href="/profile">Profile</a></li>
              <li><a href="/history">History</a></li>
              <li><a href="/loginweb" id="login-button">Login</a></li>
            </ul>
          </div>
        )}
      </div>

      <div className="menubar">
        <button 
          id="menubutton" 
          onClick={toggleMobileMenu} 
          style={{ 
            background: 'none', 
            border: 'none', 
            padding: 0, 
            cursor: 'pointer' 
          }}
        >
          <i className="fa fa-bars"></i>
        </button>
      </div>

      {isMobileMenuOpen && (
        <div className="mobile-menu">
          <button
            className="close-btn"
            onClick={toggleMobileMenu}
          >
            ×
          </button>
          <ul>
            <li><a href="/profile">Profile</a></li>
            <li><a href="/messages">Inbox</a></li>
            <li><a href="/history">History</a></li>
            <li><a href="/wishlist">Wish List</a></li>
            <li><a href="/about">About</a></li>
            <li><a href="/loginweb">Login</a></li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default Navbar;