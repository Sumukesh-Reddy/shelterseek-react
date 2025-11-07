import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Profile.css';

const Profile = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [alert, setAlert] = useState({ show: false, message: '', type: '' });
  const navigate = useNavigate();

  useEffect(() => {
    fetchUserData();
  },[]);

  const fetchUserData = async () => {
    try {
      const userData = JSON.parse(sessionStorage.getItem("currentUser"));
      
      if (!userData) {
        showAlert("Please log in to view your profile.", "error");
        alert("please try to login");
        return;
      }

      // Fetch updated user data from server
      const response = await fetch(
        `/api/users?email=${encodeURIComponent(userData.email)}&accountType=${userData.accountType}`,
        { credentials: 'include' }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.status === "success") {
          const user = result.data.travelers[0] || result.data.hosts[0];
          if (user) {
            const updatedUser = {
              ...userData,
              name: user.name,
              email: user.email,
              accountType: user.accountType,
              profilePhoto: user.profilePhoto
            };
            setCurrentUser(updatedUser);
            sessionStorage.setItem("currentUser", JSON.stringify(updatedUser));
          }
        }
      } else {
        setCurrentUser(userData);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      const userData = JSON.parse(sessionStorage.getItem("currentUser"));
      if (userData) {
        setCurrentUser(userData);
      } else {
        console.log("your data is not able to fetch currentlt.please try again later");
      }
    } finally {
      setLoading(false);
    }
  };

  const getProfilePhotoUrl = (profilePhoto) => {
    if (!profilePhoto) return "/images/sai.jpg";
    
    if (profilePhoto.startsWith('/api/images/') || profilePhoto.startsWith('/public/') || profilePhoto.startsWith('http')) {
      return profilePhoto;
    }
    
    if (profilePhoto.length === 24) {
      return `/api/images/${profilePhoto}`;
    }
    
    return "/images/sai.jpg";
  };

  const showAlert = (message, type) => {
    setAlert({ show: true, message, type });
    setTimeout(() => setAlert({ show: false, message: '', type: '' }), 3000);
  };

  const handleProfilePictureChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append("image", file);

      const uploadResponse = await fetch("/api/images", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      const uploadResult = await uploadResponse.json();
      
      if (uploadResult.status !== "success") {
        throw new Error(uploadResult.message || "Failed to upload image");
      }
      
      const updateResponse = await fetch("/api/update-profile-photo", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: currentUser.email,
          accountType: currentUser.accountType,
          profilePhoto: uploadResult.data.id,
        }),
        credentials: "include",
      });
      
      const updateResult = await updateResponse.json();
      
      if (updateResult.status === "success") {
        const newProfilePhotoUrl = `/api/images/${uploadResult.data.id}`;
        const newUserData = {
          ...currentUser,
          profilePhoto: newProfilePhotoUrl
        };
        setCurrentUser(newUserData);
        sessionStorage.setItem("currentUser", JSON.stringify(newUserData));
        showAlert("Profile picture updated successfully!", "success");
      } else {
        throw new Error(updateResult.message || "Failed to update profile photo");
      }
    } catch (error) {
      console.error('Error updating profile picture:', error);
      showAlert(error.message || "Failed to update profile picture", "error");
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    const { currentPassword, newPassword, confirmPassword } = formData;
    
    if (newPassword !== confirmPassword) {
      showAlert("New passwords don't match!", "error");
      return;
    }
    
    if (newPassword.length < 8) {
      showAlert("Password must be at least 8 characters long!", "error");
      return;
    }
    
    try {
      const response = await fetch('/api/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: currentUser.email,
          currentPassword,
          newPassword,
          accountType: currentUser.accountType
        }),
        credentials: 'include'
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to change password');
      }
      
      showAlert("Password changed successfully!", "success");
      setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      console.error('Password change error:', error);
      showAlert(error.message || "Failed to change password. Please try again.", "error");
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("currentUser");
    navigate("/");
  };

  const handleActivity = () => {
    if (currentUser.accountType === "host") {
      navigate('/dashboard');
    } else if (currentUser.accountType === "traveller") {
      navigate('/history');
    }
  };

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: value
    }));
  };

  if (loading) {
    return (
      <div className="profile-page">
        <div className="header-bg"></div>
        <div className="profile-container">
          <div className="details-box">
            <p>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <div className="profile-page">
      {/* Alert Notification */}
      {alert.show && (
        <div className={`alert alert-${alert.type}`}>
          {alert.message}
        </div>
      )}

      <div className="header-bg"></div>

      <div className="profile-container">
        <div className="profile-left">
          <img 
            src={getProfilePhotoUrl(currentUser.profilePhoto)} 
            alt="Profile" 
            className="profile-pic" 
            id="profile-pic"
            onError={(e) => {
              e.target.src = "/images/sai.jpg";
            }}
          />
          <br />
          <label htmlFor="profile-pic-input" className="upload-btn">
            Change Picture
          </label>
          <input
            type="file"
            id="profile-pic-input"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleProfilePictureChange}
          />
        </div>

        <div className="details-box">
          <h2>Hi!&nbsp;&nbsp;<span id="profile-name">{currentUser.name}</span></h2>
          <p><strong>Email:</strong> <span id="profile-email">{currentUser.email}</span></p>
          <p><strong>User Type:</strong> <span id="profile-account-type">{currentUser.accountType}</span></p>
          
          <div className="divider"></div>

          <div className="password-change-section">
            <h3>Change Password</h3>
            <form id="change-password-form" onSubmit={handlePasswordChange}>
              <div className="form-group">
                <label htmlFor="current-password">Current Password</label>
                <input 
                  type="password" 
                  id="current-password" 
                  value={formData.currentPassword}
                  onChange={handleInputChange}
                  required 
                />
              </div>
              <div className="form-group">
                <label htmlFor="new-password">New Password</label>
                <input 
                  type="password" 
                  id="new-password" 
                  value={formData.newPassword}
                  onChange={handleInputChange}
                  required 
                  minLength="8" 
                />
              </div>
              <div className="form-group">
                <label htmlFor="confirm-password">Confirm New Password</label>
                <input 
                  type="password" 
                  id="confirm-password" 
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  required 
                  minLength="8" 
                />
              </div>
              <button type="submit" className="btn btn-primary">Change Password</button>
            </form>
          </div>

          <div className="more-functions">
            <button onClick={handleLogout}>Logout</button>
            <button onClick={handleActivity}>View Activity</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;