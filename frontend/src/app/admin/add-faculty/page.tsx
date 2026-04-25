'use client';
import { useState, FormEvent } from 'react';
import { api } from '@/lib/api';
import CSVUpload from '@/components/CSVUpload';

export default function AddFacultyPage() {
  const [form, setForm] = useState({ fullName: '', email: '', department: '', subjects: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState<{ userId: string; message: string } | null>(null);
  const [error, setError] = useState('');

  const departments = ['Computer Science','Electronics','Mechanical','Civil','Electrical','Information Technology','Chemical','Biotechnology','Mathematics','Physics','Chemistry','Commerce','Arts'];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setSuccess(null); setIsLoading(true);
    try {
      const data = await api.createFaculty({ ...form, subjects: form.subjects.split(',').map(s => s.trim()).filter(Boolean) });
      setSuccess({ userId: data.user.userId, message: data.message });
      setForm({ fullName: '', email: '', department: '', subjects: '' });
    } catch (err: any) { setError(err.errors?.join(', ') || err.message || 'Failed.'); }
    finally { setIsLoading(false); }
  };

  return (
    <div>
      <div className="ds-page-header ds-fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 16, background: 'linear-gradient(135deg, #2563eb, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', boxShadow: '0 4px 14px rgba(37,99,235,0.3)' }}>👩‍🏫</div>
            <div>
              <h1 className="ds-page-title" style={{ marginBottom: 2 }}>Add New Faculty</h1>
              <p className="ds-page-sub">Create account manually or upload CSV for bulk import</p>
            </div>
          </div>
          <CSVUpload
            title="Faculty"
            icon="👩‍🏫"
            columns={['full_name', 'email', 'department', 'subjects']}
            sampleData={[
              ['Dr. Priya Sharma', 'priya@university.edu', 'Computer Science', 'Data Structures, Algorithms'],
              ['Prof. Rahul Verma', 'rahul@university.edu', 'Electronics', 'Digital Electronics, VLSI'],
            ]}
            onUpload={file => api.importFacultyCSV(file)}
          />
        </div>
      </div>

      {success && <div className="ds-alert ds-alert-success ds-fade-in"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg><div>{success.message} — ID: <code style={{ background: 'rgba(22,163,74,0.1)', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>{success.userId}</code></div></div>}
      {error && <div className="ds-alert ds-alert-error ds-fade-in"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" /></svg>{error}</div>}

      <form onSubmit={handleSubmit} className="ds-card ds-fade-in" style={{ animationDelay: '0.1s' }}>
        <div className="ds-form-group"><label className="ds-label">Full Name *</label><input className="ds-input" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} placeholder="e.g., Dr. Priya Sharma" required /></div>
        <div className="ds-form-group"><label className="ds-label">Email *</label><input className="ds-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="faculty@university.edu" required /></div>
        <div className="ds-form-group"><label className="ds-label">Department *</label><select className="ds-select" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} required><option value="" disabled>Select</option>{departments.map(d => <option key={d}>{d}</option>)}</select></div>
        <div className="ds-form-group"><label className="ds-label">Subjects *</label><textarea className="ds-textarea" value={form.subjects} onChange={e => setForm({ ...form, subjects: e.target.value })} placeholder="Data Structures, Algorithms, Database Management" required /><p style={{ fontSize: '0.72rem', color: '#b89070', marginTop: 4 }}>Separate multiple subjects with commas</p></div>
        <div style={{ borderTop: '1px solid rgba(249,115,22,0.08)', margin: '0.5rem 0 1rem' }} />
        <div className="ds-alert ds-alert-info" style={{ marginBottom: '1rem' }}>
          <span>💡</span>
          <span style={{ fontSize: '0.78rem' }}>A unique Faculty ID and one-time password will be generated and emailed automatically.</span>
        </div>
        <button type="submit" className="ds-btn ds-btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }} disabled={isLoading}>
          {isLoading ? '⏳ Creating...' : '👩‍🏫 Create Faculty Account'}
        </button>
      </form>
    </div>
  );
}
