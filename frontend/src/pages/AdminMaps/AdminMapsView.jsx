import React, { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useParams } from "react-router-dom";

// Fix Leaflet icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png"
});

// ✅ Auto-zoom map to all markers or to searched markers
const FitBounds = ({ markers }) => {
  const map = useMap();

  useEffect(() => {
    if (!markers || markers.length === 0) return;

    const bounds = L.featureGroup(
      markers.map(m => L.marker([m.coordinates.lat, m.coordinates.lng]))
    );

    map.fitBounds(bounds.getBounds().pad(0.2));
  }, [markers, map]);

  return null;
};

// ✅ Small helper for popup sections
const Section = ({ label, value }) => (
  <div style={{ marginBottom: 6, fontSize: 13 }}>
    <strong>{label}: </strong>
    <span style={{ color: "#374151" }}>{value ?? "N/A"}</span>
  </div>
);

const AdminMapsView = () => {
  const { hostEmail } = useParams();

  const [rooms, setRooms] = useState([]);
  const [filteredRooms, setFilteredRooms] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 820 : false
  );

  const mapRef = useRef(null);

  // ---------- Handle screen resize ----------
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 820);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ---------- Fetch host rooms ----------
  useEffect(() => {
    if (!hostEmail) return;

    fetch(`http://localhost:3001/api/rooms/host/${hostEmail}`)
      .then(res => res.json())
      .then(data => {
        const dataRooms =
          Array.isArray(data) ? data : Array.isArray(data.rooms) ? data.rooms : [];

        setRooms(dataRooms);
        setFilteredRooms(dataRooms);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed fetching rooms:", err);
        setLoading(false);
      });
  }, [hostEmail]);

  // ---------- Search ----------
  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setFilteredRooms(rooms);
      return;
    }

    const lower = searchQuery.toLowerCase();
    const matched = rooms.filter(room =>
      room.title?.toLowerCase().includes(lower)
    );

    setFilteredRooms(matched);
  };

  // ---------- Valid coordinates ----------
  const validMarkers = filteredRooms.filter(
    r => r.coordinates?.lat && r.coordinates?.lng
  );

  // ---------- Loading ----------
  if (loading) {
    return <p style={{ textAlign: "center", marginTop: 20 }}>Loading rooms...</p>;
  }

  if (!rooms.length) {
    return (
      <p style={{ textAlign: "center", marginTop: 20 }}>
        No rooms found for this host.
      </p>
    );
  }

  // ---------- Inline Styles ----------
  const styles = {
    pageTitle: {
      textAlign: "center",
      background: "linear-gradient(90deg,#4e73df,#6f8afe)",
      color: "#fff",
      padding: "18px",
      fontFamily: "Inter, Poppins",
      fontWeight: 700,
      fontSize: "22px"
    },
    searchWrap: {
      margin: "18px auto",
      width: "90%",
      display: "flex",
      gap: 10,
      justifyContent: "center",
      flexDirection: isMobile ? "column" : "row"
    },
    searchInput: {
      flex: 1,
      padding: "12px 14px",
      borderRadius: "999px",
      border: "1px solid rgba(0,0,0,0.15)",
      fontSize: "14px"
    },
    searchBtn: {
      padding: "12px 18px",
      borderRadius: "10px",
      border: "none",
      cursor: "pointer",
      background: "linear-gradient(90deg,#10b981,#06b6d4)",
      color: "#fff",
      fontWeight: 700
    }
  };

  return (
    <div>
      <div style={styles.pageTitle}>Host Rooms Map</div>

      {/* ✅ Search UI */}
      <div style={styles.searchWrap}>
        <input
          type="text"
          placeholder="Search room by name..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSearch()}
          style={styles.searchInput}
        />

        <button style={styles.searchBtn} onClick={handleSearch}>
          Search
        </button>
      </div>

      {/* ✅ Map */}
      <MapContainer
        center={[20, 78]}
        zoom={5}
        whenCreated={map => (mapRef.current = map)}
        style={{
          height: "75vh",
          width: "90%",
          margin: "0 auto",
          borderRadius: "14px"
        }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {validMarkers.map(room => (
          <Marker
            key={room._id}
            position={[room.coordinates.lat, room.coordinates.lng]}
          >
            <Popup>
              {/* ✅ Scrollable popup */}
              <div
                style={{
                  maxHeight: isMobile ? "280px" : "380px",
                  overflowY: "auto",
                  padding: 14,
                  borderRadius: 10,
                  background: "#fff",
                  fontFamily: "Inter, Poppins",
                  width: isMobile ? "220px" : "320px"
                }}
              >
                {/* Sticky header */}
                <div
                  style={{
                    position: "sticky",
                    top: 0,
                    background: "#fff",
                    paddingBottom: 6,
                    marginBottom: 8,
                    borderBottom: "1px solid #eee",
                    zIndex: 2
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                    {room.title || "Untitled Room"}
                  </h3>
                </div>

                <Section label="Host Name" value={room.name} />
                <Section label="Host Email" value={room.email} />
                <Section label="Price" value={`₹${room.price}`} />
                <Section label="Location" value={room.location} />
                <Section
                  label="Coordinates"
                  value={`${room.coordinates.lat}, ${room.coordinates.lng}`}
                />
                <Section
                  label="Property"
                  value={`${room.propertyType} / ${room.roomType}`}
                />
                <Section label="Capacity" value={`${room.capacity} guests`} />
                <Section
                  label="Bedrooms / Beds"
                  value={`${room.bedrooms} / ${room.beds}`}
                />
                <Section label="Room Size" value={room.roomSize} />
                <Section label="Transport Distance" value={room.transportDistance} />
                <Section label="Host Gender" value={room.hostGender} />
                <Section label="Food Facility" value={room.foodFacility} />
                <Section
                  label="Amenities"
                  value={
                    room.amenities?.length
                      ? room.amenities.join(", ")
                      : "Not available"
                  }
                />
                <Section label="Discount" value={`${room.discount || 0}%`} />
                <Section label="Likes" value={room.likes || 0} />
                <Section label="Status" value={room.status} />
                <Section
                  label="Booking Enabled"
                  value={room.booking ? "Yes" : "No"}
                />
                <Section
                  label="Created"
                  value={new Date(room.createdAt).toLocaleDateString()}
                />

                {/* Reviews */}
                {room.reviews?.length > 0 && (
                  <>
                    <div style={{ marginTop: 10, fontWeight: 700 }}>
                      Reviews:
                    </div>
                    <ul style={{ marginLeft: 16, padding: 0 }}>
                      {room.reviews.map((r, i) => (
                        <li key={i} style={{ fontSize: 13 }}>
                          {r}
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {/* Images */}
                {room.images?.length > 0 && (
                  <div
                    style={{
                      marginTop: 10,
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill,minmax(70px,1fr))",
                      gap: 6
                    }}
                  >
                    {room.images.map(id => (
                      <img
                        key={id}
                        src={`/api/images/${id}`}
                        alt="Room"
                        style={{
                          width: "100%",
                          height: "60px",
                          borderRadius: 6,
                          border: "1px solid rgba(0,0,0,0.12)",
                          objectFit: "cover"
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* ✅ Auto-fit map */}
        <FitBounds markers={validMarkers} />
      </MapContainer>
    </div>
  );
};

export default AdminMapsView;
