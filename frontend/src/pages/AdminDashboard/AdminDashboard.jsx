import React, { useEffect, useState } from 'react';
import AdminNavbar from '../../components/AdminNavbar/navbar';

// Reference to uploaded screenshot (local path)
const screenshotPreview = "/mnt/data/c56974f5-ce0d-4736-9c97-c5522b9dc752.png";

function AdminDashboard() {
  // data state
  const [totalBookings, setTotalBookings] = useState(0);
  const [thisMonthBookings, setThisMonthBookings] = useState(0);
  const [thisWeekBookings, setThisWeekBookings] = useState(0);
  const [newCustomers, setNewCustomers] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [totalRevenue, setTotalRevenue] = useState(0.0);
  const [thisMonthRevenue, setThisMonthRevenue] = useState(0.0);
  const [thisWeekRevenue, setThisWeekRevenue] = useState(0.0);
  const [bookings, setBookings] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // responsive helper
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 900 : false
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // fetch data (unchanged)
  useEffect(() => {
    fetch('http://localhost:3001/api/bookings')
      .then(res => res.json())
      .then(response => {
        if (Array.isArray(response)) setBookings(response);
        else if (Array.isArray(response.data)) setBookings(response.data);
        else setBookings([]);
      })
      .catch(() => setBookings([]));

     fetch('http://localhost:3001/api/bookings/summarys')
    .then(res => res.json())
    .then(response => {
      console.log('Booking summary response:', response); // Debug log
      if (response.success && Array.isArray(response.bookings)) {
        setBookings(response.bookings);
      } else {
        console.error('Invalid booking summary response:', response);
        setBookings([]);
      }
    })
    .catch(err => {
      console.error('Error fetching booking summary:', err);
      setBookings([]);
    });

    fetch('http://localhost:3001/api/new-customers')
      .then(res => res.json())
      .then(result => {
        if (Array.isArray(result?.data)) setNewCustomers(result.data);
        else if (Array.isArray(result)) setNewCustomers(result);
        else setNewCustomers([]);
      })
      .catch(() => setNewCustomers([]));

    fetch('http://localhost:3001/api/recent-activities')
      .then(res => res.json())
      .then(result => {
        if (Array.isArray(result?.data)) setRecentActivities(result.data);
        else if (Array.isArray(result)) setRecentActivities(result);
        else setRecentActivities([]);
      })
      .catch(() => setRecentActivities([]));

    fetch('http://localhost:3001/api/revenue')
      .then(res => res.json())
      .then(data => {
        if (data) {
          setTotalRevenue(data.totalRevenue ?? 0);
          setThisMonthRevenue(data.thisMonthRevenue ?? 0);
          setThisWeekRevenue(data.thisWeekRevenue ?? 0);
        }
      })
      .catch(() => {});

    fetch('http://localhost:3001/api/bookings/summary')
      .then(res => res.json())
      .then(data => {
        if (data) {
          setTotalBookings(data.total ?? 0);
          setThisMonthBookings(data.thisMonth ?? 0);
          setThisWeekBookings(data.thisWeek ?? 0);
        }
      })
      .catch(() => {});
  }, []);

  const filteredBookings = bookings.filter(b =>
    (b.userName ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (b._id ?? '').toString().includes(searchTerm)
  );

  // ---------- New stylish palette + inline styles ----------
  // Palette: deep navy text, soft glass cards, teal->purple gradient accent
  const accentGradient = 'linear-gradient(90deg,#15b7a6,#7a3ff5)'; // teal -> purple
  const subtleGlass = 'linear-gradient(180deg, rgba(255,255,255,0.66), rgba(255,255,255,0.5))';

  const styles = {
    pageShell: {
      background: 'linear-gradient(135deg,#f4fbff 0%, #f0f4ff 100%)',
      minHeight: '100vh',
      width: '100%',
      paddingTop: 12,
      boxSizing: 'border-box',
      fontFamily: '"Inter","Poppins", system-ui, -apple-system, "Segoe UI", Roboto, Arial',
      color: '#06223a'
    },

    // full-width wrapper trick (edge-to-edge)
    fullWidthWrapper: {
      width: '100vw',
      marginLeft: 'calc(50% - 50vw)',
      marginRight: 'calc(50% - 50vw)',
      boxSizing: 'border-box'
    },

    titleRow: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: isMobile ? '12px 18px' : '18px 48px'
    },
    sectionTitle: {
      fontSize: isMobile ? 20 : 28,
      fontWeight: 900,
      margin: 0,
      color: '#061526',
      letterSpacing: '-0.2px'
    },
    titleAccent: {
      width: 60,
      height: 8,
      borderRadius: 6,
      background: accentGradient,
      display: 'inline-block',
      boxShadow: '0 6px 18px rgba(122,63,245,0.12)'
    },

    overviewRow: {
      display: 'flex',
      gap: isMobile ? 18 : 36,
      flexWrap: isMobile ? 'wrap' : 'nowrap',
      alignItems: 'stretch',
      justifyContent: 'space-between',
      padding: isMobile ? '0 18px' : '0 48px',
      boxSizing: 'border-box'
    },

    overviewCard: {
      background: subtleGlass,
      backdropFilter: 'saturate(140%) blur(6px)',
      borderRadius: 18,
      boxShadow: '0 30px 80px rgba(9,20,46,0.06), inset 0 1px 0 rgba(255,255,255,0.6)',
      border: '1px solid rgba(10,30,60,0.04)',
      flex: isMobile ? '1 1 100%' : '0 0 calc(50% - 18px)',
      height: isMobile ? 440 : 640,
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      padding: isMobile ? '30px 22px' : '64px 54px',
      boxSizing: 'border-box',
      color: '#072032'
    },

    // decorative corner glow using gradient (top left to top right but softer)
    accentStripeTop: {
      position: 'absolute',
      top: 8,
      left: 8,
      right: 8,
      height: 12,
      borderRadius: 10,
      background: accentGradient,
      opacity: 0.95,
      boxShadow: '0 8px 30px rgba(122,63,245,0.14)'
    },

    cardTitle: {
      fontSize: isMobile ? 14 : 16,
      letterSpacing: 3,
      textTransform: 'uppercase',
      fontWeight: 900,
      color: '#0b2433',
      marginBottom: isMobile ? 14 : 20,
      textAlign: 'center'
    },

    mainNumber: {
      fontSize: isMobile ? 48 : 88,
      fontWeight: 900,
      color: '#0e6b60', // deep teal
      margin: '6px 0',
      textAlign: 'center',
      lineHeight: 1
    },

    metaLine: {
      fontSize: isMobile ? 18 : 26,
      fontWeight: 800,
      color: '#104f46',
      marginTop: isMobile ? 10 : 16,
      textAlign: 'center'
    },

    // subtle decorative shadow behind number for depth
    numberShadow: {
      position: 'absolute',
      width: isMobile ? 120 : 220,
      height: isMobile ? 120 : 220,
      borderRadius: '50%',
      background: 'radial-gradient(circle at center, rgba(26,197,173,0.06), transparent 40%)',
      zIndex: 0
    },

    // below overview container
    belowContainer: {
      padding: isMobile ? '28px 18px' : '36px 48px',
      boxSizing: 'border-box'
    },

    customerActivityRow: {
      display: 'flex',
      gap: 28,
      flexWrap: isMobile ? 'wrap' : 'nowrap',
      alignItems: 'stretch',
      marginBottom: 28
    },

    sideCard: {
      background: subtleGlass,
      backdropFilter: 'saturate(130%) blur(4px)',
      borderRadius: 14,
      boxShadow: '0 18px 44px rgba(9,20,46,0.06), inset 0 1px 0 rgba(255,255,255,0.6)',
      border: '1px solid rgba(10,30,60,0.045)',
      flex: isMobile ? '1 1 100%' : '0 0 calc(50% - 14px)',
      minHeight: isMobile ? 300 : 380,
      padding: isMobile ? '18px' : '24px',
      boxSizing: 'border-box',
      overflow: 'hidden'
    },

    sideCardHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 12
    },
    sideTitle: {
      fontSize: isMobile ? 18 : 20,
      fontWeight: 900,
      color: '#061426',
      margin: 0
    },
    smallAccentBar: {
      width: 28,
      height: 4,
      borderRadius: 3,
      background: accentGradient
    },

    itemList: { listStyle: 'none', padding: 0, marginTop: 8 },
    itemRow: {
      display: 'flex',
      gap: 14,
      alignItems: 'center',
      padding: '12px 0',
      borderBottom: '1px solid rgba(10,30,60,0.04)'
    },
    avatar: {
      width: isMobile ? 54 : 66,
      height: isMobile ? 54 : 66,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontWeight: 800,
      fontSize: isMobile ? 18 : 20,
      background: 'linear-gradient(135deg,#15b7a6,#7a3ff5)',
      boxShadow: '0 10px 30px rgba(122,63,245,0.08)'
    },
    itemName: {
      fontSize: isMobile ? 15 : 17,
      fontWeight: 800,
      color: '#061426'
    },
    itemEmail: { fontSize: isMobile ? 13 : 14, color: '#5b6b7a' },

    revenueRow: {
      display: 'flex',
      gap: 20,
      flexWrap: 'wrap',
      marginBottom: 26
    },
    revenueCard: {
      background: subtleGlass,
      borderRadius: 12,
      padding: isMobile ? 16 : 20,
      boxShadow: '0 14px 36px rgba(9,20,46,0.06)',
      borderTop: '6px solid rgba(26,197,173,0.9)',
      flex: isMobile ? '1 1 100%' : '0 0 calc(33.33% - 14px)',
      minWidth: 220,
      boxSizing: 'border-box'
    },
    revenueLabel: { fontSize: 15, fontWeight: 800, color: '#061426', margin: 0 },
    revenueValue: { fontSize: isMobile ? 20 : 24, fontWeight: 900, marginTop: 8, color: '#0e6b60' },

    bookingSection: {
      background: subtleGlass,
      borderRadius: 16,
      boxShadow: '0 20px 50px rgba(9,20,46,0.06)',
      border: '1px solid rgba(10,30,60,0.04)',
      padding: isMobile ? 18 : 28,
      boxSizing: 'border-box'
    },
    bookingTitle: { fontSize: isMobile ? 20 : 22, fontWeight: 900, margin: 0, marginBottom: 16 },

    searchInput: {
      width: '100%',
      padding: isMobile ? '12px 14px' : '14px 16px',
      borderRadius: 12,
      border: '1px solid rgba(10,30,60,0.08)',
      fontSize: isMobile ? 14 : 15,
      marginBottom: 18,
      boxSizing: 'border-box',
      background: 'rgba(255,255,255,0.8)'
    },

    tableWrap: { overflowX: 'auto', borderRadius: 8 },
    table: { width: '100%', borderCollapse: 'collapse', minWidth: 860 },
    th: {
      textAlign: 'left',
      padding: isMobile ? '12px 10px' : '14px 12px',
      background: 'linear-gradient(90deg,#6f5af3,#15b7a6)',
      color: '#fff',
      fontSize: isMobile ? 13 : 14,
      fontWeight: 700,
      position: 'sticky',
      top: 0
    },
    td: {
      padding: isMobile ? '12px 10px' : '14px 12px',
      borderBottom: '1px solid rgba(10,30,60,0.04)',
      fontSize: isMobile ? 13 : 14,
      color: '#0b1e28'
    },
    noData: { textAlign: 'center', padding: 28, color: '#5b6b7a', fontSize: 16 }
  };

  return (
    <div style={styles.pageShell}>
      {/* navbar full width */}
      <div style={styles.fullWidthWrapper}>
        <AdminNavbar />
      </div>

      {/* top title / accent */}
      <div style={styles.fullWidthWrapper}>
        <div style={styles.titleRow}>
          <h2 style={styles.sectionTitle}>Dashboard Overview</h2>
          <span style={styles.titleAccent} />
        </div>

        {/* Overview cards */}
        <div style={styles.overviewRow}>
          <div style={styles.overviewCard}>
            <div style={styles.accentStripeTop} />
            {/* decorative soft glow behind number */}
            <div style={styles.numberShadow} />

            <div style={styles.cardTitle}>TOTAL BOOKING</div>
            <div style={styles.mainNumber}>{totalBookings ?? 0}</div>
            <div style={styles.metaLine}>This Month: {thisMonthBookings ?? 0}</div>
            <div style={styles.metaLine}>This Week: {thisWeekBookings ?? 0}</div>
          </div>

          <div style={styles.overviewCard}>
            <div style={styles.accentStripeTop} />
            <div style={styles.numberShadow} />

            <div style={styles.cardTitle}>ROOMS AVAILABLE</div>
            <div style={styles.mainNumber}>312</div>
            <div style={styles.metaLine}>Booked (M): 913</div>
            <div style={styles.metaLine}>Booked (W): 125</div>
          </div>
        </div>
      </div>

      {/* content below overview */}
      <div style={styles.belowContainer}>
        {/* Customers & Activities */}
        <div style={styles.customerActivityRow}>
          <div style={styles.sideCard}>
            <div style={styles.sideCardHeader}>
              <h3 style={styles.sideTitle}>New Customer</h3>
              <div style={styles.smallAccentBar} />
            </div>

            <ul style={styles.itemList}>
              {newCustomers.length > 0 ? newCustomers.map((c, i) => (
                <li key={i} style={styles.itemRow}>
                  <div style={styles.avatar}>
                    {c.initials ?? (c.name ? c.name.charAt(0).toUpperCase() : '?')}
                  </div>
                  <div>
                    <div style={styles.itemName}>{c.name || 'N/A'}</div>
                    <div style={styles.itemEmail}>{c.email || '—'}</div>
                  </div>
                </li>
              )) : (
                <div style={{ padding: 12, color: '#5b6b7a', fontSize: 16 }}>No new customers</div>
              )}
            </ul>
          </div>

          <div style={styles.sideCard}>
            <div style={styles.sideCardHeader}>
              <h3 style={styles.sideTitle}>Recent Activities</h3>
              <div style={styles.smallAccentBar} />
            </div>

            <ul style={styles.itemList}>
              {recentActivities.length > 0 ? recentActivities.map((act, i) => (
                <li key={i} style={styles.itemRow}>
                  <div style={styles.avatar}>
                    {act.initials ?? (act.name ? act.name.charAt(0).toUpperCase() : 'A')}
                  </div>
                  <div>
                    <div style={{ fontSize: isMobile ? 14 : 15, color: '#061426' }}>
                      <strong style={{ fontWeight: 800 }}>{act.name}</strong> {act.action}
                    </div>
                    <div style={{ fontSize: 13, color: '#5b6b7a', marginTop: 6 }}>
                      {act.updatedAt ? new Date(act.updatedAt).toLocaleString() : ''}
                    </div>
                  </div>
                </li>
              )) : (
                <div style={{ padding: 12, color: '#5b6b7a', fontSize: 16 }}>No recent activities</div>
              )}
            </ul>
          </div>
        </div>

        {/* Revenue */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 900 }}>Revenue Overview</h3>
          </div>

          <div style={styles.revenueRow}>
            <div style={styles.revenueCard}>
              <p style={styles.revenueLabel}>Total Revenue</p>
              <p style={styles.revenueValue}>₹{totalRevenue}</p>
            </div>

            <div style={styles.revenueCard}>
              <p style={styles.revenueLabel}>This Month</p>
              <p style={styles.revenueValue}>₹{thisMonthRevenue}</p>
            </div>

            <div style={styles.revenueCard}>
              <p style={styles.revenueLabel}>This Week</p>
              <p style={styles.revenueValue}>₹{thisWeekRevenue}</p>
            </div>
          </div>
        </div>

        {/* Booking Management */}
        {/* Booking Management */}
