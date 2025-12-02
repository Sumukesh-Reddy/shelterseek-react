import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './host_index.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser } from '@fortawesome/free-solid-svg-icons';
import Footer from '../../components/Footer/Footer';

// Fix Leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const MapUpdater = ({ latitude, longitude, setFormData }) => {
  const map = useMap();

  const handleMapClick = useCallback(
    (e) => {
      const lat = e.latlng.lat.toFixed(5);
      const lng = e.latlng.lng.toFixed(5);
      setFormData((prev) => ({
        ...prev,
        latitude: lat,
        longitude: lng,
      }));
    },
    [setFormData]
  );

  useEffect(() => {
    if (latitude && longitude && !isNaN(latitude) && !isNaN(longitude)) {
      map.setView([parseFloat(latitude), parseFloat(longitude)], 13);
    }
  }, [latitude, longitude, map]);

  useEffect(() => {
    map.on('click', handleMapClick);
    return () => map.off('click', handleMapClick);
  }, [map, handleMapClick]);

  return null;
};

const HostIndex = () => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    location: '',
    latitude: '',
    longitude: '',
    maxdays: '',
    propertyType: '',
    capacity: '',
    roomType: '',
    bedrooms: '',
    beds: '',
    roomSize: '',
    roomLocation: '',
    transportDistance: '',
    hostGender: '',
    foodFacility: '',
    amenities: [],
    discount: 0,
    images: [],
    existingImages: [],
    unavailableDates: [],
  });

  const [previewImages, setPreviewImages] = useState([]);
  const [removedImageIds, setRemovedImageIds] = useState([]);
  const [processedFiles, setProcessedFiles] = useState(new Set());
  const [listingId, setListingId] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const mediaInputRef = useRef(null);
  const uploadContainerRef = useRef(null);

  const slides = ['/images/photo1.jpg', '/images/photo2.jpg', '/images/photo3.jpg', '/images/photo4.jpg'];
  const [currentSlide, setCurrentSlide] = useState(0);

  const API_BASE_URL = 'http://localhost:3001';

  // Get current user from localStorage
  const getCurrentUser = () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  };

  // 1. Handle Edit Mode (on mount)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('listingId');
    if (id) {
      setListingId(id);
      fetchListing(id);
    }
  }, []);

  // 2. Auto-detect location (only if not editing and no lat)
  useEffect(() => {
    if (!listingId && !formData.latitude && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude.toFixed(5);
          const lng = position.coords.longitude.toFixed(5);
          setFormData((prev) => ({
            ...prev,
            latitude: lat,
            longitude: lng,
          }));
        },
        () => {
          alert('Location access denied. Click map or enter coordinates manually.');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, [listingId, formData.latitude]);

  // 3. Slider interval
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [slides.length]);

  const fetchListing = async (id) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/listings/${id}`);
      const listing = response.data.data.listing;
      const newFormData = {
        title: listing.title || '',
        description: listing.description || '',
        price: listing.price || '',
        location: listing.location || '',
        latitude: listing.coordinates?.lat || '',
        longitude: listing.coordinates?.lng || '',
        maxdays: listing.maxdays || '',
        propertyType: listing.propertyType || '',
        capacity: listing.capacity || '',
        roomType: listing.roomType || '',
        bedrooms: listing.bedrooms || '',
        beds: listing.beds || '',
        roomSize: listing.roomSize || '',
        roomLocation: listing.roomLocation || '',
        transportDistance: listing.transportDistance || '',
        hostGender: listing.hostGender || '',
        foodFacility: listing.foodFacility || '',
        amenities: listing.amenities || [],
        discount: listing.discount || 0,
        images: [],
        existingImages: listing.images || [],
        unavailableDates: listing.unavailableDates 
  ? listing.unavailableDates.map(date => 
      typeof date === 'string' ? date : new Date(date).toISOString().split('T')[0]
    )
  : [],

      };
      setFormData(newFormData);

      // Load existing image previews
      const existingPreviews = listing.images.map((imgId) => ({
        id: imgId,
        url: `${API_BASE_URL}/api/images/${imgId}`,
        type: 'existing',
      }));
      setPreviewImages(existingPreviews);

      // Render existing images to DOM preview container
      // Use setTimeout to ensure DOM is ready
      setTimeout(() => {
        const container = document.getElementById('media-preview');
        if (container && listing.images && listing.images.length > 0) {
          // Only clear if we don't have existing images already rendered
          const hasExistingImages = container.querySelectorAll('[data-image-id]').length > 0;
          if (!hasExistingImages) {
            container.innerHTML = ''; // Clear container only if no existing images
          }
          
          // Add existing images, but skip if they already exist in DOM
          listing.images.forEach((imgId) => {
            // Check if this image is already in the DOM
            const existingDiv = container.querySelector(`[data-image-id="${imgId}"]`);
            if (existingDiv) {
              return; // Skip if already rendered
            }

            const div = document.createElement('div');
            div.className = 'preview-item';
            div.setAttribute('data-image-id', imgId);

            const img = document.createElement('img');
            img.src = `${API_BASE_URL}/api/images/${imgId}`;
            img.className = 'preview-image';
            img.alt = 'Existing image';
            img.onerror = () => {
              console.error('Failed to load image:', imgId);
            };
            div.appendChild(img);

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-image';
            removeBtn.innerHTML = '×';
            removeBtn.onclick = () => {
              div.remove();
              setPreviewImages((prev) => prev.filter((p) => p.id !== imgId));
              setRemovedImageIds((prev) => [...prev, imgId]);
              setFormData((prev) => ({
                ...prev,
                existingImages: prev.existingImages.filter((id) => id !== imgId),
              }));
            };
            div.appendChild(removeBtn);
            container.appendChild(div);
          });
        }
      }, 100);
    } catch (err) {
      console.error('Failed to load listing:', err);
      alert('Failed to load listing for editing');
    }
  };
// Handle host unavailable date changes
const handleUnavailableChange = (dates) => {
  setFormData((prev) => ({
    ...prev,
    unavailableDates: dates,
  }));
};


  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      setFormData((prev) => {
        const amenities = checked
          ? [...prev.amenities, value]
          : prev.amenities.filter((item) => item !== value);
        return { ...prev, amenities };
      });
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleMediaUpload = useCallback(
    (files) => {
      const newProcessed = new Set(processedFiles);
      const newFiles = [];

      Array.from(files).forEach((file) => {
        const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
        if (!newProcessed.has(fileKey)) {
          newProcessed.add(fileKey);
          newFiles.push(file);

          const reader = new FileReader();
          reader.onload = (e) => {
            const url = e.target.result;
            if (!previewImages.some((img) => img.url === url)) {
              const previewItem = {
                file,
                url,
                type: 'new',
              };
              setPreviewImages((prev) => [...prev, previewItem]);

              // Add to DOM preview
              const container = document.getElementById('media-preview');
              if (!container) return;
              
              const div = document.createElement('div');
              div.className = 'preview-item';
              div.setAttribute('data-file-name', file.name);
              div.setAttribute('data-new-image', 'true');

              if (file.type.startsWith('image/')) {
                const img = document.createElement('img');
                img.src = url;
                img.className = 'preview-image';
                img.alt = 'New image';
                div.appendChild(img);
              } else if (file.type.startsWith('video/')) {
                const video = document.createElement('video');
                video.src = url;
                video.controls = true;
                video.className = 'preview-video';
                div.appendChild(video);
              }

              const removeBtn = document.createElement('button');
              removeBtn.className = 'remove-image';
              removeBtn.innerHTML = '×';
              removeBtn.onclick = () => {
                div.remove();
                setPreviewImages((prev) => prev.filter((p) => {
                  // Remove if it's this new image (by file or URL)
                  if (p.file === file || (p.url === url && p.type === 'new')) {
                    return false;
                  }
                  return true;
                }));
                setFormData((prev) => ({
                  ...prev,
                  images: prev.images.filter((f) => f !== file),
                }));
              };
              div.appendChild(removeBtn);
              // Append to container - DO NOT clear existing content
              container.appendChild(div);
            }
          };
          reader.readAsDataURL(file);
        }
      });

      setProcessedFiles(newProcessed);
      setFormData((prev) => ({ ...prev, images: [...prev.images, ...newFiles] }));
    },
    [processedFiles, previewImages]
  );

  useEffect(() => {
    const container = uploadContainerRef.current;
    if (!container) return;

    const handleDragOver = (e) => {
      e.preventDefault();
      container.classList.add('dragover');
    };
    const handleDragLeave = (e) => {
      e.preventDefault();
      container.classList.remove('dragover');
    };
    const handleDrop = (e) => {
      e.preventDefault();
      container.classList.remove('dragover');
      handleMediaUpload(e.dataTransfer.files);
    };

    container.addEventListener('dragover', handleDragOver);
    container.addEventListener('dragleave', handleDragLeave);
    container.addEventListener('drop', handleDrop);

    return () => {
      container.removeEventListener('dragover', handleDragOver);
      container.removeEventListener('dragleave', handleDragLeave);
      container.removeEventListener('drop', handleDrop);
    };
  }, [handleMediaUpload]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const currentUser = getCurrentUser();
    if (!currentUser) {
      alert('You must be logged in to submit a listing.');
      return;
    }

    const data = new FormData();

    // Append currentUser as JSON string
    data.append('currentUser', JSON.stringify(currentUser));

    // Append all form fields
    Object.keys(formData).forEach((key) => {
      if (key === 'amenities') {
        data.append(key, formData.amenities.join(','));
      } else if (key === 'images') {
        formData.images.forEach((file) => {
          data.append('images', file);
        });
      } else if (key === 'unavailableDates') {
        // Append unavailable dates as JSON array string
        data.append(key, JSON.stringify(formData.unavailableDates || []));
      }
       else if (key !== 'existingImages') {
        data.append(key, formData[key] || '');
      }
    });

    // Append removed image IDs
    if (removedImageIds.length > 0) {
      data.append('removedImages', removedImageIds.join(','));
    }

    try {
      const url = listingId
        ? `${API_BASE_URL}/api/listings/${listingId}`
        : `${API_BASE_URL}/api/listings`;

      const method = listingId ? 'put' : 'post';

      await axios({
        method,
        url,
        data,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      alert(listingId ? 'Listing updated successfully!' : 'Listing created successfully!');
      window.location.href = '/host_index';
    } catch (err) {
      console.error('Submit error:', err.response?.data || err);
      alert('Failed to save listing. Please try again.');
    }
  };

  const toggleMenu = () => setIsMenuOpen((prev) => !prev);
  const closeMenu = () => setIsMenuOpen(false);
  const scrollToForm = () => {
    document.querySelector('.form-container')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      {/* Navbar */}
      <div className="host-top-navbar">
        <div className="host-logo">
          <h2>ShelterSeek</h2>
        </div>
        
        <button className="host-traveler" onClick={toggleMenu}>
          <FontAwesomeIcon icon={faUser} />
        </button>

        {isMenuOpen && (
          <div className="host-user-menu host-open">
            <button className="host-user-close-btn" onClick={closeMenu}>
              ×
            </button>
            <ul>
              <li><a href="/dashboard">Dashboard</a></li>
              <li><a href="/logout">Logout</a></li>
            </ul>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="container">
        <div className="slider-container">
          <div className="slider">
            {slides.map((slide, i) => (
              <div
                key={i}
                className={`slide ${i === currentSlide ? 'active' : ''}`}
                style={{ backgroundImage: `url(${slide})` }}
              />
            ))}
          </div>

          <div className="text-section">
            <h1>Welcome to ShelterSeek</h1>
            <p>Find and list safe and affordable stays for travelers. Our platform ensures security and comfort for all users.</p>
            <button className="get-started-btn" onClick={scrollToForm}>
              Get Started
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="form-container">
          <form onSubmit={handleSubmit}>
            <h2>{listingId ? 'Edit Listing' : 'Create Listing'}</h2>

            <div className="form-group">
              <label>Title</label>
              <input type="text" name="title" value={formData.title} onChange={handleChange} required />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea name="description" value={formData.description} onChange={handleChange} required />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Price per Night</label>
                <input type="number" name="price" value={formData.price} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>Maximum Stay (days)</label>
                <input type="number" name="maxdays" value={formData.maxdays} onChange={handleChange} required />
              </div>
            </div>

            <div className="form-group">
              <label>Location (Address)</label>
              <input type="text" name="location" value={formData.location} onChange={handleChange} required />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Latitude</label>
                <input
                  type="number"
                  name="latitude"
                  value={formData.latitude}
                  onChange={handleChange}
                  step="0.00001"
                  placeholder="Auto-detected"
                  required
                />
              </div>
              <div className="form-group">
                <label>Longitude</label>
                <input
                  type="number"
                  name="longitude"
                  value={formData.longitude}
                  onChange={handleChange}
                  step="0.00001"
                  placeholder="Auto-detected"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Property Type</label>
              <select name="propertyType" value={formData.propertyType} onChange={handleChange} required>
                <option value="">Select Type</option>
                {['PG', 'House', 'Resort', 'Villa', 'Duplex', 'Cottage', 'Apartment', 'Hostel', 'Farm House', 'Other'].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Capacity</label>
                <input type="number" name="capacity" value={formData.capacity} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>Room Type</label>
                <select name="roomType" value={formData.roomType} onChange={handleChange} required>
                  <option value="">Select</option>
                  <option value="Any">Any</option>
                  <option value="Shared">Shared</option>
                  <option value="Full">Full</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Bedrooms</label>
                <input type="number" name="bedrooms" value={formData.bedrooms} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>Beds</label>
                <input type="number" name="beds" value={formData.beds} onChange={handleChange} required />
              </div>
            </div>

            <div className="form-group">
              <label>Room Size</label>
              <select name="roomSize" value={formData.roomSize} onChange={handleChange} required>
                <option value="">Select</option>
                <option value="Small">Small</option>
                <option value="Medium">Medium</option>
                <option value="Large">Large</option>
              </select>
            </div>

            <div className="form-group">
              <label>Room Location</label>
              <div className="radio-group">
                {['In Town', 'Outside of Town', 'Nearby Villages', 'Residential Area', 'Commercial Area', 'Near Highway', 'Country Side'].map((opt) => (
                  <label key={opt}>
                    <input type="radio" name="roomLocation" value={opt} checked={formData.roomLocation === opt} onChange={handleChange} /> {opt}
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Near Transport</label>
              <div className="radio-group">
                {['Within 2km', 'Within 5km', 'Within 10km'].map((opt) => (
                  <label key={opt}>
                    <input type="radio" name="transportDistance" value={opt} checked={formData.transportDistance === opt} onChange={handleChange} /> {opt}
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Host Gender</label>
              <div className="radio-group">
                {['Male', 'Female'].map((g) => (
                  <label key={g}>
                    <input type="radio" name="hostGender" value={g} checked={formData.hostGender === g} onChange={handleChange} /> {g}
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Food Facility</label>
              <div className="radio-group">
                {['Not Available', 'Vegetarian', 'Non-Vegetarian', 'Both'].map((f) => (
                  <label key={f}>
                    <input type="radio" name="foodFacility" value={f} checked={formData.foodFacility === f} onChange={handleChange} /> {f}
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Amenities</label>
              <div className="checkbox-group">
                {['WiFi', 'Air Conditioning', 'Laundry', 'Hot Water', 'Lift', 'Free Car Parking', 'EV Charging'].map((a) => (
                  <label key={a}>
                    <input type="checkbox" name="amenities" value={a} checked={formData.amenities.includes(a)} onChange={handleChange} /> {a}
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Discount (%)</label>
              <input type="range" name="discount" min="0" max="100" value={formData.discount} onChange={handleChange} />
              <span>{formData.discount}%</span>
            </div>

            <div className="form-group">
              <label>Upload Photos & Videos</label>
              <div className="upload-container" ref={uploadContainerRef}>
                <div className="upload-area">
                  <span className="home-icon">Home</span>
                  <div className="upload-text">
                    <label htmlFor="media" className="upload-label">
                      Upload files
                      <input
                        type="file"
                        id="media"
                        multiple
                        accept="image/*,video/*"
                        className="file-input"
                        ref={mediaInputRef}
                        onChange={(e) => handleMediaUpload(e.target.files)}
                      />
                    </label>
                    <span>or drag and drop</span>
                  </div>
                  <p className="upload-hint">PNG, JPG, GIF, MP4 up to 50MB</p>
                </div>
              </div>
              {listingId && formData.existingImages && formData.existingImages.length > 0 && (
                <div style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: 600, color: '#FF69B4', marginBottom: '0.5rem' }}>
                    Existing Images
                  </h4>
                  <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>
                    {formData.existingImages.length} image(s) - Click × to remove
                  </p>
                </div>
              )}
              <div id="media-preview" className="image-preview"></div>
            </div>

            <div className="form-group">
            <label>Host Unavailable Days</label>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>
              Select the dates when you are <strong>not available</strong> to host
              (next 3 months).
            </p>
            <unavailableDatesCalendar
              selectedDates={formData.unavailableDates}
              onDatesChange={handleUnavailableChange}
              minDate={new Date()}
              maxDate={(() => {
                const date = new Date();
                date.setMonth(date.getMonth() + 3);
                return date;
              })()}
            />
          </div>


            <div className="form-group">
              <label>Location Map (Click to set)</label>
              {formData.latitude && formData.longitude ? (
                <MapContainer
                  center={[parseFloat(formData.latitude), parseFloat(formData.longitude)]}
                  zoom={13}
                  style={{ height: '400px', width: '100%', borderRadius: '12px' }}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[parseFloat(formData.latitude), parseFloat(formData.longitude)]} />
                  <MapUpdater latitude={formData.latitude} longitude={formData.longitude} setFormData={setFormData} />
                </MapContainer>
              ) : (
                <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ height: '400px', borderRadius: '12px' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <MapUpdater latitude={formData.latitude} longitude={formData.longitude} setFormData={setFormData} />
                </MapContainer>
              )}
            </div>

            <button type="submit" className="submit-button">
              {listingId ? 'Update Listing' : 'Submit Listing'}
            </button>
          </form>
        </div>
      </div>

      <Footer />
    </>
  );
};

export default HostIndex;