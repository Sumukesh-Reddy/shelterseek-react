// pages/HomePage.jsx
import React, { useState } from 'react';
import Navbar from '../../components/Navbar/Navbar';
import Slider from '../../components/Slider/Slider';
import FilterMenu from '../../components/FilterMenu/FilterMenu';
import HomeListings from '../../components/HomeListings/HomeListings';
import './HomePage.css';

const HomePage = () => {
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState({
    checkIn: '',
    days: 1,
    roomType: 'any',
    bedrooms: 1,
    beds: 1,
    adults: 0,
    children: 0,
    minPrice: parseInt(localStorage.getItem('priceMin')) || 500,
    maxPrice: parseInt(localStorage.getItem('priceMax')) || 9500,
    selectedTypes: [],
    selectedLocations: [],
    selectedAmenities: [],
    hostGender: 'any',
    foodPreferences: [],
    roomSize: 'any',
    transport: 'Any',
    searchKeywords: ''
  });

  const toggleFilterMenu = () => {
    console.log('Toggling filter menu:', !showFilter);
    setShowFilter(!showFilter);
  };

  const applyFilters = (newFilters) => {
    console.log('Applying filters:', newFilters);
    setFilters(newFilters);
    setShowFilter(false);
  };

  const handleSearchChange = (e) => {
    setFilters(prev => ({ ...prev, searchKeywords: e.target.value }));
  };

  return (
    <div className="home-page">
      <Navbar searchKeywords={filters.searchKeywords} onSearchChange={handleSearchChange} />
      <Slider />
      <button
        id="filter-button"
        className="filter-button"
        onClick={toggleFilterMenu}
      >
        <i className="fas fa-filter"></i>
        <span>filter</span>
      </button>
      {showFilter && (
        <FilterMenu
          onClose={toggleFilterMenu}
          onApply={applyFilters}
          currentFilters={filters}
        />
      )}
      <HomeListings filters={filters} />
    </div>
  );
};

export default HomePage;