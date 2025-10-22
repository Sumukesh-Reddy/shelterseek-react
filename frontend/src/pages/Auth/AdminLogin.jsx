// AdminLogin.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Login.css';

const AdminLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Static admin credentials check
      if (email === 'shelterseekrooms@gmail.com' && password === 'admin123') {
        // Create admin user object
        const adminUser = {
          id: 'admin-001',
          name: 'ShelterSeek Admin',
          email: 'shelterseekrooms@gmail.com',
          accountType: 'admin',
          role: 'administrator'
        };

        // Store in localStorage
        localStorage.setItem('token', 'admin-token-' + Date.now());
        localStorage.setItem('user', JSON.stringify(adminUser));
        
        // Redirect to admin page
        navigate('/admin_page');
      } else {
        throw new Error('Invalid admin credentials');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">ShelterSeek</div>
          <p className="auth-subtitle">
            Admin Portal - Secure Access
          </p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Admin Email</label>
            <input
              id="email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter admin email"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Admin Password</label>
            <input
              id="password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              required
            />
          </div>

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? (
              <>
                <span className="loading-spinner"></span> Signing in...
              </>
            ) : (
              'Login as Admin'
            )}
          </button>
        </form>

        <div className="auth-footer">
          <Link to="/" className="auth-link">← Back to User Login</Link>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;