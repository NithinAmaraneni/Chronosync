'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function StudentDashboard() {
  const { user } = useAuth();
  const [timetable, setTimetable] = useState<any>({});
  const [bookings, setBookings] = useState<any[]>([]);
  const [faculty, setFaculty] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      api.getStudentTimetable().then(d => setTimetable(d.timetable || {})),
      api.getStudentBookings().then(d => setBookings(d.bookings || [])),
      api.getStudentFacultyList().then(d => setFaculty(d.faculty || [])),
    ]).finally(() => setLoading(false));
  }, []);

  const todayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
  const todaySlots = timetable[todayName] || [];
  const todayBySemester = todaySlots.reduce((acc: Record<string, any[]>, slot: any) => {
    const semKey = slot.subject?.semester || 'Unassigned Semester';
    if (!acc[semKey]) acc[semKey] = [];
    acc[semKey].push(slot);
    return acc;
  }, {});
  const pendingBookings = bookings.filter((b: any) => b.status === 'pending');
  const totalClasses = Object.values(timetable).flat().length;

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
        <h1 className="ds-page-title">Welcome, <span style={{ color: '#ea580c' }}>{user?.fullName}</span> 🎓</h1>
        <p className="ds-page-sub">Here&apos;s your academic overview • {user?.department}</p>
      </div>

      {/* Stats */}
      <div className="ds-grid-4 ds-stagger" style={{ marginBottom: '2rem' }}>
        <div className="ds-stat-card">
          <div className="ds-stat-icon" style={{ background: 'rgba(249,115,22,0.1)' }}>📅</div>
          <div className="ds-stat-value">{todaySlots.length}</div>
          <div className="ds-stat-label">Classes Today</div>
        </div>
        <div className="ds-stat-card">
          <div className="ds-stat-icon" style={{ background: 'rgba(37,99,235,0.08)' }}>📚</div>
          <div className="ds-stat-value">{totalClasses}</div>
          <div className="ds-stat-label">Weekly Classes</div>
        </div>
        <div className="ds-stat-card">
          <div className="ds-stat-icon" style={{ background: 'rgba(22,163,74,0.08)' }}>👩‍🏫</div>
          <div className="ds-stat-value">{faculty.length}</div>
          <div className="ds-stat-label">Faculty Members</div>
        </div>
        <div className="ds-stat-card">
          <div className="ds-stat-icon" style={{ background: 'rgba(217,119,6,0.08)' }}>🎫</div>
          <div className="ds-stat-value">{pendingBookings.length}</div>
          <div className="ds-stat-label">Pending Bookings</div>
        </div>
      </div>

      <div className="ds-grid-2">
        {/* Today's Classes */}
        <div className="ds-card ds-fade-in" style={{ animationDelay: '0.2s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: '#1c0a00', fontSize: '1rem' }}>📅 Today — {todayName}</h3>
            <Link href="/student/timetable" className="ds-btn ds-btn-outline" style={{ padding: '0.35rem 0.8rem', fontSize: '0.72rem' }}>View Full</Link>
          </div>
          {todaySlots.length === 0 ? (
            <div className="ds-empty"><div className="ds-empty-icon">🎉</div><div className="ds-empty-title">No classes today</div><div className="ds-empty-sub">Enjoy your free day!</div></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {Object.keys(todayBySemester).sort().map(semKey => (
                <section key={semKey}>
                  <div style={{ marginBottom: '0.4rem' }}><span className="ds-badge ds-badge-blue">{semKey}</span></div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {todayBySemester[semKey].map((slot: any) => (
                      <div key={slot.id} className="ds-tt-slot">
                        <div className="ds-tt-slot-subject">{slot.subject?.name || 'N/A'}</div>
                        <div className="ds-tt-slot-time">{slot.start_time?.slice(0, 5)} – {slot.end_time?.slice(0, 5)}</div>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                          {slot.room && <span className="ds-tt-slot-room">📍 {slot.room}</span>}
                          {slot.faculty?.full_name && <span className="ds-tt-slot-room">👩‍🏫 {slot.faculty.full_name}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        {/* My Bookings */}
        <div className="ds-card ds-fade-in" style={{ animationDelay: '0.3s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: '#1c0a00', fontSize: '1rem' }}>🎫 My Bookings</h3>
            <Link href="/student/book-slot" className="ds-btn ds-btn-primary" style={{ padding: '0.35rem 0.8rem', fontSize: '0.72rem' }}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>Book Slot
            </Link>
          </div>
          {bookings.length === 0 ? (
            <div className="ds-empty"><div className="ds-empty-icon">🎫</div><div className="ds-empty-title">No bookings</div><div className="ds-empty-sub">Book a slot with faculty for counseling or meetings</div></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {bookings.slice(0, 5).map((b: any) => {
                const badgeClass = b.status === 'approved' ? 'ds-badge-green' : b.status === 'rejected' ? 'ds-badge-red' : b.status === 'cancelled' ? 'ds-badge-slate' : 'ds-badge-amber';
                return (
                  <div key={b.id} style={{ padding: '0.75rem', background: 'rgba(255,248,240,0.8)', border: '1px solid rgba(249,115,22,0.1)', borderRadius: 11 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                      <span style={{ fontWeight: 600, color: '#1c0a00', fontSize: '0.83rem' }}>{b.faculty?.full_name || 'Faculty'}</span>
                      <span className={`ds-badge ${badgeClass}`}>{b.status}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#9a7b6a' }}>{b.date} · {b.start_time?.slice(0, 5)} – {b.end_time?.slice(0, 5)} · {b.purpose}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
