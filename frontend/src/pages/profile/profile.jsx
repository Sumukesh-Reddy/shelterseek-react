import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Profile.css";

export default function Profile() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState({ show: false, type: "", message: "" });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const navigate = useNavigate();

  // -----------------------------
  // 1. FETCH USER DATA - Simplified version
  // -----------------------------
  useEffect(() => {
    // Get user data directly from sessionStorage (set during login)
    const sessionUser = JSON.parse(sessionStorage.getItem("currentUser"));
    
    if (!sessionUser) {
      // Check for token-based auth from your first app.js
      const token = localStorage.getItem("token");
      if (token) {
        // Try to get user from JWT token
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          const userFromToken = {
            id: payload.id,
            email: payload.email,
            name: payload.name || payload.email.split('@')[0],
            accountType: payload.accountType || 'traveller'
          };
          setCurrentUser(userFromToken);
          sessionStorage.setItem("currentUser", JSON.stringify(userFromToken));
        } catch (error) {
          console.log("Token parsing failed:", error);
        }
      } else {
        setAlert({ show: true, type: "error", message: "Please login first." });
        navigate("/loginweb");
      }
    } else {
      setCurrentUser(sessionUser);
    }
    
    setLoading(false);
  }, [navigate]);

  // -----------------------------
  // 2. RETURN PROFILE PHOTO URL
  // -----------------------------
  const getPhoto = (photoId) => {
    if (!photoId) return "/images/sai.png";
    
    // Check if it's already a valid path
    if (photoId.startsWith("http") || photoId.startsWith("/")) {
      return photoId;
    }
    
    // Try to construct URL from your backend
    return `/api/images/${photoId}`;
  };

  // -----------------------------
  // 3. SHOW ALERT
  // -----------------------------
  const showAlert = (msg, type = "success") => {
    setAlert({ show: true, type, message: msg });
    setTimeout(() => setAlert({ show: false }), 3000);
  };

  // -----------------------------
  // 4. HANDLE PROFILE PIC UPLOAD - Working version
  // -----------------------------
  const handleProfileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      showAlert("Uploading image...", "info");
      
      // Create FormData
      const formData = new FormData();
      formData.append("image", file);
      
      // Upload to your working endpoint from second app.js
      const uploadResponse = await fetch("/api/images", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }
      
      const uploadResult = await uploadResponse.json();
      
      if (uploadResult.status === "success") {
        // Now update the user profile with the new photo ID
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
        
        if (!updateResponse.ok) {
          // If update fails, still show uploaded image
          const newUser = { 
            ...currentUser, 
            profilePhoto: uploadResult.data.id 
          };
          sessionStorage.setItem("currentUser", JSON.stringify(newUser));
          setCurrentUser(newUser);
          showAlert("Image uploaded! (Profile update may need refresh)", "info");
          return;
        }
        
        const updateResult = await updateResponse.json();
        
        if (updateResult.status === "success") {
          // Update local state
          const newUser = { 
            ...currentUser, 
            profilePhoto: updateResult.data.user?.profilePhoto || uploadResult.data.id 
          };
          sessionStorage.setItem("currentUser", JSON.stringify(newUser));
          setCurrentUser(newUser);
          showAlert("Profile photo updated successfully!", "success");
        } else {
          showAlert("Profile updated but server response was unexpected", "info");
        }
      } else {
        showAlert(uploadResult.message || "Upload failed", "error");
      }
    } catch (error) {
      console.error("Upload error:", error);
      showAlert("Failed to upload image. Please try again.", "error");
    }
  };

  // -----------------------------
  // 5. HANDLE PASSWORD CHANGE
  // -----------------------------
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    const { currentPassword, newPassword, confirmPassword } = passwordForm;

    if (newPassword !== confirmPassword) {
      showAlert("New passwords do not match", "error");
      return;
    }

    if (newPassword.length < 8) {
      showAlert("Password must be at least 8 characters", "error");
      return;
    }

    try {
      showAlert("Updating password...", "info");
      
      const res = await fetch("/api/change-password", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: currentUser.email,
          currentPassword,
          newPassword,
          accountType: currentUser.accountType
        }),
        credentials: "include"
      });

      const data = await res.json();

      if (data.status === "success") {
        showAlert("Password changed successfully!", "success");
        setPasswordForm({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      } else {
        showAlert(data.message || "Error changing password", "error");
      }
    } catch (err) {
      console.error(err);
      showAlert("Server error. Please try again.", "error");
    }
  };

  // -----------------------------
  // 6. HANDLE LOGOUT
  // -----------------------------
  const logout = () => {
    // Clear all storage
    localStorage.removeItem("token");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("accountType");
    sessionStorage.removeItem("currentUser");
    sessionStorage.removeItem("token");
    
    // Redirect to home
    navigate("/");
  };

  // -----------------------------
  // LOADING STATE
  // -----------------------------
  if (loading) {
    return (
      <div className="profile-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="profile-page">
        <div className="not-logged-in">
          <h2>Please Log In</h2>
          <p>You need to be logged in to view your profile.</p>
          <button 
            onClick={() => navigate("/loginweb")} 
            className="btn btn-primary"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      {/* Alert Messages */}
      {alert.show && (
        <div className={`alert alert-${alert.type}`}>
          {alert.message}
        </div>
      )}

      <div className="header-bg" />

      <div className="profile-container">
        <div className="details-box">
          <div className="section">
            <h3>Account Information</h3>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Full Name:</span>
                <span className="info-value">{currentUser.name}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Email:</span>
                <span className="info-value">{currentUser.email}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Account Type:</span>
                <span className="info-value capitalize">{currentUser.accountType}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Member ID:</span>
                <span className="info-value">
                  {currentUser.id ? currentUser.id.substring(0, 8) + '...' : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          <div className="section">
            <h3>Change Password</h3>
            <form onSubmit={handlePasswordSubmit} className="password-form">
              <div className="form-group">
                <label htmlFor="currentPassword">Current Password</label>
                <input
                  type="password"
                  id="currentPassword"
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      currentPassword: e.target.value,
                    })
                  }
                  required
                  placeholder="Enter current password"
                />
              </div>

              <div className="form-group">
                <label htmlFor="newPassword">New Password</label>
                <input
                  type="password"
                  id="newPassword"
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      newPassword: e.target.value,
                    })
                  }
                  required
                  placeholder="At least 8 characters"
                  minLength="8"
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      confirmPassword: e.target.value,
                    })
                  }
                  required
                  placeholder="Re-enter new password"
                />
              </div>

              <button type="submit" className="btn btn-primary">
                Update Password
              </button>
            </form>
          </div>

          <div className="section">
            <h3>Account Actions</h3>
            <div className="action-buttons">
              <button
                onClick={() => navigate(
                  currentUser.accountType === "host" 
                    ? "/dashboard" 
                    : "/history"
                )}
                className="btn btn-secondary"
              >
                {currentUser.accountType === "host" ? "View Dashboard" : "View History"}
              </button>
              
              {currentUser.accountType === "traveller" && (
                <button
                  onClick={() => navigate("/wishlist")}
                  className="btn btn-secondary"
                >
                  My Wishlist
                </button>
              )}
              
              <button
                onClick={() => navigate("/messages")}
                className="btn btn-secondary"
              >
                Messages
              </button>
              
              <button
                onClick={logout}
                className="btn btn-danger"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}