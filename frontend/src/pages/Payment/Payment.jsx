// components/Payment/EnhancedPayment.jsx
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
  const [guestDetails, setGuestDetails] = useState([{
    guestName: '',
    guestAge: '',
    guestGender: 'male',
    guestContact: '',
    govtIdType: 'aadhar',
    govtIdNumber: ''
  }]);
  const [paymentMethod, setPaymentMethod] = useState('credit_card');
  const [cardDetails, setCardDetails] = useState({
    cardNumber: '',
    cardHolder: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: ''
  });
  const [upiId, setUpiId] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  
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
      // Auto-fill primary guest with user info if available
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          setGuestDetails([{
            guestName: user.name || '',
            guestAge: '',
            guestGender: 'male',
            guestContact: user.email || '',
            govtIdType: 'aadhar',
            govtIdNumber: ''
          }]);
        } catch (err) {
          console.error('Error parsing user data:', err);
        }
      }
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

  const handleAddGuest = () => {
    if (guestDetails.length >= (roomData?.capacity || 4)) {
      setError(`Maximum capacity is ${roomData?.capacity || 4} guests`);
      return;
    }
    setGuestDetails([...guestDetails, {
      guestName: '',
      guestAge: '',
      guestGender: 'male',
      guestContact: '',
      govtIdType: 'aadhar',
      govtIdNumber: ''
    }]);
  };

  const handleRemoveGuest = (index) => {
    if (guestDetails.length === 1) return;
    const updatedGuests = [...guestDetails];
    updatedGuests.splice(index, 1);
    setGuestDetails(updatedGuests);
  };

  const handleGuestChange = (index, field, value) => {
    const updatedGuests = [...guestDetails];
    updatedGuests[index][field] = value;
    setGuestDetails(updatedGuests);
  };

  const handleCardNumberChange = (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 16) value = value.substring(0, 16);
    value = value.replace(/(.{4})/g, '$1 ').trim();
    setCardDetails({...cardDetails, cardNumber: value});
  };

  const handleExpiryChange = (e, field) => {
    let value = e.target.value.replace(/\D/g, '');
    if (field === 'expiryMonth' && value.length > 2) value = value.substring(0, 2);
    if (field === 'expiryYear' && value.length > 4) value = value.substring(0, 4);
    setCardDetails({...cardDetails, [field]: value});
  };

  const handleCVVChange = (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 4) value = value.substring(0, 4);
    setCardDetails({...cardDetails, cvv: value});
  };

  const validateForm = () => {
    // Validate guest details
    for (let i = 0; i < guestDetails.length; i++) {
      const guest = guestDetails[i];
      if (!guest.guestName.trim()) {
        setError(`Guest ${i + 1}: Name is required`);
        return false;
      }
      if (guest.guestAge && (guest.guestAge < 0 || guest.guestAge > 120)) {
        setError(`Guest ${i + 1}: Age must be between 0 and 120`);
        return false;
      }
    }

    // Validate payment details
    if (paymentMethod === 'credit_card' || paymentMethod === 'debit_card') {
      const cardNum = cardDetails.cardNumber.replace(/\s/g, '');
      if (cardNum.length !== 16) {
        setError('Card number must be 16 digits');
        return false;
      }
      if (!cardDetails.cardHolder.trim()) {
        setError('Card holder name is required');
        return false;
      }
      if (!cardDetails.expiryMonth || !cardDetails.expiryYear) {
        setError('Expiry date is required');
        return false;
      }
      if (!cardDetails.cvv || cardDetails.cvv.length < 3) {
        setError('CVV is required (3-4 digits)');
        return false;
      }
    }

    if (paymentMethod === 'upi' && !upiId.trim()) {
      setError('UPI ID is required');
      return false;
    }

    return true;
  };

  const processPayment = async () => {
    if (!validateForm()) return false;

    // In a real app, you would send to payment gateway
    // For demo, we'll simulate a payment
    const paymentData = {
      method: paymentMethod,
      amount: displayCost,
      currency: 'INR'
    };

    if (paymentMethod === 'credit_card' || paymentMethod === 'debit_card') {
      // Get last 4 digits for display (don't store full card number)
      const cardNum = cardDetails.cardNumber.replace(/\s/g, '');
      paymentData.cardLastFour = cardNum.slice(-4);
      paymentData.cardType = getCardType(cardNum);
      paymentData.transactionId = generateTransactionId();
    } else if (paymentMethod === 'upi') {
      paymentData.upiId = upiId;
      paymentData.transactionId = generateTransactionId();
    }

    return paymentData;
  };

  const getCardType = (cardNumber) => {
    if (/^4/.test(cardNumber)) return 'visa';
    if (/^5[1-5]/.test(cardNumber)) return 'mastercard';
    if (/^3[47]/.test(cardNumber)) return 'amex';
    if (/^6(?:011|5)/.test(cardNumber)) return 'discover';
    if (/^35/.test(cardNumber)) return 'jcb';
    if (/^60/.test(cardNumber)) return 'rupay';
    return 'other';
  };

  const generateTransactionId = () => {
    return `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;
  };

// In Payment.jsx, update the handlePayment function:

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
    
    // Process payment (simulated)
    const paymentResult = await processPayment();
    if (!paymentResult) {
      setLoading(false);
      return;
    }

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
        totalCost: totalWithTax, // Use the correct total with tax
        hostEmail: hostEmail,
        guests: guestDetails.length,
        guestDetails: guestDetails,
        specialRequests: specialRequests,
        paymentDetails: {
          paymentMethod: paymentMethod,
          ...(paymentResult.cardLastFour && { cardLastFour: paymentResult.cardLastFour }),
          ...(paymentResult.cardType && { cardType: paymentResult.cardType }),
          transactionId: paymentResult.transactionId,
          paymentGateway: 'simulated'
        }
      })
    });

    const bookingResult = await bookingResponse.json();

    if (!bookingResponse.ok) {
      // Handle HTTP errors
      setError(bookingResult.message || `HTTP Error: ${bookingResponse.status}`);
      setLoading(false);
      return;
    }

    if (bookingResult.success) {
      // Clear sensitive data
      setCardDetails({
        cardNumber: '',
        cardHolder: '',
        expiryMonth: '',
        expiryYear: '',
        cvv: ''
      });
      
      // Show success message
      alert(`Booking confirmed!\nBooking ID: ${bookingResult.bookingId}\nTransaction ID: ${paymentResult.transactionId}`);
      
      // Save booking to local storage
      const bookingInfo = {
        bookingId: bookingResult.bookingId,
        transactionId: paymentResult.transactionId,
        roomId: roomId,
        roomTitle: title,
        checkIn: checkIn,
        checkOut: checkOut,
        totalCost: totalWithTax,
        guests: guestDetails,
        bookedAt: new Date().toISOString()
      };
      
      const userBookings = JSON.parse(localStorage.getItem('userBookings') || '[]');
      userBookings.push(bookingInfo);
      localStorage.setItem('userBookings', JSON.stringify(userBookings));
      
      
      navigate('/BookedHistory');
    } else {
      // Handle API error response
      setError(bookingResult.message || 'Failed to complete booking');
    }
  } catch (err) {
    console.error('Payment error:', err);
    setError('An error occurred. Please try again.');
  } finally {
    setLoading(false);
  }
};

  // Calculate costs
  const roomPricePerNight = roomData?.price || (cost / days);
  const discount = roomData?.discount || 0;
  const subtotal = roomPricePerNight * days;
  const discountAmount = subtotal * (discount / 100);
  const finalCost = subtotal - discountAmount;
  const displayCost = cost > 0 ? cost : finalCost;
  const tax = displayCost * 0.18; // 18% GST
  const totalWithTax = displayCost + tax;

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
                <div className="date-item">
                  <strong>Guests:</strong>
                  <span>{guestDetails.length}</span>
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
                </div>
              )}

              {/* Guest Information Section */}
              <div className="guest-section">
                <h3>Guest Information</h3>
                {guestDetails.map((guest, index) => (
                  <div key={index} className="guest-card">
                    <div className="guest-header">
                      <h4>Guest {index + 1} {index === 0 && '(Primary)'}</h4>
                      {guestDetails.length > 1 && (
                        <button 
                          type="button" 
                          className="remove-guest-btn"
                          onClick={() => handleRemoveGuest(index)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="guest-form">
                      <div className="form-row">
                        <div className="form-group">
                          <label>Full Name *</label>
                          <input
                            type="text"
                            value={guest.guestName}
                            onChange={(e) => handleGuestChange(index, 'guestName', e.target.value)}
                            placeholder="Enter full name"
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label>Age</label>
                          <input
                            type="number"
                            value={guest.guestAge}
                            onChange={(e) => handleGuestChange(index, 'guestAge', e.target.value)}
                            placeholder="Age"
                            min="0"
                            max="120"
                          />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Gender</label>
                          <select
                            value={guest.guestGender}
                            onChange={(e) => handleGuestChange(index, 'guestGender', e.target.value)}
                          >
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Contact</label>
                          <input
                            type="text"
                            value={guest.guestContact}
                            onChange={(e) => handleGuestChange(index, 'guestContact', e.target.value)}
                            placeholder="Email or phone"
                          />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>ID Type</label>
                          <select
                            value={guest.govtIdType}
                            onChange={(e) => handleGuestChange(index, 'govtIdType', e.target.value)}
                          >
                            <option value="aadhar">Aadhar Card</option>
                            <option value="passport">Passport</option>
                            <option value="driving_license">Driving License</option>
                            <option value="voter_id">Voter ID</option>
                            <option value="pan_card">PAN Card</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>ID Number</label>
                          <input
                            type="text"
                            value={guest.govtIdNumber}
                            onChange={(e) => handleGuestChange(index, 'govtIdNumber', e.target.value)}
                            placeholder="ID number"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {guestDetails.length < (roomData?.capacity || 4) && (
                  <button 
                    type="button" 
                    className="add-guest-btn"
                    onClick={handleAddGuest}
                  >
                    + Add Another Guest
                  </button>
                )}
              </div>

              {/* Special Requests */}
              <div className="special-requests">
                <h3>Special Requests</h3>
                <textarea
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  placeholder="Any special requirements, dietary restrictions, or additional notes..."
                  rows="3"
                />
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
                  <div className="price-row discount">
                    <span>Discount ({discount}%):</span>
                    <span>-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                <div className="price-row">
                  <span>GST (18%):</span>
                  <span>{formatCurrency(tax)}</span>
                </div>
                <div className="price-row total">
                  <span><strong>Total Amount:</strong></span>
                  <span><strong>{formatCurrency(totalWithTax)}</strong></span>
                </div>
              </div>

              {/* Payment Method Selection */}
              <div className="payment-method-section">
                <h3>Select Payment Method</h3>
                <div className="payment-methods">
                  {['credit_card', 'debit_card', 'upi', 'net_banking', 'wallet'].map(method => (
                    <label key={method} className="payment-method-option">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={method}
                        checked={paymentMethod === method}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                      />
                      <span className="method-label">
                        {method === 'credit_card' && '💳 Credit Card'}
                        {method === 'debit_card' && '💳 Debit Card'}
                        {method === 'upi' && '📱 UPI'}
                        {method === 'net_banking' && '🏦 Net Banking'}
                        {method === 'wallet' && '💰 Wallet'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Card Payment Form */}
              {(paymentMethod === 'credit_card' || paymentMethod === 'debit_card') && (
                <div className="card-payment-form">
                  <h3>Card Details</h3>
                  <div className="form-group">
                    <label>Card Number</label>
                    <input
                      type="text"
                      value={cardDetails.cardNumber}
                      onChange={handleCardNumberChange}
                      placeholder="1234 5678 9012 3456"
                      maxLength="19"
                    />
                  </div>
                  <div className="form-group">
                    <label>Card Holder Name</label>
                    <input
                      type="text"
                      value={cardDetails.cardHolder}
                      onChange={(e) => setCardDetails({...cardDetails, cardHolder: e.target.value})}
                      placeholder="Name on card"
                    />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Expiry Month</label>
                      <input
                        type="text"
                        value={cardDetails.expiryMonth}
                        onChange={(e) => handleExpiryChange(e, 'expiryMonth')}
                        placeholder="MM"
                        maxLength="2"
                      />
                    </div>
                    <div className="form-group">
                      <label>Expiry Year</label>
                      <input
                        type="text"
                        value={cardDetails.expiryYear}
                        onChange={(e) => handleExpiryChange(e, 'expiryYear')}
                        placeholder="YYYY"
                        maxLength="4"
                      />
                    </div>
                    <div className="form-group">
                      <label>CVV</label>
                      <input
                        type="password"
                        value={cardDetails.cvv}
                        onChange={handleCVVChange}
                        placeholder="123"
                        maxLength="4"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* UPI Payment Form */}
              {paymentMethod === 'upi' && (
                <div className="upi-payment-form">
                  <h3>UPI Details</h3>
                  <div className="form-group">
                    <label>UPI ID</label>
                    <input
                      type="text"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      placeholder="username@bank"
                    />
                  </div>
                </div>
              )}

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
                {loading ? 'Processing...' : `Pay ${formatCurrency(totalWithTax)}`}
              </button>

              <p className="payment-note">
                By confirming, you agree to our terms and conditions. 
                Your payment is secure and encrypted.
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