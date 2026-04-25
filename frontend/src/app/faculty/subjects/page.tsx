'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function FacultySubjectsPage() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getFacultySubjects().then(d => { setSubjects(d.subjects || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="ds-fade-in"><div style={{ height: 200, background: 'rgba(249,115,22,0.04)', borderRadius: 16 }} /></div>;

  return (
    <div>
      <div className="ds-page-header ds-fade-in">
        <h1 className="ds-page-title">My Subjects 📚</h1>
        <p className="ds-page-sub">Subjects assigned to you by the admin</p>
      </div>
      {subjects.length === 0 ? (
        <div className="ds-card ds-fade-in"><div className="ds-empty"><div className="ds-empty-icon">📚</div><div className="ds-empty-title">No subjects assigned</div><div className="ds-empty-sub">Contact admin to get subjects assigned to you</div></div></div>
      ) : (
        <div className="ds-grid-3 ds-stagger">
          {subjects.map((s: any) => (
            <div key={s.id} className="ds-card" style={{ padding: '1.3rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
                <span className="ds-badge ds-badge-orange">{s.subject?.code}</span>
                <span className="ds-badge ds-badge-blue">{s.subject?.credits || 3} credits</span>
              </div>
              <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: '#1c0a00', fontSize: '1rem', marginBottom: '0.4rem' }}>{s.subject?.name}</h3>
              <p style={{ fontSize: '0.78rem', color: '#9a7b6a' }}>{s.subject?.department}</p>
              {s.subject?.semester && <p style={{ fontSize: '0.72rem', color: '#b89070', marginTop: '0.25rem' }}>Semester: {s.subject.semester}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
