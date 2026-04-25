'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function FacultyBookingsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending');
  const [processing, setProcessing] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const load = () => api.getFacultyBookings()
    .then(d => { setBookings(d.bookings || []); setLoading(false); })
    .catch(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const handleAction = async (id: string, status: string) => {
    setProcessing(id);
    try {
      await api.updateBookingStatus(id, status);
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b));
      setMsg(`Booking ${status === 'approved' ? '✅ approved' : '❌ rejected'} successfully.`);
    } catch (err: any) { setMsg(err.message || 'Action failed.'); }
    finally { setProcessing(null); }
  };

  const purposeLabels: Record<string, { icon: string; label: string }> = {
    counseling: { icon: '🧠', label: 'Counseling' },
    meeting: { icon: '🤝', label: 'Meeting' },
    doubt_clearing: { icon: '❓', label: 'Doubt Clearing' },
    project_review: { icon: '📋', label: 'Project Review' },
    other: { icon: '📌', label: 'Other' },
  };

  const statusStyles: Record<string, { badge: string; icon: string; bg: string; border: string }> = {
    pending: { badge: 'ds-badge-amber', icon: '⏳', bg: 'rgba(217,119,6,0.03)', border: 'rgba(217,119,6,0.1)' },
    approved: { badge: 'ds-badge-green', icon: '✅', bg: 'rgba(22,163,74,0.03)', border: 'rgba(22,163,74,0.1)' },
    rejected: { badge: 'ds-badge-red', icon: '❌', bg: 'rgba(220,38,38,0.03)', border: 'rgba(220,38,38,0.1)' },
    completed: { badge: 'ds-badge-blue', icon: '✔️', bg: 'rgba(37,99,235,0.03)', border: 'rgba(37,99,235,0.1)' },
    cancelled: { badge: 'ds-badge-slate', icon: '🚫', bg: 'rgba(100,116,139,0.03)', border: 'rgba(100,116,139,0.1)' },
  };

  const filtered = tab === 'all' ? bookings : bookings.filter(b => b.status === tab);
  const counts = { pending: 0, approved: 0, rejected: 0, completed: 0, cancelled: 0 };
  for (const b of bookings) { if (counts[b.status as keyof typeof counts] !== undefined) counts[b.status as keyof typeof counts]++; }

  // Group by date for calendar view
  const byDate: Record<string, any[]> = {};
  for (const b of filtered) {
    const d = b.date;
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(b);
  }
  const sortedDates = Object.keys(byDate).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  // Today stats
  const today = new Date().toISOString().split('T')[0];
  const todayBookings = bookings.filter(b => b.date === today && ['approved', 'pending'].includes(b.status));

  return (
    <div>
      <div className="ds-page-header ds-fade-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 16, background: 'linear-gradient(135deg, #7c3aed, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', boxShadow: '0 4px 14px rgba(124,58,237,0.3)' }}>📩</div>
          <div>
            <h1 className="ds-page-title" style={{ marginBottom: 2 }}>Student Bookings</h1>
            <p className="ds-page-sub">Accept or reject slot requests from students</p>
          </div>
        </div>
        <button className="ds-btn ds-btn-outline" onClick={load}>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Refresh
        </button>
      </div>

      {msg && <div className={`ds-alert ${msg.includes('❌') || msg.includes('failed') ? 'ds-alert-error' : 'ds-alert-success'} ds-fade-in`}>
        <span style={{ flex: 1 }}>{msg}</span>
        <button className="ds-btn ds-btn-ghost" style={{ padding: '0.2rem' }} onClick={() => setMsg('')}>✕</button>
      </div>}

      {/* Stats */}
      <div className="ds-grid-4 ds-stagger" style={{ marginBottom: '1.5rem' }}>
        <div className="ds-stat-card" onClick={() => setTab('pending')} style={{ cursor: 'pointer', borderColor: tab === 'pending' ? 'rgba(217,119,6,0.3)' : undefined }}>
          <div className="ds-stat-icon" style={{ background: 'rgba(217,119,6,0.08)' }}>⏳</div>
          <div className="ds-stat-value" style={{ color: '#d97706' }}>{counts.pending}</div>
          <div className="ds-stat-label">Pending Requests</div>
        </div>
        <div className="ds-stat-card" onClick={() => setTab('approved')} style={{ cursor: 'pointer', borderColor: tab === 'approved' ? 'rgba(22,163,74,0.3)' : undefined }}>
          <div className="ds-stat-icon" style={{ background: 'rgba(22,163,74,0.08)' }}>✅</div>
          <div className="ds-stat-value" style={{ color: '#16a34a' }}>{counts.approved}</div>
          <div className="ds-stat-label">Approved</div>
        </div>
        <div className="ds-stat-card">
          <div className="ds-stat-icon" style={{ background: 'rgba(37,99,235,0.08)' }}>📅</div>
          <div className="ds-stat-value">{todayBookings.length}</div>
          <div className="ds-stat-label">Today&apos;s Meetings</div>
        </div>
        <div className="ds-stat-card" onClick={() => setTab('all')} style={{ cursor: 'pointer', borderColor: tab === 'all' ? 'rgba(249,115,22,0.3)' : undefined }}>
          <div className="ds-stat-icon" style={{ background: 'rgba(249,115,22,0.08)' }}>📊</div>
          <div className="ds-stat-value">{bookings.length}</div>
          <div className="ds-stat-label">Total Bookings</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="ds-tabs ds-fade-in" style={{ marginBottom: '1rem' }}>
        {[
          { id: 'pending', label: `⏳ Pending (${counts.pending})` },
          { id: 'approved', label: `✅ Approved (${counts.approved})` },
          { id: 'rejected', label: `❌ Rejected (${counts.rejected})` },
          { id: 'all', label: `All (${bookings.length})` },
        ].map(t => (
          <button key={t.id} className={`ds-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* Bookings grouped by date */}
      {loading ? <div className="ds-card"><p style={{ color: '#9a7b6a' }}>Loading…</p></div> : filtered.length === 0 ? (
        <div className="ds-card ds-fade-in">
          <div className="ds-empty"><div className="ds-empty-icon">📩</div><div className="ds-empty-title">No {tab !== 'all' ? tab : ''} bookings</div><div className="ds-empty-sub">Student booking requests will appear here</div></div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="ds-fade-in">
          {sortedDates.map(date => {
            const dateObj = new Date(date + 'T00:00:00');
            const isToday = date === today;
            const dayBookings = byDate[date].sort((a: any, b: any) => a.start_time?.localeCompare(b.start_time));
            return (
              <div key={date}>
                {/* Date header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '0.6rem' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: isToday ? 'linear-gradient(135deg, #f97316, #ea580c)' : 'rgba(249,115,22,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: isToday ? 'none' : '1px solid rgba(249,115,22,0.12)' }}>
                    <div style={{ fontSize: '0.55rem', fontWeight: 700, color: isToday ? '#fff' : '#9a7b6a', textTransform: 'uppercase', lineHeight: 1 }}>
                      {dateObj.toLocaleDateString('en-US', { month: 'short' })}
                    </div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: isToday ? '#fff' : '#1c0a00', lineHeight: 1 }}>
                      {dateObj.getDate()}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: '#1c0a00', fontSize: '0.9rem' }}>
                      {dateObj.toLocaleDateString('en-US', { weekday: 'long' })}
                      {isToday && <span className="ds-badge ds-badge-orange" style={{ marginLeft: 8 }}>Today</span>}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#9a7b6a' }}>{dayBookings.length} booking(s)</div>
                  </div>
                </div>

                {/* Booking cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingLeft: 50 }}>
                  {dayBookings.map((b: any) => {
                    const style = statusStyles[b.status] || statusStyles.pending;
                    const purpose = purposeLabels[b.purpose] || purposeLabels.other;
                    const isProc = processing === b.id;
                    return (
                      <div key={b.id} style={{ display: 'flex', alignItems: 'start', gap: 12, padding: '0.85rem 1rem', background: style.bg, border: `1px solid ${style.border}`, borderRadius: 14, transition: 'all 0.2s' }}>
                        <span style={{ fontSize: '1.3rem', flexShrink: 0, marginTop: 2 }}>{style.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: '#1c0a00', fontSize: '0.88rem' }}>{b.student?.full_name || 'Student'}</span>
                            <span className={`ds-badge ${style.badge}`}>{b.status}</span>
                            <span className="ds-badge ds-badge-slate" style={{ fontSize: '0.62rem' }}>{purpose.icon} {purpose.label}</span>
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#7c5a4a', marginBottom: '0.1rem' }}>
                            ⏰ {b.start_time?.slice(0, 5)} – {b.end_time?.slice(0, 5)}
                            {b.student?.department && <span style={{ marginLeft: 8, color: '#9a7b6a' }}>• {b.student.department}</span>}
                          </div>
                          {b.description && <div style={{ fontSize: '0.72rem', color: '#b89070', marginTop: '0.15rem' }}>💬 {b.description}</div>}
                          {b.student?.user_id && <div style={{ fontSize: '0.68rem', color: '#c4a08a', marginTop: '0.1rem' }}>ID: {b.student.user_id}</div>}
                        </div>
                        {b.status === 'pending' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flexShrink: 0 }}>
                            <button className="ds-btn ds-btn-primary" style={{ padding: '0.35rem 0.8rem', fontSize: '0.72rem', justifyContent: 'center' }} disabled={isProc} onClick={() => handleAction(b.id, 'approved')}>
                              {isProc ? <span style={{ width: 12, height: 12, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }} /> : '✅ Accept'}
                            </button>
                            <button className="ds-btn ds-btn-danger" style={{ padding: '0.35rem 0.8rem', fontSize: '0.72rem', justifyContent: 'center' }} disabled={isProc} onClick={() => handleAction(b.id, 'rejected')}>
                              ❌ Reject
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
