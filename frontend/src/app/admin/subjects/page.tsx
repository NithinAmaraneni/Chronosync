'use client';
import { useEffect, useState, useMemo, FormEvent } from 'react';
import { api } from '@/lib/api';
import CSVUpload from '@/components/CSVUpload';

/* ── Department emoji map ── */
const deptIcons: Record<string, string> = {
  'Computer Science': '💻', 'Electronics': '🔌', 'Mechanical': '⚙️',
  'Civil': '🏗️', 'Electrical': '⚡', 'Information Technology': '🌐',
  'Chemical': '🧪', 'Biotechnology': '🧬', 'Mathematics': '📐',
  'Physics': '🔬', 'Chemistry': '⚗️', 'Commerce': '📊', 'Arts': '🎨',
};

/* ── Department accent colours ── */
const deptColors: Record<string, { bg: string; border: string; text: string; accent: string }> = {
  'Computer Science': { bg: 'rgba(99,102,241,0.06)', border: 'rgba(99,102,241,0.18)', text: '#6366f1', accent: '#818cf8' },
  'Electronics': { bg: 'rgba(236,72,153,0.06)', border: 'rgba(236,72,153,0.18)', text: '#ec4899', accent: '#f472b6' },
  'Mechanical': { bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.18)', text: '#f59e0b', accent: '#fbbf24' },
  'Civil': { bg: 'rgba(34,197,94,0.06)', border: 'rgba(34,197,94,0.18)', text: '#22c55e', accent: '#4ade80' },
  'Electrical': { bg: 'rgba(234,179,8,0.06)', border: 'rgba(234,179,8,0.18)', text: '#eab308', accent: '#facc15' },
  'Information Technology': { bg: 'rgba(14,165,233,0.06)', border: 'rgba(14,165,233,0.18)', text: '#0ea5e9', accent: '#38bdf8' },
  'Chemical': { bg: 'rgba(168,85,247,0.06)', border: 'rgba(168,85,247,0.18)', text: '#a855f7', accent: '#c084fc' },
  'Biotechnology': { bg: 'rgba(20,184,166,0.06)', border: 'rgba(20,184,166,0.18)', text: '#14b8a6', accent: '#2dd4bf' },
  'Mathematics': { bg: 'rgba(249,115,22,0.06)', border: 'rgba(249,115,22,0.18)', text: '#f97316', accent: '#fb923c' },
  'Physics': { bg: 'rgba(59,130,246,0.06)', border: 'rgba(59,130,246,0.18)', text: '#3b82f6', accent: '#60a5fa' },
  'Chemistry': { bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.18)', text: '#ef4444', accent: '#f87171' },
  'Commerce': { bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.18)', text: '#10b981', accent: '#34d399' },
  'Arts': { bg: 'rgba(217,70,239,0.06)', border: 'rgba(217,70,239,0.18)', text: '#d946ef', accent: '#e879f9' },
};

const defaultColor = { bg: 'rgba(249,115,22,0.06)', border: 'rgba(249,115,22,0.18)', text: '#f97316', accent: '#fb923c' };

