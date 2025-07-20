import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage/HomePage';
import RoomLayout from './pages/RoomLayout/RoomLayout';
import About from './components/About/About';
import Wishlist from './pages/Wishlist/Wishlist';
import PrivacyPolicy from './pages/PrivacyPolicy/PrivacyPolicy';
import Messages from './pages/Messages/messages';
import Message from './pages/Messages/message';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<About />} />
        <Route path="/room/:id" element={<RoomLayout />} />
        <Route path="/wishlist" element={<Wishlist />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/message" element={<Message />} />
      </Routes>
    </Router>
  );
}

export default App;