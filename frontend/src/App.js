import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage/HomePage';
import RoomLayout from './pages/RoomLayout/RoomLayout';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/room_layout" element={<RoomLayout />} />
      </Routes>
    </Router>
  );
}

export default App;