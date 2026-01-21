// pages/ChatPage.js - Fixed version
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import ChatSidebar from '../../components/Chat/ChatSidebar';
import ChatWindow from '../../components/Chat/ChatWindow';
import UserList from '../../components/Chat/UserList';
import './ChatPage.css';

const ChatPage = () => {
  const { user } = useAuth();
  const { socket, onlineUsers } = useSocket();
  const location = useLocation();
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUserList, setShowUserList] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const processedStartChatRef = useRef(false);

  const api = axios.create({
    baseURL: 'http://localhost:3001/api',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const fetchChatRooms = useCallback(async () => {
    try {
      const response = await api.get('/chat/rooms');
      setRooms(response.data.rooms);
      
      if (!isMobile && response.data.rooms.length > 0 && !selectedRoom) {
        setSelectedRoom(response.data.rooms[0]);
        fetchMessages(response.data.rooms[0]._id);
      }    
    } catch (error) {
      console.error('Failed to load chat rooms:', error);
      if (error.response?.status === 401) {
        window.location.href = '/login';
      }
    } finally {
      setLoading(false);
    }
  }, [selectedRoom, isMobile]);

  useEffect(() => {
    fetchChatRooms();
  }, [fetchChatRooms]);

  // Handle starting/opening a chat from navigation state
  useEffect(() => {
    const startChatWith = location.state?.startChatWith;
    const email = startChatWith?.email?.trim();
    if (!email) return;
    if (processedStartChatRef.current) return;
    if (loading) return;

    const openChatByEmail = async () => {
      try {
        processedStartChatRef.current = true;

        const token = localStorage.getItem('token');
        if (!token) {
          console.error('No authentication token found');
          alert('Please login to message the host');
          return;
        }

        const resp = await axios.get('http://localhost:3001/api/users/search', {
          params: { query: email },
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!resp.data?.success) {
          console.error('Search API error:', resp.data);
          alert(`Could not find host with email: ${email}. Please make sure the host is registered.`);
          window.history.replaceState({}, document.title);
          return;
        }

        const users = resp.data?.users || [];
        const exactUser = users.find(u => {
          const userEmail = (u.email || '').trim().toLowerCase();
          return userEmail === email.toLowerCase();
        });

        if (!exactUser?._id) {
          console.warn('No user found for email:', email);
          alert(`Host with email "${email}" not found. They may need to create an account first.`);
          window.history.replaceState({}, document.title);
          return;
        }

        const existingRoom = rooms.find(r =>
          Array.isArray(r.participants) &&
          r.participants.some(p => {
            const participantId = p?._id?.toString();
            const participantEmail = (p?.email || '').trim().toLowerCase();
            return (
              participantId === exactUser._id.toString() ||
              participantEmail === email.toLowerCase()
            );
          })
        );

        if (existingRoom?._id) {
          setSelectedRoom(existingRoom);
          fetchMessages(existingRoom._id);
        } else {
          await handleStartNewChat(exactUser._id);
        }
      } catch (error) {
        console.error('Failed to start chat with host by email:', error);
        const errorMsg = error.response?.data?.message || error.message || 'Unknown error';
        alert(`Failed to open chat: ${errorMsg}`);
      } finally {
        window.history.replaceState({}, document.title);
      }
    };

    openChatByEmail();
  }, [location.state, rooms, loading]);

  useEffect(() => {
    return () => {
      if (socket && selectedRoom) {
        socket.emit('leave-room', selectedRoom._id);
      }
    };
  }, [socket, selectedRoom]);

  useEffect(() => {
    if (!socket) return;

    const handleIncomingMessage = (message) => {
      
      if (message.sender?._id === user?._id) {
        console.log('Ignoring message from self via socket');
        return;
      }
      
      setRooms(prevRooms => prevRooms.map(room => 
        room._id === message.roomId 
          ? { ...room, lastMessage: message, updatedAt: new Date() }
          : room
      ));
    
      if (selectedRoom && message.roomId === selectedRoom._id) {
        setMessages(prev => {
          
          const isDuplicate = prev.some(msg => 
            msg._id === message._id || 
            (msg.content === message.content && msg.sender?._id === message.sender?._id)
          );
          
          return isDuplicate ? prev : [...prev, message];
        });
      }
    };

    socket.on('receive-message', handleIncomingMessage);

    return () => {
      socket.off('receive-message', handleIncomingMessage);
    };
  }, [socket, selectedRoom, user?._id]);

  const fetchMessages = async (roomId) => {
    try {
      const response = await api.get(`/chat/messages/${roomId}`);
      setMessages(response.data.messages);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const handleSelectRoom = (room) => {
    setSelectedRoom(room);
    fetchMessages(room._id);
  };

  useEffect(() => {
    if (!socket || !selectedRoom?._id) return;

    const roomId = selectedRoom._id;
    socket.emit('join-room', roomId);

    return () => {
      socket.emit('leave-room', roomId);
    };
  }, [socket, selectedRoom?._id]);

  const handleSendMessage = (content) => {
    if (!socket || !selectedRoom || !content.trim()) return;

    const messageContent = content.trim();
    
    // Create optimistic message for immediate UI update
    const optimisticMessage = {
      _id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      roomId: selectedRoom._id,
      content: messageContent,
      sender: {
        _id: user?._id,
        name: user?.name,
        email: user?.email,
        profilePhoto: user?.profilePhoto
      },
      createdAt: new Date().toISOString(),
      type: 'text',
      isOptimistic: true
    };

    console.log('Adding optimistic message:', optimisticMessage._id);

    // Add optimistic message to UI immediately
    setMessages(prev => [...prev, optimisticMessage]);
    
    // Update rooms list with optimistic message
    setRooms(prev => prev.map(room => 
      room._id === selectedRoom._id 
        ? { 
            ...room, 
            lastMessage: optimisticMessage,
            updatedAt: new Date().toISOString()
          }
        : room
    ));

    // Send via WebSocket
    socket.emit('send-message', {
      roomId: selectedRoom._id,
      content: messageContent,
      type: 'text'
    });
  };

  const handleStartNewChat = async (userId) => {
    try {
      const response = await api.post('/chat/room', {
        participantId: userId
      });

      const newRoom = response.data.room;
      setRooms(prev => [newRoom, ...prev]);
      setSelectedRoom(newRoom);
      setShowUserList(false);
      fetchMessages(newRoom._id);
    } catch (error) {
      console.error('Failed to start chat:', error);
    }
  };

  const handleDeleteRoom = async (roomId) => {
    if (!roomId) return;
    if (!window.confirm('Delete this chat and all its messages?')) return;

    try {
      await api.delete(`/chat/room/${roomId}`);
      setRooms(prev => prev.filter(r => r._id !== roomId));
      if (selectedRoom && selectedRoom._id === roomId) {
        setSelectedRoom(null);
        setMessages([]);
      }
    } catch (error) {
      console.error('Failed to delete chat:', error);
    }
  };

  const handleBackToChats = () => {
    setSelectedRoom(null);
    setMessages([]);
  };

  if (loading) {
    return (
      <div className="chat-loading-container">
        <div className="chat-loading-spinner" />
        <div className="chat-loading-text">Loading chats...</div>
      </div>
    );
  }

  return (
    <div className="chat-page">
      {/* Sidebar */}
      {(!isMobile || !selectedRoom) && (
        <ChatSidebar
          rooms={rooms}
          selectedRoom={selectedRoom}
          onSelectRoom={handleSelectRoom}
          onStartNewChat={() => setShowUserList(true)}
          onlineUsers={onlineUsers}
        />
      )}
      
      {/* Chat Window or Welcome */}
      {selectedRoom ? (
        <ChatWindow
          room={selectedRoom}
          messages={messages}
          onSendMessage={handleSendMessage}
          onDeleteRoom={() => handleDeleteRoom(selectedRoom?._id)}
          onBack={handleBackToChats}
          isMobile={isMobile}
        />
      ) : !isMobile && (
        <div className="chat-welcome-screen">
          <div className="welcome-content">
            <h2 className="welcome-title">Welcome to Chat</h2>
            <p className="welcome-message">
              Select a chat or start a new conversation
            </p>
            <button 
              onClick={() => setShowUserList(true)}
              className="welcome-new-chat-button"
            >
              Start New Chat
            </button>
          </div>
        </div>
      )}

      {/* User List Modal */}
      {showUserList && (
        <UserList
          onSelectUser={handleStartNewChat}
          onClose={() => setShowUserList(false)}
        />
      )}
    </div>
  );
};

export default ChatPage;