export default function AdminSubjectsPage() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [faculty, setFaculty] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', department: '', credits: '3', semester: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [assignForm, setAssignForm] = useState({ faculty_id: '', subject_id: '' });
  const [showAssign, setShowAssign] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDept, setActiveDept] = useState<string | null>(null);
  const [collapsedDepts, setCollapsedDepts] = useState<Set<string>>(new Set());

  const departments = ['Computer Science', 'Electronics', 'Mechanical', 'Civil', 'Electrical', 'Information Technology', 'Chemical', 'Biotechnology', 'Mathematics', 'Physics', 'Chemistry', 'Commerce', 'Arts'];

  const load = () => Promise.allSettled([
    api.getSubjects().then(d => setSubjects(d.subjects || [])),
    api.getUsers({ role: 'faculty' }).then(d => setFaculty(d.users || [])),
  ]).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true); setMsg('');
    try {
      await api.createSubject({ ...form, credits: parseInt(form.credits) });
      setMsg('Subject created!'); setShowForm(false);
      setForm({ name: '', code: '', department: '', credits: '3', semester: '' });
      load();
    } catch (err: any) { setMsg(err.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const handleAssign = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true); setMsg('');
    try {
      await api.assignSubject(assignForm.faculty_id, assignForm.subject_id);
      setMsg('Subject assigned to faculty!'); setShowAssign(false);
    } catch (err: any) { setMsg(err.message || 'Failed to assign'); }
    finally { setSaving(false); }
  };

  /* ── Derive grouped data: { department -> { semester -> subjects[] } } ── */
  const grouped = useMemo(() => {
    const filtered = subjects.filter(s => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || s.name?.toLowerCase().includes(q) || s.code?.toLowerCase().includes(q);
      const matchesDept = !activeDept || s.department === activeDept;
      return matchesSearch && matchesDept;
    });

    const map: Record<string, Record<string, any[]>> = {};
    filtered.forEach(s => {
      const dept = s.department || 'Other';
      const sem = s.semester || 'Unassigned';
      if (!map[dept]) map[dept] = {};
      if (!map[dept][sem]) map[dept][sem] = [];
      map[dept][sem].push(s);
    });
    return map;
  }, [subjects, searchQuery, activeDept]);

  /* ── Sorted semester keys (natural sort: Sem 1, Sem 2, …) ── */
  const sortSemesters = (sems: string[]) =>
    sems.sort((a, b) => {
      const na = parseInt(a.replace(/\D/g, '')) || 999;
      const nb = parseInt(b.replace(/\D/g, '')) || 999;
      return na - nb;
    });

  /* ── Active departments with subjects ── */
  const activeDepartments = useMemo(() =>
    Object.keys(grouped).sort()
    , [grouped]);

  const toggleCollapse = (dept: string) => {
    setCollapsedDepts(prev => {
      const next = new Set(prev);
      if (next.has(dept)) next.delete(dept); else next.add(dept);
      return next;
    });
  };

  /* ── Unique department list from data for filter pills ── */
  const existingDepts = useMemo(() =>
    [...new Set(subjects.map(s => s.department).filter(Boolean))].sort()
    , [subjects]);

  return (
    <div>
      {/* ── Page Header ── */}
      <div className="ds-page-header ds-fade-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div>
          <h1 className="ds-page-title">Manage Subjects 📚</h1>
          <p className="ds-page-sub">Create and assign subjects to faculty</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <CSVUpload
            title="Subjects"
            icon="📚"
            columns={['name', 'code', 'department', 'credits', 'semester']}
            sampleData={[
              ['Data Structures', 'CS201', 'Computer Science', '4', 'Sem 3'],
              ['Digital Electronics', 'EC301', 'Electronics', '3', 'Sem 5'],
            ]}
            onUpload={file => api.importSubjectsCSV(file)}
          />
          <button className="ds-btn ds-btn-outline" onClick={() => { setShowAssign(!showAssign); setShowForm(false); }}>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
            Assign
          </button>
          <button className="ds-btn ds-btn-primary" onClick={() => { setShowForm(!showForm); setShowAssign(false); }}>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Subject
          </button>
        </div>
      </div>

      {msg && <div className={`ds-alert ${msg.includes('Failed') ? 'ds-alert-error' : 'ds-alert-success'}`}>
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>{msg}
      </div>}

      {/* ── Create Form ── */}
      {showForm && (
        <div className="ds-card ds-fade-in" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: '#1c0a00', marginBottom: '1rem' }}>New Subject</h3>
          <form onSubmit={handleCreate}>
            <div className="ds-grid-2">
              <div className="ds-form-group"><label className="ds-label">Subject Name</label><input className="ds-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g., Data Structures" required /></div>
              <div className="ds-form-group"><label className="ds-label">Code</label><input className="ds-input" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="e.g., CS201" required /></div>
            </div>
            <div className="ds-grid-3">
              <div className="ds-form-group"><label className="ds-label">Department</label><select className="ds-select" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} required><option value="" disabled>Select</option>{departments.map(d => <option key={d}>{d}</option>)}</select></div>
              <div className="ds-form-group"><label className="ds-label">Credits</label><input className="ds-input" type="number" min="1" max="10" value={form.credits} onChange={e => setForm({ ...form, credits: e.target.value })} /></div>
              <div className="ds-form-group"><label className="ds-label">Semester</label><input className="ds-input" value={form.semester} onChange={e => setForm({ ...form, semester: e.target.value })} placeholder="e.g., Sem 3" /></div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="ds-btn ds-btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create Subject'}</button>
              <button type="button" className="ds-btn ds-btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Assign Form ── */}
      {showAssign && (
        <div className="ds-card ds-fade-in" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: '#1c0a00', marginBottom: '1rem' }}>Assign Subject to Faculty</h3>
          <form onSubmit={handleAssign}>
            <div className="ds-grid-2">
              <div className="ds-form-group"><label className="ds-label">Faculty</label><select className="ds-select" value={assignForm.faculty_id} onChange={e => setAssignForm({ ...assignForm, faculty_id: e.target.value })} required><option value="" disabled>Select faculty</option>{faculty.map((f: any) => <option key={f.id} value={f.id}>{f.full_name} — {f.department}</option>)}</select></div>
              <div className="ds-form-group"><label className="ds-label">Subject</label><select className="ds-select" value={assignForm.subject_id} onChange={e => setAssignForm({ ...assignForm, subject_id: e.target.value })} required><option value="" disabled>Select subject</option>{subjects.map((s: any) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}</select></div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="ds-btn ds-btn-primary" disabled={saving}>{saving ? 'Assigning...' : 'Assign'}</button>
              <button type="button" className="ds-btn ds-btn-ghost" onClick={() => setShowAssign(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Stats Row ── */}
      {!loading && subjects.length > 0 && (
        <div className="ds-grid-4 ds-fade-in" style={{ marginBottom: '1.5rem' }}>
          <div className="ds-stat-card">
            <div className="ds-stat-icon" style={{ background: 'rgba(249,115,22,0.1)' }}>📚</div>
            <div className="ds-stat-value">{subjects.length}</div>
            <div className="ds-stat-label">Total Subjects</div>
          </div>
          <div className="ds-stat-card">
            <div className="ds-stat-icon" style={{ background: 'rgba(99,102,241,0.1)' }}>🏛️</div>
            <div className="ds-stat-value">{existingDepts.length}</div>
            <div className="ds-stat-label">Departments</div>
          </div>
          <div className="ds-stat-card">
            <div className="ds-stat-icon" style={{ background: 'rgba(22,163,74,0.1)' }}>📅</div>
            <div className="ds-stat-value">{[...new Set(subjects.map(s => s.semester).filter(Boolean))].length}</div>
            <div className="ds-stat-label">Semesters</div>
          </div>
          <div className="ds-stat-card">
            <div className="ds-stat-icon" style={{ background: 'rgba(236,72,153,0.1)' }}>⭐</div>
            <div className="ds-stat-value">{subjects.reduce((sum, s) => sum + (s.credits || 0), 0)}</div>
            <div className="ds-stat-label">Total Credits</div>
          </div>
        </div>
      )}

      {/* ── Search & Department Filter ── */}
      {!loading && subjects.length > 0 && (
        <div className="ds-fade-in" style={{ marginBottom: '1.5rem' }}>
          {/* Search bar */}
          <div style={{ position: 'relative', marginBottom: '1rem', maxWidth: '400px' }}>
            <svg style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#9a7b6a' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              className="ds-input"
              style={{ paddingLeft: '36px' }}
              placeholder="Search subjects by name or code…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          {/* Department filter pills */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button
              className={`ds-subjects-pill ${!activeDept ? 'active' : ''}`}
              onClick={() => setActiveDept(null)}
            >
              All Departments
            </button>
            {existingDepts.map(dept => (
              <button
                key={dept}
                className={`ds-subjects-pill ${activeDept === dept ? 'active' : ''}`}
                onClick={() => setActiveDept(activeDept === dept ? null : dept)}
              >
                {deptIcons[dept] || '📁'} {dept}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Subject Grid: Department → Semester → Cards ── */}
      {loading ? (
        <div className="ds-card ds-fade-in">
          <p style={{ color: '#9a7b6a', textAlign: 'center', padding: '2rem' }}>
            <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', marginRight: '0.5rem' }}>⏳</span>
            Loading subjects…
          </p>
        </div>
      ) : subjects.length === 0 ? (
        <div className="ds-card ds-fade-in">
          <div className="ds-empty">
            <div className="ds-empty-icon">📚</div>
            <div className="ds-empty-title">No subjects</div>
            <div className="ds-empty-sub">Add your first subject</div>
          </div>
        </div>
      ) : activeDepartments.length === 0 ? (
        <div className="ds-card ds-fade-in">
          <div className="ds-empty">
            <div className="ds-empty-icon">🔍</div>
            <div className="ds-empty-title">No matches</div>
            <div className="ds-empty-sub">Try adjusting your search or filter</div>
          </div>
        </div>
      ) : (
        <div className="ds-subjects-departments ds-fade-in">
          {activeDepartments.map((dept, deptIdx) => {
            const semesters = grouped[dept];
            const semKeys = sortSemesters(Object.keys(semesters));
            const color = deptColors[dept] || defaultColor;
            const totalInDept = semKeys.reduce((sum, s) => sum + semesters[s].length, 0);
            const isCollapsed = collapsedDepts.has(dept);

            return (
              <div
                key={dept}
                className="ds-dept-section"
                style={{
                  animationDelay: `${deptIdx * 0.08}s`,
                  borderColor: color.border,
                }}
              >
                {/* Department header */}
                <button
                  className="ds-dept-header"
                  onClick={() => toggleCollapse(dept)}
                  style={{ '--dept-color': color.text, '--dept-bg': color.bg } as React.CSSProperties}
                >
                  <div className="ds-dept-header-left">
                    <span className="ds-dept-icon" style={{ background: color.bg, borderColor: color.border }}>
                      {deptIcons[dept] || '📁'}
                    </span>
                    <div>
                      <h2 className="ds-dept-title">{dept}</h2>
                      <span className="ds-dept-meta">{totalInDept} subject{totalInDept !== 1 ? 's' : ''} · {semKeys.length} semester{semKeys.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div className="ds-dept-header-right">
                    <span className="ds-dept-count" style={{ background: color.bg, color: color.text, borderColor: color.border }}>
                      {totalInDept}
                    </span>
                    <svg
                      className={`ds-dept-chevron ${isCollapsed ? '' : 'open'}`}
                      fill="none" viewBox="0 0 24 24" stroke={color.text}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Semester sections */}
                {!isCollapsed && (
                  <div className="ds-dept-body">
                    {semKeys.map(sem => (
                      <div key={sem} className="ds-sem-section">
                        <div className="ds-sem-header">
                          <div className="ds-sem-line" style={{ background: color.accent }} />
                          <span className="ds-sem-label">{sem}</span>
                          <span className="ds-sem-count">{semesters[sem].length} subject{semesters[sem].length !== 1 ? 's' : ''}</span>
                          <div className="ds-sem-line-rest" style={{ background: `linear-gradient(90deg, ${color.border}, transparent)` }} />
                        </div>
                        <div className="ds-subjects-grid">
                          {semesters[sem].map((s: any, idx: number) => (
                            <div
                              key={s.id}
                              className="ds-subject-card"
                              style={{
                                animationDelay: `${idx * 0.04}s`,
                                '--card-accent': color.text,
                                '--card-bg': color.bg,
                                '--card-border': color.border,
                              } as React.CSSProperties}
                            >
                              <div className="ds-subject-card-top">
                                <span className="ds-subject-code" style={{ background: color.bg, color: color.text, borderColor: color.border }}>
                                  {s.code}
                                </span>
                                <span className="ds-subject-credits" title="Credits">
                                  {s.credits} cr
                                </span>
                              </div>
                              <h4 className="ds-subject-name">{s.name}</h4>
                              <div className="ds-subject-card-bottom">
                                <span className="ds-subject-sem">
                                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '12px', height: '12px' }}>
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  {s.semester || 'N/A'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
