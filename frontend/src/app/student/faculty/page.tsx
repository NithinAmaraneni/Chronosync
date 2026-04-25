'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function StudentFacultyPage() {
  const [faculty, setFaculty] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getStudentFacultyList().then(d => { setFaculty(d.faculty || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="ds-fade-in"><div style={{ height: 300, background: 'rgba(249,115,22,0.04)', borderRadius: 16 }} /></div>;

  return (
    <div>
      <div className="ds-page-header ds-fade-in">
        <h1 className="ds-page-title">Faculty Members 👩‍🏫</h1>
        <p className="ds-page-sub">Faculty assigned to your department</p>
      </div>
      {faculty.length === 0 ? (
        <div className="ds-card ds-fade-in"><div className="ds-empty"><div className="ds-empty-icon">👩‍🏫</div><div className="ds-empty-title">No faculty found</div><div className="ds-empty-sub">No faculty members assigned to your department yet</div></div></div>
      ) : (
        <div className="ds-grid-3 ds-stagger">
          {faculty.map((f: any) => (
            <div key={f.id} className="ds-card" style={{ padding: '1.3rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '0.9rem' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #f97316, #ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '1rem', flexShrink: 0 }}>
                  {f.full_name?.charAt(0)}
                </div>
                <div>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: '#1c0a00', fontSize: '0.95rem' }}>{f.full_name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#9a7b6a' }}>{f.user_id}</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg fill="none" viewBox="0 0 24 24" stroke="#9a7b6a" style={{ width: 14, height: 14, flexShrink: 0 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  <span style={{ color: '#7c5a4a' }}>{f.email}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg fill="none" viewBox="0 0 24 24" stroke="#9a7b6a" style={{ width: 14, height: 14, flexShrink: 0 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16" /></svg>
                  <span style={{ color: '#7c5a4a' }}>{f.department}</span>
                </div>
              </div>
              {f.subjects && f.subjects.length > 0 && (
                <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                  {f.subjects.map((s: string, i: number) => (
                    <span key={i} className="ds-badge ds-badge-orange">{s}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
