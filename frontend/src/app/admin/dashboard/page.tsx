'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAnalytics().then(d => setAnalytics(d.analytics)).catch(console.error).finally(() => setLoading(false));
  }, []);

  const formatDate = (d: string) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const actionLabels: Record<string, { text: string; icon: string }> = {
    created_student: { text: 'Created Student', icon: '🎓' },
    created_faculty: { text: 'Created Faculty', icon: '👩‍🏫' },
    deactivated_user: { text: 'Deactivated User', icon: '🚫' },
  };

  if (loading) return (
    <div>
      <div style={{ height: 36, width: 340, background: 'rgba(249,115,22,0.06)', borderRadius: 10, marginBottom: 12 }} />
      <div style={{ height: 20, width: 240, background: 'rgba(249,115,22,0.04)', borderRadius: 8, marginBottom: 32 }} />
      <div className="ds-grid-4 ds-stagger">
        {[...Array(4)].map((_, i) => <div key={i} style={{ height: 130, background: 'rgba(249,115,22,0.04)', borderRadius: 16 }} />)}
      </div>
    </div>
  );

  const stats = [
    { label: 'Total Students', value: analytics?.totalStudents || 0, icon: '🎓', bg: 'rgba(249,115,22,0.1)' },
    { label: 'Total Faculty', value: analytics?.totalFaculty || 0, icon: '👩‍🏫', bg: 'rgba(37,99,235,0.08)' },
    { label: 'Active Users', value: analytics?.activeUsers || 0, icon: '✅', bg: 'rgba(22,163,74,0.08)' },
    { label: 'Pending Login', value: analytics?.pendingFirstLogin || 0, icon: '⏳', bg: 'rgba(217,119,6,0.08)' },
  ];

  const departments = (analytics?.departmentBreakdown || []) as any[];
  const maxDept = Math.max(...departments.map((d: any) => d.students || d.classes || 0), 1);

  return (
    <div>
      <div className="ds-page-header ds-fade-in">
        <h1 className="ds-page-title">Welcome, <span style={{ color: '#ea580c' }}>{user?.fullName}</span> 👋</h1>
        <p className="ds-page-sub">ChronoSync system overview & management</p>
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }} className="ds-fade-in">
        <Link href="/admin/add-student" className="ds-btn ds-btn-primary">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>Add Student
        </Link>
        <Link href="/admin/add-faculty" className="ds-btn ds-btn-outline">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>Add Faculty
        </Link>
        <Link href="/admin/subjects" className="ds-btn ds-btn-ghost">📚 Manage Subjects</Link>
        <Link href="/admin/timetable" className="ds-btn ds-btn-ghost">📅 Timetable</Link>
        <Link href="/admin/analytics" className="ds-btn ds-btn-ghost">📊 Analytics</Link>
      </div>

      {/* Stats */}
      <div className="ds-grid-4 ds-stagger" style={{ marginBottom: '2rem' }}>
        {stats.map(s => (
          <div key={s.label} className="ds-stat-card">
            <div className="ds-stat-icon" style={{ background: s.bg }}>{s.icon}</div>
            <div className="ds-stat-value">{s.value}</div>
            <div className="ds-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="ds-grid-2">
        {/* Departments */}
        <div className="ds-card ds-fade-in" style={{ animationDelay: '0.25s' }}>
          <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: '#1c0a00', marginBottom: '1rem', fontSize: '1rem' }}>📊 Department Overview</h3>
          {departments.length === 0 ? (
            <div className="ds-empty"><div className="ds-empty-icon">📊</div><div className="ds-empty-title">No data yet</div><div className="ds-empty-sub">Add students to see department breakdown</div></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {departments.map((dept: any) => (
                <div key={dept.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.82rem', color: '#4a3020', fontWeight: 500 }}>{dept.name}</span>
                    <span style={{ fontSize: '0.72rem', color: '#9a7b6a' }}>
                      🎓 {dept.students} &nbsp; 👩‍🏫 {dept.faculty} &nbsp; 📋 {dept.classes}
                    </span>
                  </div>
                  <div style={{ width: '100%', background: 'rgba(249,115,22,0.08)', borderRadius: 6, height: 8 }}>
                    <div style={{ width: `${((dept.students || dept.classes || 0) / maxDept) * 100}%`, background: 'linear-gradient(90deg, #ea580c, #f97316)', height: 8, borderRadius: 6, transition: 'width 1s ease' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="ds-card ds-fade-in" style={{ animationDelay: '0.35s' }}>
          <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: '#1c0a00', marginBottom: '1rem', fontSize: '1rem' }}>⏰ Recent Activity</h3>
          {!analytics?.recentActivity?.length ? (
            <div className="ds-empty"><div className="ds-empty-icon">📋</div><div className="ds-empty-title">No activity</div><div className="ds-empty-sub">Actions will appear as you manage users</div></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: 320, overflowY: 'auto' }}>
              {analytics.recentActivity.map((log: any) => {
                const a = actionLabels[log.action] || { text: log.action, icon: '📌' };
                return (
                  <div key={log.id} style={{ display: 'flex', alignItems: 'start', gap: 10, padding: '0.6rem 0.75rem', background: 'rgba(255,248,240,0.7)', border: '1px solid rgba(249,115,22,0.08)', borderRadius: 10 }}>
                    <span style={{ fontSize: '1rem' }}>{a.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1c0a00' }}>{a.text}</div>
                      {log.details?.fullName && <div style={{ fontSize: '0.72rem', color: '#9a7b6a' }}>{log.details.fullName}</div>}
                    </div>
                    <span style={{ fontSize: '0.68rem', color: '#b89070', whiteSpace: 'nowrap' }}>{formatDate(log.created_at)}</span>
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
