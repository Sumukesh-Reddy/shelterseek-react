import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../../components/Navbar/Navbar';
import Footer from '../../components/Footer/Footer';
import './Payment.css';

const Payment = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [roomData, setRoomData] = useState(null);
  
  const roomId = searchParams.get('id');
  const checkIn = searchParams.get('checkIn');
  const checkOut = searchParams.get('checkOut');
  const days = parseInt(searchParams.get('days')) || 1;
  const cost = parseFloat(searchParams.get('cost')) || 0;
  const hostEmail = searchParams.get('mail');
  const title = searchParams.get('title');
  const location = searchParams.get('location');

  useEffect(() => {
    if (roomId) {
      fetchRoomData();
    }
  }, [roomId]);

  const fetchRoomData = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/rooms');
      if (response.ok) {
        const result = await response.json();
        if (result.status === 'success') {
          const room = result.data.find(r => r._id === roomId || r.id === roomId);
          if (room) {
            setRoomData(room);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching room data:', err);
    }
  };

  const formatCurrency = (number) => {
    return new Intl.NumberFormat('en-IN', { 
      style: 'currency', 
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(number);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const handlePayment = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');
      
      if (!token || !userStr) {
        setError('Please log in to complete the booking');
        setLoading(false);
        return;
      }

      const user = JSON.parse(userStr);
      
      // Create booking
      const bookingResponse = await fetch('http://localhost:3001/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          roomId: roomId,
          checkIn: checkIn,
          checkOut: checkOut,
          days: days,
          totalCost: displayCost,
          hostEmail: hostEmail
        })
      });

      const bookingResult = await bookingResponse.json();

      if (bookingResponse.ok && bookingResult.success) {
        // Mark room as booked
        await fetch(`http://localhost:3001/api/rooms/${roomId}/book`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            booking: true,
            bookedDates: {
              checkIn: checkIn,
              checkOut: checkOut
            }
          })
        });

        alert('Booking confirmed! Redirecting to home page...');
        navigate('/');
      } else {
        setError(bookingResult.message || 'Failed to complete booking');
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!checkIn || !checkOut || !roomId) {
    return (
      <>
        <Navbar />
        <div className="payment-container">
          <div className="payment-error">
            <h2>Invalid Booking Information</h2>
            <p>Please select dates from the room page to proceed with booking.</p>
            <button onClick={() => navigate('/')}>Go to Home</button>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  // Get price per night from room data or calculate from cost
  const roomPricePerNight = roomData?.price || (cost / days);
  const discount = roomData?.discount || 0;
  const subtotal = roomPricePerNight * days;
  const discountAmount = subtotal * (discount / 100);
  const finalCost = subtotal - discountAmount;
  
  // Use the cost passed from URL if it matches, otherwise use calculated
  const displayCost = cost > 0 ? cost : finalCost;

  return (
    <>
      <Navbar />
      <div className="payment-container">
        <div className="payment-content">
          <div className="payment-left">
            <h1>Booking Summary</h1>
            
            <div className="booking-details-card">
              <h2>{title || 'Property Booking'}</h2>
              <p className="location">{location || 'Location'}</p>
              
              <div className="booking-dates">
                <div className="date-item">
                  <strong>Check-in:</strong>
                  <span>{formatDate(checkIn)}</span>
                </div>
                <div className="date-item">
                  <strong>Check-out:</strong>
                  <span>{formatDate(checkOut)}</span>
                </div>
                <div className="date-item">
                  <strong>Duration:</strong>
                  <span>{days} night{days !== 1 ? 's' : ''}</span>
                </div>
              </div>

              {roomData && (
                <div className="room-details">
                  <h3>Room Details</h3>
                  <div className="detail-row">
                    <span>Property Type:</span>
                    <span>{roomData.propertyType || 'N/A'}</span>
                  </div>
                  <div className="detail-row">
                    <span>Capacity:</span>
                    <span>{roomData.capacity || 'N/A'} guests</span>
                  </div>
                  <div className="detail-row">
                    <span>Bedrooms:</span>
                    <span>{roomData.bedrooms || 'N/A'}</span>
                  </div>
                  <div className="detail-row">
                    <span>Beds:</span>
                    <span>{roomData.beds || 'N/A'}</span>
                  </div>
                  {roomData.hostGender && (
                    <div className="detail-row">
                      <span>Host Gender:</span>
                      <span>{roomData.hostGender}</span>
                    </div>
                  )}
                  {roomData.foodFacility && (
                    <div className="detail-row">
                      <span>Food Facility:</span>
                      <span>{roomData.foodFacility}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="amenities-summary">
                {roomData?.amenities && roomData.amenities.length > 0 && (
                  <>
                    <h3>Amenities</h3>
                    <ul>
                      {roomData.amenities.map((amenity, index) => (
                        <li key={index}>{amenity}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="payment-right">
            <div className="payment-card">
              <h2>Payment Details</h2>
              
              <div className="price-breakdown">
                <div className="price-row">
                  <span>Price per night:</span>
                  <span>{formatCurrency(roomPricePerNight)}</span>
                </div>
                <div className="price-row">
                  <span>Nights:</span>
                  <span>{days}</span>
                </div>
                <div className="price-row">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <>
                    <div className="price-row discount">
                      <span>Discount ({discount}%):</span>
                      <span>-{formatCurrency(discountAmount)}</span>
                    </div>
                  </>
                )}
                <div className="price-row total">
                  <span><strong>Total:</strong></span>
                  <span><strong>{formatCurrency(displayCost)}</strong></span>
                </div>
              </div>

              {error && (
                <div className="payment-error-message">
                  {error}
                </div>
              )}

              <button 
                className="payment-button" 
                onClick={handlePayment}
                disabled={loading}
              >
                {loading ? 'Processing...' : `Confirm Booking for ${formatCurrency(displayCost)}`}
              </button>

              <p className="payment-note">
                By confirming, you agree to our terms and conditions. 
                Your booking will be processed immediately.
              </p>
            </div>

            <div className="host-contact">
              <h3>Host Contact</h3>
              <p>Email: {hostEmail || 'N/A'}</p>
              <button 
                className="contact-host-button"
                onClick={() => navigate('/message', { 
                  state: { 
                    hostEmail: hostEmail,
                    hostName: roomData?.name || 'Host'
                  }
                })}
              >
                Message Host
              </button>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default Payment;

