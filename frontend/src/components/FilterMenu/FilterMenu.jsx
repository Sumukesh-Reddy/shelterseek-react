import React, { useState } from 'react';
import './FilterMenu.css';

const FilterMenu = ({ onClose, onApply }) => {
  const [filters, setFilters] = useState({
    checkIn: '',
    days: 1,
    roomType: 'any',
    bedrooms: 1,
    beds: 1,
    adults: 0,
    children: 0,
    minPrice: 500,
    maxPrice: 9500,
    selectedTypes: [],
    selectedLocations: [],
    selectedAmenities: [],
    hostGender: 'any',
    foodPreferences: [],
    roomSize: 'any',
    transport: 'any'
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleCounter = (field, operation) => {
    setFilters(prev => ({
      ...prev,
      [field]: operation === 'add' ? prev[field] + 1 : Math.max(0, prev[field] - 1)
    }));
  };

  const handleApply = () => {
    onApply(filters);
    onClose();
  };

  return (
    <div className="filter-menu">
      <button className="filter-close-button" onClick={onClose}>&times;</button>
      
      {/* Date Input */}
      <div className="filter-group">
        <label><b>Check-in Date:</b></label>
        <input 
          type="date" 
          name="checkIn"
          value={filters.checkIn}
          onChange={handleInputChange}
        />
      </div>

      {/* Counter Inputs */}
      <div className="filter-group">
        <label><b>Days:</b></label>
        <div className="counter">
          <button onClick={() => handleCounter('days', 'sub')}>-</button>
          <span>{filters.days}</span>
          <button onClick={() => handleCounter('days', 'add')}>+</button>
        </div>
      </div>

      {/* Other filter groups... */}

      <div className="filter-search">
        <button onClick={handleApply}>Search</button>
      </div>
    </div>
  );
};

export default FilterMenu;