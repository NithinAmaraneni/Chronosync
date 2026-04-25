'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export default function FacultyDashboard() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [timetable, setTimetable] = useState<any>({});
  const [leaves, setLeaves] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      api.getFacultySubjects().then(d => setSubjects(d.subjects || [])),
      api.getFacultyTimetable().then(d => setTimetable(d.timetable || {})),
      api.getFacultyLeaves().then(d => setLeaves(d.leaves || [])),
      api.getFacultyBookings().then(d => setBookings(d.bookings || [])),
    ]).finally(() => setLoading(false));
  }, []);

  const todaySlots = timetable[['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()]] || [];
  const pendingBookings = bookings.filter((b: any) => b.status === 'pending');
  const pendingLeaves = leaves.filter((l: any) => l.status === 'pending');

  if (loading) return (
    <div>
      <div style={{ height: 36, width: 300, background: 'rgba(249,115,22,0.06)', borderRadius: 10, marginBottom: 12 }} />
      <div style={{ height: 20, width: 220, background: 'rgba(249,115,22,0.04)', borderRadius: 8, marginBottom: 32 }} />
      <div className="ds-grid-4 ds-stagger">
        {[...Array(4)].map((_, i) => <div key={i} style={{ height: 120, background: 'rgba(249,115,22,0.04)', borderRadius: 16 }} />)}
      </div>
    </div>
  );

  return (
    <div>
      <div className="ds-page-header ds-fade-in">
        <h1 className="ds-page-title">Welcome, <span style={{ color: '#ea580c' }}>{user?.fullName}</span> 👩‍🏫</h1>
        <p className="ds-page-sub">Here&apos;s your teaching overview for today</p>
      </div>

      {/* Stats */}
      <div className="ds-grid-4 ds-stagger" style={{ marginBottom: '2rem' }}>
        <div className="ds-stat-card">
          <div className="ds-stat-icon" style={{ background: 'rgba(249,115,22,0.1)' }}>📚</div>
          <div className="ds-stat-value">{subjects.length}</div>
          <div className="ds-stat-label">Assigned Subjects</div>
        </div>
        <div className="ds-stat-card">
          <div className="ds-stat-icon" style={{ background: 'rgba(37,99,235,0.08)' }}>📅</div>
          <div className="ds-stat-value">{todaySlots.length}</div>
          <div className="ds-stat-label">Classes Today</div>
        </div>
        <div className="ds-stat-card">
          <div className="ds-stat-icon" style={{ background: 'rgba(217,119,6,0.08)' }}>📬</div>
          <div className="ds-stat-value">{pendingBookings.length}</div>
          <div className="ds-stat-label">Pending Requests</div>
        </div>
        <div className="ds-stat-card">
          <div className="ds-stat-icon" style={{ background: 'rgba(22,163,74,0.08)' }}>🏖️</div>
          <div className="ds-stat-value">{pendingLeaves.length}</div>
          <div className="ds-stat-label">Pending Leaves</div>
        </div>
      </div>

      <div className="ds-grid-2">
        {/* Today's Schedule */}
        <div className="ds-card ds-fade-in" style={{ animationDelay: '0.2s' }}>
          <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: '#1c0a00', marginBottom: '1rem', fontSize: '1rem' }}>📅 Today&apos;s Schedule</h3>
          {todaySlots.length === 0 ? (
            <div className="ds-empty">
              <div className="ds-empty-icon">🎉</div>
              <div className="ds-empty-title">No classes today</div>
              <div className="ds-empty-sub">Enjoy your free day!</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {todaySlots.map((slot: any) => (
                <div key={slot.id} className="ds-tt-slot">
                  <div className="ds-tt-slot-subject">{slot.subject?.name || 'N/A'}</div>
                  <div className="ds-tt-slot-time">{slot.start_time?.slice(0, 5)} – {slot.end_time?.slice(0, 5)}</div>
                  {slot.room && <div className="ds-tt-slot-room">Room: {slot.room}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Bookings */}
        <div className="ds-card ds-fade-in" style={{ animationDelay: '0.3s' }}>
          <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: '#1c0a00', marginBottom: '1rem', fontSize: '1rem' }}>📬 Pending Student Requests</h3>
          {pendingBookings.length === 0 ? (
            <div className="ds-empty">
              <div className="ds-empty-icon">✅</div>
              <div className="ds-empty-title">All clear</div>
              <div className="ds-empty-sub">No pending booking requests</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {pendingBookings.slice(0, 5).map((b: any) => (
                <div key={b.id} style={{ padding: '0.75rem', background: 'rgba(255,248,240,0.8)', border: '1px solid rgba(249,115,22,0.1)', borderRadius: 11 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                    <span style={{ fontWeight: 600, color: '#1c0a00', fontSize: '0.83rem' }}>{b.student?.full_name}</span>
                    <span className="ds-badge ds-badge-amber">{b.purpose}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#9a7b6a' }}>{b.date} · {b.start_time?.slice(0, 5)} – {b.end_time?.slice(0, 5)}</div>
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
                    <button className="ds-btn ds-btn-primary" style={{ padding: '0.35rem 0.8rem', fontSize: '0.72rem' }}
                      onClick={async () => { await api.updateBookingStatus(b.id, 'approved'); setBookings(prev => prev.map(x => x.id === b.id ? { ...x, status: 'approved' } : x)); }}>
                      Approve
                    </button>
                    <button className="ds-btn ds-btn-danger" style={{ padding: '0.35rem 0.8rem', fontSize: '0.72rem' }}
                      onClick={async () => { await api.updateBookingStatus(b.id, 'rejected'); setBookings(prev => prev.map(x => x.id === b.id ? { ...x, status: 'rejected' } : x)); }}>
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
