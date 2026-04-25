'use client';
import { useEffect, useState, FormEvent } from 'react';
import { api } from '@/lib/api';
import CSVUpload from '@/components/CSVUpload';

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

  const departments = ['Computer Science','Electronics','Mechanical','Civil','Electrical','Information Technology','Chemical','Biotechnology','Mathematics','Physics','Chemistry','Commerce','Arts'];

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

  return (
    <div>
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

      {/* Create Form */}
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

      {/* Assign Form */}
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

      {/* Subjects Table */}
      <div className="ds-card ds-fade-in">
        {loading ? <p style={{ color: '#9a7b6a' }}>Loading…</p> : subjects.length === 0 ? (
          <div className="ds-empty"><div className="ds-empty-icon">📚</div><div className="ds-empty-title">No subjects</div><div className="ds-empty-sub">Add your first subject</div></div>
        ) : (
          <table className="ds-table">
            <thead><tr><th>Code</th><th>Name</th><th>Department</th><th>Credits</th><th>Semester</th></tr></thead>
            <tbody>{subjects.map((s: any) => (
              <tr key={s.id}>
                <td><span className="ds-badge ds-badge-orange">{s.code}</span></td>
                <td style={{ fontWeight: 600 }}>{s.name}</td>
                <td>{s.department}</td>
                <td>{s.credits}</td>
                <td>{s.semester || '—'}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
