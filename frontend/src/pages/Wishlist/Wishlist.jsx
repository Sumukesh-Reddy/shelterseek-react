import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar/Navbar';
import HomeBlock from '../../components/HomeBlock/HomeBlock';
import Footer from '../../components/Footer/Footer';
import './Wishlist.css';

const Wishlist = () => {
  const [likedRooms, setLikedRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchLikedRooms = async () => {
      try {
        // Get liked room IDs from localStorage
        const likedHomes = JSON.parse(localStorage.getItem('likedHomes') || '[]');
        
        if (likedHomes.length === 0) {
          setLoading(false);
          return;
        }

        // Fetch all rooms from the API
        const response = await fetch('http://localhost:3001/api/rooms');
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }

        const result = await response.json();
        
        if (result.status === "success" && Array.isArray(result.data)) {
          // Filter to only include liked rooms
          const filteredRooms = result.data.filter(room => likedHomes.includes(room._id));
          setLikedRooms(filteredRooms);
        } else {
          setError("Failed to fetch rooms data");
        }
      } catch (error) {
        console.error("Error fetching liked rooms:", error);
        setError("Failed to load wishlist. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchLikedRooms();
  }, []);

  const handleEmptyWishlist = () => {
    return (
      <div className="wishlist-empty">
        <h2>Your wishlist is empty</h2>
        <p>Your wishlist is like a travel mood board ✈️💖 – start planning your dream trip today!</p>
        <button 
          className="wishlist-explore-button"
          onClick={() => navigate('/')}
        >
          Explore Rooms
        </button>
      </div>
    );
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="wishlist-container">Loading your wishlist...</div>
        <Footer />
      </>
    );
  }

  if (error) {
    return (
      <>
        <Navbar />
        <div className="wishlist-container">
          <div className="wishlist-error">
            <p>{error}</p>
            <button onClick={() => window.location.reload()}>Try Again</button>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="wishlist-container">
        <h1 className="wishlist-title">Your Wishlist</h1>
        
        {likedRooms.length === 0 ? (
          handleEmptyWishlist()
        ) : (
          <div className="wishlist-grid">
            {likedRooms.map(room => (
              <HomeBlock key={room._id} room={room} />
            ))}
          </div>
        )}
      </div>
      <Footer />
    </>
  );
};

export default Wishlist;