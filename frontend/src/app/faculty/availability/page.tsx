'use client';
import { useEffect, useState, FormEvent } from 'react';
import { api } from '@/lib/api';

export default function FacultyAvailabilityPage() {
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ day: 'Monday', start_time: '09:00', end_time: '10:00', is_available: true, note: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const load = () => api.getFacultyAvailability().then(d => { setSlots(d.availability || []); setLoading(false); }).catch(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true); setMsg('');
    try {
      await api.setFacultyAvailability(form);
      setMsg('Availability updated!');
      load();
    } catch (err: any) { setMsg(err.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    await api.deleteFacultyAvailability(id);
    load();
  };

  return (
    <div>
      <div className="ds-page-header ds-fade-in">
        <h1 className="ds-page-title">Set Availability ⏰</h1>
        <p className="ds-page-sub">Define your available time slots so admin can plan the timetable accordingly</p>
      </div>

      <div className="ds-grid-2" style={{ alignItems: 'start' }}>
        {/* Form */}
        <div className="ds-card ds-fade-in">
          <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: '#1c0a00', marginBottom: '1.2rem', fontSize: '1rem' }}>Add Slot</h3>
          {msg && <div className={`ds-alert ${msg.includes('Failed') ? 'ds-alert-error' : 'ds-alert-success'}`}>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={msg.includes('Failed') ? 'M12 8v4m0 4h.01' : 'M5 13l4 4L19 7'} /></svg>{msg}
          </div>}
          <form onSubmit={handleSubmit}>
            <div className="ds-form-group">
              <label className="ds-label">Day</label>
              <select className="ds-select" value={form.day} onChange={e => setForm({ ...form, day: e.target.value })}>
                {days.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="ds-form-group">
                <label className="ds-label">Start Time</label>
                <input className="ds-input" type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} required />
              </div>
              <div className="ds-form-group">
                <label className="ds-label">End Time</label>
                <input className="ds-input" type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} required />
              </div>
            </div>
            <div className="ds-form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: '#4a3020', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.is_available} onChange={e => setForm({ ...form, is_available: e.target.checked })} style={{ accentColor: '#f97316' }} />
                I am available during this slot
              </label>
            </div>
            <div className="ds-form-group">
              <label className="ds-label">Note (optional)</label>
              <input className="ds-input" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="e.g., Preferred for Theory classes" />
            </div>
            <button type="submit" className="ds-btn ds-btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={saving}>
              {saving ? 'Saving...' : 'Save Availability'}
            </button>
          </form>
        </div>

        {/* Existing slots */}
        <div className="ds-card ds-fade-in" style={{ animationDelay: '0.1s' }}>
          <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: '#1c0a00', marginBottom: '1rem', fontSize: '1rem' }}>Your Slots</h3>
          {loading ? <p style={{ color: '#9a7b6a', fontSize: '0.85rem' }}>Loading…</p> :
            slots.length === 0 ? <div className="ds-empty"><div className="ds-empty-icon">📭</div><div className="ds-empty-title">No slots set</div></div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {slots.map((s: any) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 0.85rem', background: s.is_available ? 'rgba(22,163,74,0.05)' : 'rgba(220,38,38,0.05)', border: `1px solid ${s.is_available ? 'rgba(22,163,74,0.15)' : 'rgba(220,38,38,0.15)'}`, borderRadius: 10 }}>
                    <div>
                      <div style={{ fontWeight: 600, color: '#1c0a00', fontSize: '0.82rem' }}>{s.day}</div>
                      <div style={{ fontSize: '0.75rem', color: '#9a7b6a' }}>{s.start_time?.slice(0, 5)} – {s.end_time?.slice(0, 5)}</div>
                      {s.note && <div style={{ fontSize: '0.7rem', color: '#b89070', marginTop: 2 }}>{s.note}</div>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className={`ds-badge ${s.is_available ? 'ds-badge-green' : 'ds-badge-red'}`}>{s.is_available ? 'Free' : 'Busy'}</span>
                      <button className="ds-btn ds-btn-ghost" style={{ padding: '0.3rem' }} onClick={() => handleDelete(s.id)}>
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: 14, height: 14 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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
