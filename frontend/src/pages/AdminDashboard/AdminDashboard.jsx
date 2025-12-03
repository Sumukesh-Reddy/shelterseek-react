import React, { useEffect, useState } from 'react';
import AdminNavbar from '../../components/AdminNavbar/navbar';
import './AdminDashboard.css';

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

  // ✅ Room counts state extended with shared/full
  const [roomCounts, setRoomCounts] = useState({
    total: 0,
    available: 0,
    booked: 0,
    thisMonthBooked: 0,
    thisWeekBooked: 0,
    sharedRooms: 0,
    fullRooms: 0
  });
  const [loadingRooms, setLoadingRooms] = useState(true);

  // fetch data
  useEffect(() => {
    // Fetch booking summary (list)
    fetch('http://localhost:3001/api/bookings/summarys')
      .then(res => res.json())
      .then(response => {
        console.log('Booking summary response:', response);
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

    // ✅ Fetch room counts + shared/full from popularTypes
    fetch('http://localhost:3001/api/rooms/count')
      .then(res => res.json())
      .then(data => {
        console.log('Room counts response:', data);
        if (data.success) {
          const counts = data.counts || {};
          let shared = 0;
          let full = 0;

          if (Array.isArray(data.popularTypes)) {
            data.popularTypes.forEach(t => {
              if (t._id === 'Shared') shared = t.count || 0;
              if (t._id === 'Full') full = t.count || 0;
            });
          }

          setRoomCounts({
            total: counts.total || 0,
            available: counts.available || 0,
            booked: counts.booked || 0,
            thisMonthBooked: counts.thisMonthBooked || 0,
            thisWeekBooked: counts.thisWeekBooked || 0,
            sharedRooms: shared,
            fullRooms: full
          });
        } else {
          console.error('Failed to fetch room counts:', data.message);
          setRoomCounts({
            total: 0,
            available: 0,
            booked: 0,
            thisMonthBooked: 0,
            thisWeekBooked: 0,
            sharedRooms: 0,
            fullRooms: 0
          });
        }
      })
      .catch(err => {
        console.error('Error fetching room counts:', err);
        setRoomCounts({
          total: 0,
          available: 0,
          booked: 0,
          thisMonthBooked: 0,
          thisWeekBooked: 0,
          sharedRooms: 0,
          fullRooms: 0
        });
      })
      .finally(() => setLoadingRooms(false));

    // Fetch new customers
    fetch('http://localhost:3001/api/new-customers')
      .then(res => res.json())
      .then(result => {
        if (Array.isArray(result?.data)) setNewCustomers(result.data);
        else if (Array.isArray(result)) setNewCustomers(result);
        else setNewCustomers([]);
      })
      .catch(() => setNewCustomers([]));

    // Fetch recent activities
    fetch('http://localhost:3001/api/recent-activities')
      .then(res => res.json())
      .then(result => {
        if (Array.isArray(result?.data)) setRecentActivities(result.data);
        else if (Array.isArray(result)) setRecentActivities(result);
        else setRecentActivities([]);
      })
      .catch(() => setRecentActivities([]));

    // Fetch revenue
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

    // Fetch booking counts (numbers)
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
    (b._id ?? '').toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
    (b.bookingId ?? '').toString().toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="admin-dashboard-page">
      {/* navbar full width */}
      <div className="admin-dashboard-fullwidth">
        <AdminNavbar />
      </div>

      {/* top title / accent */}
      <div className="admin-dashboard-fullwidth">
        <div className="admin-dashboard-title-row">
          <h2 className="admin-dashboard-title">Dashboard Overview</h2>
          <span className="admin-dashboard-title-accent" />
        </div>

        {/* Overview cards */}
        <div className="admin-dashboard-overview-row">
          {/* Bookings card */}
          <div className="admin-dashboard-overview-card">
            <div className="admin-dashboard-accent-stripe" />
            <div className="admin-dashboard-number-shadow" />

            <div className="admin-dashboard-card-label">Total Booking</div>
            <div className="admin-dashboard-main-number">{totalBookings ?? 0}</div>
            <div className="admin-dashboard-meta-line">
              This Month: {thisMonthBookings ?? 0}
            </div>
            <div className="admin-dashboard-meta-line">
              This Week: {thisWeekBookings ?? 0}
            </div>
          </div>

          {/* Rooms card with Shared / Full */}
          <div className="admin-dashboard-overview-card">
            <div className="admin-dashboard-accent-stripe" />
            <div className="admin-dashboard-number-shadow" />

            <div className="admin-dashboard-card-label">Rooms Overview</div>
            {loadingRooms ? (
              <>
                <div className="admin-dashboard-main-number">...</div>
                <div className="admin-dashboard-meta-line">Loading...</div>
                <div className="admin-dashboard-meta-line">Please wait</div>
              </>
            ) : (
              <>
                <div className="admin-dashboard-main-number">
                  {roomCounts.available}
                </div>
                <div className="admin-dashboard-meta-line">
                  Total: {roomCounts.total} | Booked: {roomCounts.booked}
                </div>
                <div className="admin-dashboard-meta-line">
                  Shared Rooms: {roomCounts.sharedRooms}
                </div>
                <div className="admin-dashboard-meta-line">
                  Full Rooms: {roomCounts.fullRooms}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* content below overview */}
      <div className="admin-dashboard-below">
        {/* Customers & Activities */}
        <div className="admin-dashboard-two-col">
          <div className="admin-dashboard-side-card">
            <div className="admin-dashboard-side-header">
              <h3 className="admin-dashboard-side-title">New Customers</h3>
              <div className="admin-dashboard-small-bar" />
            </div>

            <ul className="admin-dashboard-list">
              {newCustomers.length > 0 ? (
                newCustomers.map((c, i) => (
                  <li key={i} className="admin-dashboard-list-row">
                    <div className="admin-dashboard-avatar">
                      {c.initials ?? (c.name ? c.name.charAt(0).toUpperCase() : '?')}
                    </div>
                    <div>
                      <div className="admin-dashboard-item-name">
                        {c.name || 'N/A'}
                      </div>
                      <div className="admin-dashboard-item-email">
                        {c.email || '—'}
                      </div>
                    </div>
                  </li>
                ))
              ) : (
                <div className="admin-dashboard-empty">
                  No new customers
                </div>
              )}
            </ul>
          </div>

          <div className="admin-dashboard-side-card">
            <div className="admin-dashboard-side-header">
              <h3 className="admin-dashboard-side-title">Recent Activities</h3>
              <div className="admin-dashboard-small-bar" />
            </div>

            <ul className="admin-dashboard-list">
              {recentActivities.length > 0 ? (
                recentActivities.map((act, i) => (
                  <li key={i} className="admin-dashboard-list-row">
                    <div className="admin-dashboard-avatar">
                      {act.initials ?? (act.name ? act.name.charAt(0).toUpperCase() : 'A')}
                    </div>
                    <div>
                      <div className="admin-dashboard-activity-text">
                        <strong>{act.name}</strong> {act.action}
                      </div>
                      <div className="admin-dashboard-activity-time">
                        {act.updatedAt
                          ? new Date(act.updatedAt).toLocaleString()
                          : ''}
                      </div>
                    </div>
                  </li>
                ))
              ) : (
                <div className="admin-dashboard-empty">
                  No recent activities
                </div>
              )}
            </ul>
          </div>
        </div>

        {/* Revenue */}
        <div className="admin-dashboard-revenue-block">
          <div className="admin-dashboard-revenue-header">
            <h3 className="admin-dashboard-revenue-title">Revenue Overview</h3>
          </div>

          <div className="admin-dashboard-revenue-row">
            <div className="admin-dashboard-revenue-card">
              <p className="admin-dashboard-revenue-label">Total Revenue</p>
              <p className="admin-dashboard-revenue-value">
                ₹{totalRevenue.toLocaleString('en-IN')}
              </p>
            </div>

            <div className="admin-dashboard-revenue-card">
              <p className="admin-dashboard-revenue-label">This Month</p>
              <p className="admin-dashboard-revenue-value">
                ₹{thisMonthRevenue.toLocaleString('en-IN')}
              </p>
            </div>

            <div className="admin-dashboard-revenue-card">
              <p className="admin-dashboard-revenue-label">This Week</p>
              <p className="admin-dashboard-revenue-value">
                ₹{thisWeekRevenue.toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>

        {/* Booking Management */}
        <section className="admin-dashboard-booking-section">
          <h3 className="admin-dashboard-booking-title">Booking Management</h3>

          <div>
            <input
              type="text"
              placeholder="Search by guest name, booking ID, or email"
              onChange={e => setSearchTerm(e.target.value)}
              className="admin-dashboard-search"
              value={searchTerm}
            />
          </div>

          <div className="admin-dashboard-table-wrap">
            {filteredBookings.length > 0 ? (
              <table className="admin-dashboard-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Booking ID</th>
                    <th>Guest Name</th>
                    <th>Room</th>
                    <th>Check-In</th>
                    <th>Check-Out</th>
                    <th>Total Cost</th>
                    <th>Guest Email</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.map((booking, i) => (
                    <tr key={booking._id || i}>
                      <td>{i + 1}</td>
                      <td>
                        {booking.bookingId ||
                          booking._id?.toString().substring(0, 8)}
                      </td>
                      <td>
                        <div className="admin-dashboard-guest-name">
                          {booking.userName}
                        </div>
                      </td>
                      <td>
                        {booking.roomTitle ? (
                          <div>
                            <div className="admin-dashboard-room-title">
                              {booking.roomTitle}
                            </div>
                            {booking.roomId && (
                              <div className="admin-dashboard-room-id">
                                ID: {booking.roomId.toString().substring(0, 8)}...
                              </div>
                            )}
                          </div>
                        ) : (
                          'N/A'
                        )}
                      </td>
                      <td>
                        {booking.checkIn ? (
                          <div>
                            {new Date(booking.checkIn).toLocaleDateString()}
                            <div className="admin-dashboard-date-time">
                              {new Date(booking.checkIn).toLocaleTimeString(
                                [],
                                { hour: '2-digit', minute: '2-digit' }
                              )}
                            </div>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>
                        {booking.checkOut ? (
                          <div>
                            {new Date(booking.checkOut).toLocaleDateString()}
                            <div className="admin-dashboard-date-time">
                              {new Date(booking.checkOut).toLocaleTimeString(
                                [],
                                { hour: '2-digit', minute: '2-digit' }
                              )}
                            </div>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>
                        <div className="admin-dashboard-cost">
                          ₹
                          {booking.totalCost?.toLocaleString('en-IN') ||
                            booking.amount?.toLocaleString('en-IN') ||
                            '0'}
                        </div>
                      </td>
                      <td>{booking.userEmail || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="admin-dashboard-no-data">
                {searchTerm
                  ? 'No bookings matching your search.'
                  : 'Loading bookings...'}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default AdminDashboard;
