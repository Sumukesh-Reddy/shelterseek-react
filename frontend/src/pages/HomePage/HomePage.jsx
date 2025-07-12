import React, { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar/Navbar';
import Slider from '../../components/Slider/Slider';
import FilterMenu from '../../components/FilterMenu/FilterMenu';
import HomeBlock from '../../components/HomeBlock/HomeBlock';
import './HomePage.css';

const HomePage = () => {
  const [showFilter, setShowFilter] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [filteredRooms, setFilteredRooms] = useState([]);

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const response = await fetch('/api/rooms');
        const data = await response.json();
        if (data.status === "success") {
          setRooms(data.data);
          setFilteredRooms(data.data);
        }
      } catch (error) {
        console.error("Error fetching rooms:", error);
      }
    };
    fetchRooms();
  }, []);

  const applyFilters = (filters) => {
    // Filter logic here
    const filtered = rooms.filter(room => {
      // Implement your filter conditions
      return true;
    });
    setFilteredRooms(filtered);
  };

  return (
    <div className="home-page">
      <Navbar />
      <Slider />
      <button 
        className="filter-button" 
        onClick={() => setShowFilter(!showFilter)}
      >
        <i className="fa fa-sliders"></i>
        <span>filter</span>
      </button>
      
      {showFilter && (
        <FilterMenu 
          onClose={() => setShowFilter(false)}
          onApply={applyFilters}
        />
      )}
      
      <div className="main-home-block">
        {filteredRooms.map(room => (
          <HomeBlock key={room._id} room={room} />
        ))}
      </div>
    </div>
  );
};

export default HomePage;