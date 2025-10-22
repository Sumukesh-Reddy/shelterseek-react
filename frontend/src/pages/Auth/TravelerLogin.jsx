import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Login.css';

const TravelerLogin = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: email/password, 2: OTP verification
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    let timer;
    if (resendTimer > 0) {
      timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendTimer]);

  const handleOtpChange = (index, value) => {
    if (value.length > 1) return; 
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const sendOtp = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('http://localhost:3001/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send OTP');
      }
      setSuccess('OTP sent to your email!');
      setResendTimer(60);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    const otpString = otp.join('');
    if (otpString.length !== 6) {
      setError('Please enter complete OTP');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch('http://localhost:3001/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otpString })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Invalid OTP');
      }
      setSuccess('OTP verified! Logging you in...');
      
      // Now proceed with login
      const loginRes = await fetch('http://localhost:3001/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const loginData = await loginRes.json();
      if (!loginRes.ok || !loginData.success) {
        throw new Error(loginData.message || 'Login failed');
      }
      
      // Check if user is a traveler
      if (loginData.user.accountType !== 'traveller') {
        throw new Error('This login is for travelers only. Please use the host login.');
      }
      
      localStorage.setItem('token', loginData.token);
      localStorage.setItem('user', JSON.stringify(loginData.user));
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (step === 1) {
      await sendOtp();
    } else {
      await verifyOtp();
    }
  };

  const resendOtp = async () => {
    if (resendTimer > 0) return;
    await sendOtp();
  };

  const handleGoogleLogin = () => {
    window.location.href = 'http://localhost:3001/auth/google';
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">ShelterSeek</div>
          <p className="auth-subtitle">
            {step === 1 ? 'Welcome back, Traveler! Sign in to explore amazing places' : 'Enter the verification code sent to your email'}
          </p>
        </div>

        <div className="step-indicator">
          <div className={`step ${step >= 1 ? 'active' : 'inactive'}`}>1</div>
          <div className={`step ${step >= 2 ? 'active' : 'inactive'}`}>2</div>
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <form onSubmit={handleSubmit}>
          {step === 1 ? (
            <>
              <div className="form-group">
                <label className="form-label" htmlFor="email">Email Address</label>
                <input
                  id="email"
                  type="email"
                  className="form-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  className="form-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
                <div style={{ textAlign: 'right', marginTop: '8px' }}>
                  <Link to="/forgot-password" className="auth-link" style={{ fontSize: '0.9rem' }}>
                    Forgot Password?
                  </Link>
                </div>
              </div>

              <button type="submit" className="auth-button" disabled={loading}>
                {loading ? (
                  <>
                    <span className="loading-spinner"></span> Sending OTP...
                  </>
                ) : (
                  'Send OTP & Login as Traveler'
                )}
              </button>

              <div className="auth-divider">
                <span>or</span>
              </div>

              <button type="button" className="google-button" onClick={handleGoogleLogin}>
                <svg className="google-icon" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>
            </>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label">Enter 6-digit code</label>
                <div className="otp-container">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      id={`otp-${index}`}
                      type="text"
                      className="otp-input"
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      maxLength="1"
                    />
                  ))}
                </div>
              </div>

              <button type="submit" className="auth-button" disabled={loading}>
                {loading ? (
                  <>
                    <span className="loading-spinner"></span> Verifying...
                  </>
                ) : (
                  'Verify & Login as Traveler'
                )}
              </button>

              <div className="resend-otp">
                {resendTimer > 0 ? (
                  <span>Resend OTP in {resendTimer}s</span>
                ) : (
                  <button type="button" className="resend-link" onClick={resendOtp}>
                    Resend OTP
                  </button>
                )}
              </div>
            </>
          )}
        </form>

        <div className="auth-footer">
          {step === 1 ? (
            <>
              Don't have an account? <Link to="/signup" className="auth-link">Sign up as Traveler</Link>
              <br />
              <Link to="/host-login" className="auth-link">Login as Host instead</Link>
            </>
          ) : (
            <button 
              type="button" 
              className="auth-button secondary" 
              onClick={() => setStep(1)}
            >
              Back to Login
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TravelerLogin;
