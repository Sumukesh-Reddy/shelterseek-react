import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage/HomePage';
import RoomLayout from './pages/RoomLayout/RoomLayout';
import About from './components/About/About';
import Wishlist from './pages/Wishlist/Wishlist';
import PrivacyPolicy from './pages/PrivacyPolicy/PrivacyPolicy';
import Messages from './pages/Messages/messages';
import Message from './pages/Messages/message';
import Login from './pages/Auth/Login';
import Signup from './pages/Auth/Signup';
import ResetPassword from './pages/Auth/ResetPassword';
import TravelerLogin from './pages/Auth/TravelerLogin';
import HostLogin from './pages/Auth/HostLogin';
import LoginSelection from './pages/Auth/LoginSelection';
import AdminLogin from './pages/Auth/AdminLogin';
import ForgotPassword from './pages/Auth/ForgotPassword';
import Profile from './pages/profile/profile';
import Payment from './pages/Payment/Payment';
import HostIndex from './pages/Host_page/host_index';
import HostDashboard from './pages/HostDashboard/HostDashboard';
import HostProfile from './pages/HostProfile/HostProfile';
import History from './pages/History/History';
import BookedHistory from './pages/BookedRooms/BookedHistory';
import AdminDashboard from './pages/AdminDashboard/AdminDashboard';
import AdminNotifications from './pages/AdminNotifications/AdminNotifications';
import AdminMaps from './pages/AdminMaps/AdminMaps';
import AdminMapsView from './pages/AdminMaps/AdminMapsView';
import HostDetails from './pages/AdminNotifications/HostDetails';
import AdminTrends from './pages/AdminTrends/AdminTrends';
import TravelerDetails from './pages/AdminNotifications/TravelerDetails';
import HotelChatbot  from './pages/HotelChatBot/HotelChatbot';
import ChatbotIcon from './components/ChatbotIcon/ChatbotIcon';
import HostRequests from "./pages/HostRequests/HostRequests";

function App() {
  return (
    <Router>
      <ChatbotIcon />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<About />} />
        <Route path="/room/:id" element={<RoomLayout />} />
        <Route path="/wishlist" element={<Wishlist />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/message" element={<Message />} />
        <Route path="/loginweb" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/traveler-login" element={<TravelerLogin />} />
        <Route path="/host-login" element={<HostLogin />} />
        <Route path="/loginweb" element={<LoginSelection />} />
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/payment" element={<Payment />} />
        <Route path="/host_index" element={<HostIndex />} />
        <Route path="/dashboard" element={<HostDashboard />} />
        <Route path="/hostProfile" element={<HostProfile />} />
        <Route path="/history" element={<History />} />
        <Route path="/BookedHistory" element={<BookedHistory />} />
        <Route path="/AdminDashboard" element={<AdminDashboard />} />
        <Route path="/admin_notifications" element={<AdminNotifications />} />
        <Route path="/admin_map" element={<AdminMaps />} />
        <Route path="/admin/maps/:hostEmail" element={<AdminMapsView />} />
        <Route path="/host/:email" element={<HostDetails />} />
        <Route path="/admin_trends" element={<AdminTrends />} />
        <Route path="/traveler/:email/bookings" element={<TravelerDetails />} />
        <Route path="/chatbot" element={<HotelChatbot />} />
        <Route path="/admin/hostrequests" element={<HostRequests />} />

      </Routes>
    </Router>
  );
}

export default App;