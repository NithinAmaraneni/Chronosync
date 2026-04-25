'use client';
import { useState, FormEvent } from 'react';
import { api } from '@/lib/api';
import CSVUpload from '@/components/CSVUpload';

export default function AddStudentPage() {
  const [form, setForm] = useState({ fullName: '', email: '', degreeCourse: '', department: '', year: '', phone: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState<{ userId: string; message: string } | null>(null);
  const [error, setError] = useState('');

  const departments = ['Computer Science','Electronics','Mechanical','Civil','Electrical','Information Technology','Chemical','Biotechnology','Mathematics','Physics','Chemistry','Commerce','Arts'];
  const degrees = ['B.Tech','M.Tech','B.Sc','M.Sc','BCA','MCA','B.Com','M.Com','BA','MA','MBA','PhD'];
  const years = ['1st Year','2nd Year','3rd Year','4th Year','5th Year'];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setSuccess(null); setIsLoading(true);
    try {
      const data = await api.createStudent(form);
      setSuccess({ userId: data.user.userId, message: data.message });
      setForm({ fullName: '', email: '', degreeCourse: '', department: '', year: '', phone: '' });
    } catch (err: any) { setError(err.errors?.join(', ') || err.message || 'Failed.'); }
    finally { setIsLoading(false); }
  };

  return (
    <div>
      <div className="ds-page-header ds-fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 16, background: 'linear-gradient(135deg, #f97316, #ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', boxShadow: '0 4px 14px rgba(249,115,22,0.3)' }}>🎓</div>
            <div>
              <h1 className="ds-page-title" style={{ marginBottom: 2 }}>Add New Student</h1>
              <p className="ds-page-sub">Create account manually or upload CSV for bulk import</p>
            </div>
          </div>
          <CSVUpload
            title="Students"
            icon="🎓"
            columns={['full_name', 'email', 'degree_course', 'department', 'year', 'phone']}
            sampleData={[
              ['Arun Kumar', 'arun@university.edu', 'B.Tech', 'Computer Science', '2nd Year', '+919876543210'],
              ['Priya Singh', 'priya@university.edu', 'M.Tech', 'Electronics', '1st Year', ''],
            ]}
            onUpload={file => api.importStudentsCSV(file)}
          />
        </div>
      </div>

      {success && <div className="ds-alert ds-alert-success ds-fade-in"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg><div>{success.message} — ID: <code style={{ background: 'rgba(22,163,74,0.1)', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>{success.userId}</code></div></div>}
      {error && <div className="ds-alert ds-alert-error ds-fade-in"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" /></svg>{error}</div>}

      <form onSubmit={handleSubmit} className="ds-card ds-fade-in" style={{ animationDelay: '0.1s' }}>
        <div className="ds-form-group"><label className="ds-label">Full Name *</label><input className="ds-input" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} placeholder="e.g., Arun Kumar Sharma" required /></div>
        <div className="ds-form-group"><label className="ds-label">Email *</label><input className="ds-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="student@university.edu" required /></div>
        <div className="ds-grid-2">
          <div className="ds-form-group"><label className="ds-label">Degree / Course *</label><select className="ds-select" value={form.degreeCourse} onChange={e => setForm({ ...form, degreeCourse: e.target.value })} required><option value="" disabled>Select</option>{degrees.map(d => <option key={d}>{d}</option>)}</select></div>
          <div className="ds-form-group"><label className="ds-label">Department *</label><select className="ds-select" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} required><option value="" disabled>Select</option>{departments.map(d => <option key={d}>{d}</option>)}</select></div>
        </div>
        <div className="ds-grid-2">
          <div className="ds-form-group"><label className="ds-label">Year *</label><select className="ds-select" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} required><option value="" disabled>Select</option>{years.map(y => <option key={y}>{y}</option>)}</select></div>
          <div className="ds-form-group"><label className="ds-label">Phone <span style={{ color: '#b89070', textTransform: 'none', fontWeight: 400 }}>(optional)</span></label><input className="ds-input" type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91XXXXXXXXXX" /></div>
        </div>
        <div style={{ borderTop: '1px solid rgba(249,115,22,0.08)', margin: '0.5rem 0 1rem' }} />
        <div className="ds-alert ds-alert-info" style={{ marginBottom: '1rem' }}>
          <span>💡</span>
          <span style={{ fontSize: '0.78rem' }}>A unique Student ID and one-time password will be generated and emailed automatically.</span>
        </div>
        <button type="submit" className="ds-btn ds-btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }} disabled={isLoading}>
          {isLoading ? '⏳ Creating...' : '🎓 Create Student Account'}
        </button>
      </form>
    </div>
  );
}
