import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const AdminMaps = () => {
  const [hosts, setHosts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 780 : false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 780);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Main function to fetch and process hosts with room counts
  const fetchHostsData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // First, fetch all hosts using the dedicated hosts endpoint
      const hostsResponse = await fetch('http://localhost:3001/api/hosts');
      
      if (!hostsResponse.ok) {
        throw new Error(`Failed to fetch hosts: ${hostsResponse.status}`);
      }
      
      const hostsData = await hostsResponse.json();
      console.log('Hosts API response:', hostsData);
      
      // Process hosts data - handle different response structures
      let hostsArray = [];
      
      if (Array.isArray(hostsData)) {
        // If response is directly an array
        hostsArray = hostsData;
      } else if (hostsData && Array.isArray(hostsData.hosts)) {
        // If response has a 'hosts' property that's an array
        hostsArray = hostsData.hosts;
      } else if (hostsData && Array.isArray(hostsData.data)) {
        // If response has a 'data' property that's an array
        hostsArray = hostsData.data;
      } else {
        console.warn('Unexpected hosts data structure:', hostsData);
      }
      
      console.log('Extracted hosts array:', hostsArray);
      
      // Filter to ensure we only have actual hosts
      // Based on backend, the /api/hosts endpoint should only return hosts
      // But we add an extra safety filter
      const filteredHosts = hostsArray.filter(host => {
        // Check if it's a host based on available fields
        const isHost = 
          host.accountType === 'host' ||
          host.role === 'host' ||
          host.userType === 'host' ||
          // If no accountType field but from /api/hosts endpoint, assume it's a host
          (!host.accountType && !host.role && !host.userType);
        
        if (!isHost) {
          console.log('Filtered out non-host:', host);
        }
        
        return isHost;
      });
      
      console.log('Filtered hosts:', filteredHosts);
      
      // Now fetch rooms to calculate room counts
      const roomsResponse = await fetch('http://localhost:3001/api/rooms');
      
      if (!roomsResponse.ok) {
        throw new Error(`Failed to fetch rooms: ${roomsResponse.status}`);
      }
      
      const roomsData = await roomsResponse.json();
      console.log('Rooms API response:', roomsData);
      
      // Process rooms data
      let roomsArray = [];
      
      if (Array.isArray(roomsData)) {
        roomsArray = roomsData;
      } else if (roomsData && Array.isArray(roomsData.data)) {
        roomsArray = roomsData.data;
      }
      
      console.log('Total rooms found:', roomsArray.length);
      
      // Calculate room count for each host by matching email
      const hostsWithRoomCounts = filteredHosts.map(host => {
        const hostEmail = host.email || host.userEmail;
        
        if (!hostEmail) {
          console.warn('Host missing email:', host);
          return {
            ...host,
            _id: host._id || host.id || `host-${Date.now()}-${Math.random()}`,
            name: host.name || 'Unknown Host',
            email: '',
            roomCount: 0
          };
        }
        
        // Calculate room count by matching host email with room email
        const roomCount = roomsArray.filter(room => {
          const roomEmail = room.email || room.hostEmail || room.ownerEmail;
          
          if (!roomEmail) return false;
          
          // Case-insensitive email comparison
          return roomEmail.toLowerCase().trim() === hostEmail.toLowerCase().trim();
        }).length;
        
        console.log(`Host ${host.name} (${hostEmail}) has ${roomCount} rooms`);
        
        return {
          ...host,
          _id: host._id || host.id || `host-${Date.now()}-${Math.random()}`,
          name: host.name || 'Unknown Host',
          email: hostEmail,
          roomCount: roomCount || host.roomCount || 0
        };
      });
      
      // Sort hosts by room count (descending) for better display
      const sortedHosts = hostsWithRoomCounts.sort((a, b) => b.roomCount - a.roomCount);
      
      console.log('Final hosts with room counts:', sortedHosts);
      setHosts(sortedHosts);
      
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message);
      
      // Fallback: Try alternative endpoint if main one fails
      try {
        console.log('Trying fallback endpoint...');
        const fallbackResponse = await fetch('http://localhost:3001/api/users?accountType=host');
        
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          
          let fallbackArray = [];
          if (Array.isArray(fallbackData)) {
            fallbackArray = fallbackData;
          } else if (fallbackData && Array.isArray(fallbackData.data)) {
            fallbackArray = fallbackData.data;
          }
          
          // Provide hosts with 0 room counts as fallback
          const fallbackHosts = fallbackArray.map(host => ({
            ...host,
            _id: host._id || host.id || `host-${Date.now()}-${Math.random()}`,
            name: host.name || 'Unknown Host',
            email: host.email || '',
            roomCount: 0
          }));
          
          setHosts(fallbackHosts);
          setError('Could not fetch room counts, but loaded hosts. ' + err.message);
        }
      } catch (fallbackErr) {
        console.error('Fallback also failed:', fallbackErr);
        setHosts([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHostsData();
  }, []);

  // Filter hosts by search term
  const filteredHosts = hosts.filter(host =>
    (host.name ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (host.email ?? '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ---------- Inline styles (scoped) ----------
  const styles = {
    container: {
      maxWidth: 1150,
      margin: '32px auto',
      padding: 18,
      fontFamily: '"Inter", "Poppins", sans-serif',
      color: '#111827'
    },
    title: {
      fontSize: isMobile ? 20 : 26,
      fontWeight: 700,
      marginBottom: 18,
      textAlign: 'center',
      color: '#1f2937'
    },
    searchSection: {
      display: 'flex',
      justifyContent: 'center',
      marginBottom: 18
    },
    pillInput: {
      width: isMobile ? '100%' : 340,
      padding: '12px 18px',
      borderRadius: 999,
      border: '1px solid rgba(15,23,42,0.08)',
      fontSize: 14,
      outline: 'none',
      boxShadow: '0 6px 18px rgba(2,6,23,0.04)',
      transition: 'all 0.3s ease'
    },
    pillInputFocus: {
      boxShadow: '0 6px 18px rgba(2,6,23,0.1)',
      borderColor: '#4e73df'
    },
    tableWrap: {
      overflowX: 'auto',
      borderRadius: 12,
      boxShadow: '0 10px 30px rgba(2,6,23,0.06)',
      background: 'white',
      marginTop: 20
    },
    table: {
      width: '100%',
      minWidth: 640,
      borderCollapse: 'collapse'
    },
    thead: {
      background: 'linear-gradient(90deg,#4e73df,#6f8afe)',
      color: '#fff'
    },
    th: {
      padding: '14px 18px',
      textAlign: 'left',
      fontSize: 14,
      letterSpacing: 0.2,
      fontWeight: 600
    },
    td: {
      padding: '12px 18px',
      borderBottom: '1px solid rgba(15,23,42,0.04)',
      fontSize: 14,
      color: '#374151'
    },
    trHover: {
      transition: 'background 0.18s',
    },
    btnView: {
      background: 'linear-gradient(90deg,#10b981,#06b6d4)',
      color: 'white',
      padding: '8px 12px',
      borderRadius: 8,
      border: 'none',
      cursor: 'pointer',
      fontWeight: 600,
      boxShadow: '0 8px 20px rgba(16,185,129,0.12)',
      transition: 'all 0.2s ease',
      fontSize: 13
    },
    btnViewHover: {
      transform: 'translateY(-1px)',
      boxShadow: '0 10px 25px rgba(16,185,129,0.2)'
    },
    emptyMsg: {
      textAlign: 'center',
      padding: 22,
      color: '#6b7280',
      fontSize: 15
    },
    mobileCard: {
      background: 'white',
      borderRadius: 12,
      padding: 14,
      marginBottom: 12,
      boxShadow: '0 8px 22px rgba(2,6,23,0.06)',
      transition: 'transform 0.2s ease'
    },
    mobileCardHover: {
      transform: 'translateY(-2px)',
      boxShadow: '0 12px 28px rgba(2,6,23,0.1)'
    },
    mobileRow: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: 8
    },
    label: { 
      fontWeight: 700, 
      color: '#111827',
      fontSize: 13,
      marginBottom: 2
    },
    value: { 
      color: '#374151',
      fontSize: 14
    },
    loading: {
      textAlign: 'center',
      padding: 40,
      color: '#6b7280',
      fontSize: 16
    },
    errorContainer: {
      background: '#fee',
      border: '1px solid #fcc',
      borderRadius: 8,
      padding: 15,
      marginBottom: 20,
      color: '#c00'
    },
    errorTitle: {
      fontWeight: 600,
      marginBottom: 5
    },
    retryButton: {
      background: '#4e73df',
      color: 'white',
      border: 'none',
      padding: '8px 16px',
      borderRadius: 6,
      cursor: 'pointer',
      marginTop: 10,
      fontSize: 13
    },
    statsBar: {
      display: 'flex',
      justifyContent: 'space-between',
      background: '#f8fafc',
      padding: '12px 18px',
      borderRadius: 8,
      marginBottom: 20,
      border: '1px solid #e2e8f0'
    },
    statItem: {
      textAlign: 'center'
    },
    statValue: {
      fontSize: 20,
      fontWeight: 700,
      color: '#4e73df'
    },
    statLabel: {
      fontSize: 12,
      color: '#64748b',
      marginTop: 2
    },
    roomCountBadge: {
      display: 'inline-block',
      padding: '4px 10px',
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 600
    },
    roomCountMany: {
      background: '#d1fae5',
      color: '#065f46'
    },
    roomCountSome: {
      background: '#fef3c7',
      color: '#92400e'
    },
    roomCountNone: {
      background: '#f3f4f6',
      color: '#6b7280'
    }
  };

  // Calculate statistics
  const totalHosts = hosts.length;
  const totalRooms = hosts.reduce((sum, host) => sum + (host.roomCount || 0), 0);
  const hostsWithRooms = hosts.filter(host => (host.roomCount || 0) > 0).length;

  // Get room count badge style
  const getRoomCountStyle = (count) => {
    if (count >= 5) return { ...styles.roomCountBadge, ...styles.roomCountMany };
    if (count >= 1) return { ...styles.roomCountBadge, ...styles.roomCountSome };
    return { ...styles.roomCountBadge, ...styles.roomCountNone };
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>Hosts Management</h1>
        <p style={styles.loading}>Loading hosts and room data...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Hosts Management</h1>

      {error && (
        <div style={styles.errorContainer}>
          <div style={styles.errorTitle}>Warning</div>
          <div>{error}</div>
          <button 
            style={styles.retryButton}
            onClick={fetchHostsData}
          >
            Retry Loading Data
          </button>
        </div>
      )}

      {/* Statistics Bar */}
      <div style={styles.statsBar}>
        <div style={styles.statItem}>
          <div style={styles.statValue}>{totalHosts}</div>
          <div style={styles.statLabel}>Total Hosts</div>
        </div>
        <div style={styles.statItem}>
          <div style={styles.statValue}>{totalRooms}</div>
          <div style={styles.statLabel}>Total Rooms</div>
        </div>
        <div style={styles.statItem}>
          <div style={styles.statValue}>{hostsWithRooms}</div>
          <div style={styles.statLabel}>Hosts with Rooms</div>
        </div>
      </div>

      <div style={styles.searchSection}>
        <input
          type="text"
          style={styles.pillInput}
          placeholder="Search hosts by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={(e) => e.target.style = { ...styles.pillInput, ...styles.pillInputFocus }}
          onBlur={(e) => e.target.style = styles.pillInput}
          aria-label="Search hosts by name or email"
        />
      </div>

      {filteredHosts.length > 0 ? (
        // Desktop/table view for larger screens
        !isMobile ? (
          <div style={styles.tableWrap}>
            <table style={styles.table} role="table" aria-label="Hosts table">
              <thead style={styles.thead}>
                <tr>
                  <th style={styles.th}>Host Name</th>
                  <th style={styles.th}>Email</th>
                  <th style={styles.th}>No. of Rooms</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredHosts.map(host => (
                  <tr
                    key={host._id}
                    style={styles.trHover}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(240,245,255,0.6)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={styles.td}>
                      <div style={{ fontWeight: 500 }}>{host.name}</div>
                    </td>
                    <td style={styles.td}>
                      <div style={{ color: '#4b5563', fontSize: 13 }}>{host.email || 'N/A'}</div>
                    </td>
                    <td style={styles.td}>
                      <span style={getRoomCountStyle(host.roomCount)}>
                        {host.roomCount || 0} rooms
                      </span>
                    </td>
                    <td style={styles.td}>
                      <button
                        style={styles.btnView}
                        onClick={() => navigate(`/admin/maps/${encodeURIComponent(host.email)}`)}
                        onMouseEnter={e => e.target.style = { ...styles.btnView, ...styles.btnViewHover }}
                        onMouseLeave={e => e.target.style = styles.btnView}
                        aria-label={`View map for ${host.name}`}
                      >
                        View Map
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          // Mobile card view
          <div>
            {filteredHosts.map((host, index) => (
              <div 
                key={host._id} 
                style={styles.mobileCard}
                onMouseEnter={e => e.currentTarget.style = { ...styles.mobileCard, ...styles.mobileCardHover }}
                onMouseLeave={e => e.currentTarget.style = styles.mobileCard}
              >
                <div style={styles.mobileRow}>
                  <div>
                    <div style={styles.label}>Host</div>
                    <div style={styles.value}>{host.name}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={styles.label}>Rooms</div>
                    <div style={styles.value}>
                      <span style={getRoomCountStyle(host.roomCount)}>
                        {host.roomCount || 0}
                      </span>
                    </div>
                  </div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <div style={styles.label}>Email</div>
                  <div style={{ ...styles.value, fontSize: 13 }}>{host.email || 'N/A'}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                  <button
                    style={styles.btnView}
                    onClick={() => navigate(`/admin/maps/${encodeURIComponent(host.email)}`)}
                    onMouseEnter={e => e.target.style = { ...styles.btnView, ...styles.btnViewHover }}
                    onMouseLeave={e => e.target.style = styles.btnView}
                    aria-label={`View map for ${host.name}`}
                  >
                    View Map
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div style={styles.emptyMsg}>
          {searchTerm ? 'No hosts match your search.' : 'No hosts found.'}
        </div>
      )}
    </div>
  );
};

export default AdminMaps;