<section style={styles.bookingSection}>
  <h3 style={styles.bookingTitle}>Booking Management</h3>

  <div>
    <input
      type="text"
      placeholder="Search by guest name, booking ID, or email"
      onChange={(e) => setSearchTerm(e.target.value)}
      style={styles.searchInput}
      value={searchTerm}
    />
  </div>

  <div style={styles.tableWrap}>
    {filteredBookings.length > 0 ? (
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>#</th>
            <th style={styles.th}>Booking ID</th>
            <th style={styles.th}>Guest Name</th>
            <th style={styles.th}>Room</th>
            <th style={styles.th}>Check-In</th>
            <th style={styles.th}>Check-Out</th>
            <th style={styles.th}>Total Cost</th>
            <th style={styles.th}>Guest Email</th>
          </tr>
        </thead>
        <tbody>
          {filteredBookings.map((booking, i) => (
            <tr key={booking._id || i}>
              <td style={styles.td}>{i + 1}</td>
              <td style={styles.td}>
                {booking.bookingId || booking._id?.toString().substring(0, 8)}
              </td>
              <td style={styles.td}>
                <div style={{ fontWeight: 600 }}>{booking.userName}</div>
              </td>
              <td style={styles.td}>
                {booking.roomTitle ? (
                  <div>
                    <div style={{ fontWeight: 500 }}>{booking.roomTitle}</div>
                    {booking.roomId && (
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        ID: {booking.roomId.toString().substring(0, 8)}...
                      </div>
                    )}
                  </div>
                ) : 'N/A'}
              </td>
              <td style={styles.td}>
                {booking.checkIn ? (
                  <div>
                    {new Date(booking.checkIn).toLocaleDateString()}
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      {new Date(booking.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ) : '-'}
              </td>
              <td style={styles.td}>
                {booking.checkOut ? (
                  <div>
                    {new Date(booking.checkOut).toLocaleDateString()}
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      {new Date(booking.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ) : '-'}
              </td>
              <td style={styles.td}>
                <div style={{ fontWeight: 700, color: '#0e6b60' }}>
                  ₹{booking.totalCost?.toLocaleString('en-IN') || booking.amount?.toLocaleString('en-IN') || '0'}
                </div>
              </td>
              <td style={styles.td}>
                {booking.userEmail || 'N/A'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    ) : (
      <div style={styles.noData}>
        {searchTerm ? 'No bookings matching your search.' : 'Loading bookings...'}
      </div>
    )}
  </div>
</section>
      </div>
    </div>
  );
}

export default AdminDashboard;
