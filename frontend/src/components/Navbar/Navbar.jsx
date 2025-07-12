import React, { useState } from 'react';
import './Navbar.css';

const Navbar = () => {
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
                />
                <button>
                    <i className="fa fa-search" id="search-button"></i>
                </button>
            </div>

            <div className="cart">
                <a href="/wishlist">
                    <i className="fa fa-heart-o" aria-hidden="true"></i>
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

            <div className="traveler">
                <button id="user-button" onClick={toggleUserMenu}>
                    <i className="fa fa-user" aria-hidden="true"></i>
                </button>
            </div>

            {isUserMenuOpen && (
                <div id="user-menu" className="user-menu">
                    <button
                        id="user-close-btn"
                        className="user-close-btn"
                        onClick={toggleUserMenu}
                    >
                        ×
                    </button>
                    <ul>
                        <li><a href="/profile">profile</a></li>
                        <li><a href="/history">history</a></li>
                        <li><a href="/loginweb" id="login-button">login</a></li>
                    </ul>
                </div>
            )}

            <div className="menubar">
                <button id="menubotton" onClick={toggleMobileMenu}>
                    <i className="fa fa-navicon"></i>
                </button>
            </div>

            <div id="menu" className="menu" style={{ display: isMobileMenuOpen ? 'block' : 'none' }}>
                <button
                    id="close-btn"
                    className="close-btn"
                    onClick={toggleMobileMenu}
                >
                    ×
                </button>
                <ul>
                    <li><a href="/profile">profile</a></li>
                    <li><a href="/messages">inbox</a></li>
                    <li><a href="/history">history</a></li>
                    <li><a href="/wishlist">Wish List</a></li>
                    <li><a href="/about">about</a></li>
                    <li><a href="/loginweb">login</a></li>
                </ul>
            </div>
        </div>
    );
};

export default Navbar;
