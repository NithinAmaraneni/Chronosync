'use client';
import { useEffect, useState, FormEvent } from 'react';
import { api } from '@/lib/api';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function BookSlotPage() {
  const [faculty, setFaculty] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ faculty_id: '', date: '', start_time: '', end_time: '', purpose: 'counseling', description: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error'>('success');
  const [slots, setSlots] = useState<any[]>([]);
  const [slotsInfo, setSlotsInfo] = useState<any>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [tab, setTab] = useState('all');
  const [step, setStep] = useState(1); // 1=select faculty, 2=pick slot, 3=confirm

  useEffect(() => {
    Promise.allSettled([
      api.getStudentFacultyList().then(d => setFaculty(d.faculty || [])),
      api.getStudentBookings().then(d => setBookings(d.bookings || [])),
    ]).finally(() => setLoading(false));
  }, []);

  // Load faculty slots when faculty + date selected
  const loadSlots = async () => {
    if (!form.faculty_id || !form.date) return;
    setLoadingSlots(true);
    try {
      const d = await api.getFacultySlots(form.faculty_id, form.date);
      setSlots(d.slots || []);
      setSlotsInfo(d);
    } catch { setSlots([]); }
    finally { setLoadingSlots(false); }
  };

  useEffect(() => { if (form.faculty_id && form.date) loadSlots(); }, [form.faculty_id, form.date]);

  const selectSlot = (slot: any) => {
    if (slot.status !== 'available') return;
    setForm(prev => ({ ...prev, start_time: slot.start, end_time: slot.end }));
    setStep(3);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true); setMsg('');
    try {
      const res = await api.bookSlot(form);
      setMsg(res.message || '✅ Slot booked!'); setMsgType('success');
      setForm({ faculty_id: '', date: '', start_time: '', end_time: '', purpose: 'counseling', description: '' });
      setStep(1); setSlots([]); setSlotsInfo(null);
      const d = await api.getStudentBookings();
      setBookings(d.bookings || []);
    } catch (err: any) {
      setMsg(err.message || 'Failed to book');
      setMsgType('error');
    }
    finally { setSaving(false); }
  };

  const handleCancel = async (id: string) => {
    try {
      await api.cancelBooking(id);
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'cancelled' } : b));
      setMsg('Booking cancelled'); setMsgType('success');
    } catch (err: any) { setMsg(err.message || 'Failed'); setMsgType('error'); }
  };

  const purposeLabels: Record<string, { icon: string; label: string }> = {
    counseling: { icon: '🧠', label: 'Counseling' },
    meeting: { icon: '🤝', label: 'Meeting' },
    doubt_clearing: { icon: '❓', label: 'Doubt Clearing' },
    project_review: { icon: '📋', label: 'Project Review' },
    other: { icon: '📌', label: 'Other' },
  };

  const statusStyles: Record<string, { badge: string; icon: string }> = {
    pending: { badge: 'ds-badge-amber', icon: '⏳' },
    approved: { badge: 'ds-badge-green', icon: '✅' },
    rejected: { badge: 'ds-badge-red', icon: '❌' },
    completed: { badge: 'ds-badge-blue', icon: '✔️' },
    cancelled: { badge: 'ds-badge-slate', icon: '🚫' },
  };

  const slotColors: Record<string, { bg: string; border: string; text: string }> = {
    available: { bg: 'rgba(22,163,74,0.06)', border: 'rgba(22,163,74,0.2)', text: '#16a34a' },
    class: { bg: 'rgba(37,99,235,0.06)', border: 'rgba(37,99,235,0.15)', text: '#2563eb' },
    booked: { bg: 'rgba(217,119,6,0.06)', border: 'rgba(217,119,6,0.15)', text: '#d97706' },
    unavailable: { bg: 'rgba(100,116,139,0.06)', border: 'rgba(100,116,139,0.12)', text: '#64748b' },
  };

  const selectedFaculty = faculty.find(f => f.id === form.faculty_id);
  const filtered = tab === 'all' ? bookings : bookings.filter(b => b.status === tab);
  const counts = { pending: 0, approved: 0, completed: 0 };
  for (const b of bookings) { if (counts[b.status as keyof typeof counts] !== undefined) counts[b.status as keyof typeof counts]++; }

  return (
    <div>
      <div className="ds-page-header ds-fade-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 16, background: 'linear-gradient(135deg, #7c3aed, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', boxShadow: '0 4px 14px rgba(124,58,237,0.3)' }}>🎫</div>
          <div>
            <h1 className="ds-page-title" style={{ marginBottom: 2 }}>Book a Slot</h1>
            <p className="ds-page-sub">Schedule meetings with your faculty • Time conflict detection</p>
          </div>
        </div>
      </div>

      {msg && <div className={`ds-alert ${msgType === 'error' ? 'ds-alert-error' : 'ds-alert-success'} ds-fade-in`}>
        <span style={{ flex: 1 }}>{msg}</span>
        <button className="ds-btn ds-btn-ghost" style={{ padding: '0.2rem' }} onClick={() => setMsg('')}>✕</button>
      </div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* ══════════ BOOKING WIZARD ══════════ */}
        <div className="ds-card ds-fade-in">
          {/* Step indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.2rem' }}>
            {[
              { n: 1, label: 'Faculty & Date' },
              { n: 2, label: 'Pick Slot' },
              { n: 3, label: 'Confirm' },
            ].map((s, i) => (
              <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: step >= s.n ? 'linear-gradient(135deg, #f97316, #ea580c)' : 'rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', color: step >= s.n ? '#fff' : '#9a7b6a', fontWeight: 700, transition: 'all 0.3s' }}>{s.n}</div>
                <span style={{ fontSize: '0.72rem', color: step >= s.n ? '#ea580c' : '#9a7b6a', fontWeight: step === s.n ? 700 : 500 }}>{s.label}</span>
                {i < 2 && <div style={{ width: 20, height: 1, background: step > s.n ? '#f97316' : 'rgba(0,0,0,0.08)', transition: 'all 0.3s' }} />}
              </div>
            ))}
          </div>

          {/* Step 1: Faculty + Date */}
          <div className="ds-form-group">
            <label className="ds-label">Faculty</label>
            <select className="ds-select" value={form.faculty_id} onChange={e => { setForm({ ...form, faculty_id: e.target.value, start_time: '', end_time: '' }); setStep(1); }} required>
              <option value="" disabled>Select faculty member</option>
              {faculty.map((f: any) => (
                <option key={f.id} value={f.id}>{f.full_name} — {f.subjects?.length > 0 ? f.subjects.join(', ') : f.department}</option>
              ))}
            </select>
          </div>
          <div className="ds-form-group">
            <label className="ds-label">Date</label>
            <input className="ds-input" type="date" value={form.date} onChange={e => { setForm({ ...form, date: e.target.value, start_time: '', end_time: '' }); setStep(form.faculty_id ? 2 : 1); }} required min={new Date().toISOString().split('T')[0]} />
          </div>

          {/* Step 2: Slot picker */}
          {step >= 2 && form.faculty_id && form.date && (
            <div className="ds-fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                <label className="ds-label" style={{ margin: 0 }}>
                  Available Slots — {slotsInfo?.day || ''}
                  {slotsInfo?.isOnLeave && <span className="ds-badge ds-badge-red" style={{ marginLeft: 6 }}>On Leave</span>}
                </label>
                {loadingSlots && <span style={{ width: 14, height: 14, border: '2px solid #f97316', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }} />}
              </div>

              {/* Summary */}
              {slotsInfo?.summary && (
                <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
                  <span className="ds-badge ds-badge-green">{slotsInfo.summary.available} free</span>
                  <span className="ds-badge ds-badge-blue">{slotsInfo.summary.class} class</span>
                  <span className="ds-badge ds-badge-amber">{slotsInfo.summary.booked} booked</span>
                  {slotsInfo.summary.unavailable > 0 && <span className="ds-badge ds-badge-slate">{slotsInfo.summary.unavailable} unavail</span>}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.3rem', maxHeight: 220, overflowY: 'auto' }}>
                {slots.map((s: any, i: number) => {
                  const colors = slotColors[s.status] || slotColors.unavailable;
                  const isSelected = form.start_time === s.start && form.end_time === s.end;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => selectSlot(s)}
                      disabled={s.status !== 'available'}
                      title={s.conflict || (s.status === 'available' ? 'Click to select' : '')}
                      style={{
                        padding: '0.4rem', borderRadius: 8, border: `1.5px solid ${isSelected ? '#f97316' : colors.border}`,
                        background: isSelected ? 'rgba(249,115,22,0.1)' : colors.bg, cursor: s.status === 'available' ? 'pointer' : 'not-allowed',
                        textAlign: 'center', transition: 'all 0.15s', opacity: s.status === 'available' ? 1 : 0.55,
                        transform: isSelected ? 'scale(1.04)' : 'none',
                      }}
                    >
                      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: isSelected ? '#ea580c' : colors.text }}>{s.start}</div>
                      <div style={{ fontSize: '0.58rem', color: colors.text }}>
                        {s.status === 'available' ? '✓' : s.status === 'class' ? '📚' : s.status === 'booked' ? '🔒' : '—'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3: Purpose + Submit */}
          {step >= 3 && form.start_time && (
            <form onSubmit={handleSubmit} className="ds-fade-in" style={{ marginTop: '1rem' }}>
              {/* Selected summary */}
              <div style={{ padding: '0.7rem 0.9rem', background: 'rgba(249,115,22,0.04)', borderRadius: 12, border: '1px solid rgba(249,115,22,0.12)', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.72rem', color: '#9a7b6a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>Booking Summary</div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.82rem' }}>
                  <span style={{ fontWeight: 600, color: '#1c0a00' }}>👩‍🏫 {selectedFaculty?.full_name}</span>
                  <span style={{ color: '#9a7b6a' }}>•</span>
                  <span style={{ color: '#ea580c', fontWeight: 600 }}>📅 {form.date}</span>
                  <span style={{ color: '#9a7b6a' }}>•</span>
                  <span style={{ color: '#1c0a00', fontWeight: 600 }}>⏰ {form.start_time} – {form.end_time}</span>
                </div>
              </div>

              <div className="ds-form-group">
                <label className="ds-label">Purpose</label>
                <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                  {Object.entries(purposeLabels).map(([key, val]) => (
                    <button key={key} type="button" onClick={() => setForm(prev => ({ ...prev, purpose: key }))}
                      style={{ padding: '0.4rem 0.8rem', borderRadius: 8, border: `1.5px solid ${form.purpose === key ? 'rgba(249,115,22,0.3)' : 'rgba(0,0,0,0.08)'}`, background: form.purpose === key ? 'rgba(249,115,22,0.06)' : 'transparent', fontSize: '0.75rem', fontWeight: form.purpose === key ? 600 : 500, color: form.purpose === key ? '#ea580c' : '#7c5a4a', cursor: 'pointer', transition: 'all 0.15s', fontFamily: "'DM Sans',sans-serif" }}>
                      {val.icon} {val.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="ds-form-group">
                <label className="ds-label">Description (Optional)</label>
                <textarea className="ds-textarea" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Briefly describe what you'd like to discuss..." />
              </div>

              <button type="submit" className="ds-btn ds-btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={saving}>
                {saving ? '⏳ Booking...' : '🎫 Confirm Booking'}
              </button>
            </form>
          )}
        </div>

        {/* ══════════ BOOKING HISTORY ══════════ */}
        <div className="ds-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="ds-tabs" style={{ marginBottom: '0.6rem' }}>
            {['all', 'pending', 'approved', 'completed'].map(t => (
              <button key={t} className={`ds-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)} style={{ fontSize: '0.72rem', padding: '0.4rem 0.8rem' }}>
                {t === 'all' ? `All (${bookings.length})` : `${statusStyles[t]?.icon} ${t.charAt(0).toUpperCase() + t.slice(1)} (${counts[t as keyof typeof counts] || 0})`}
              </button>
            ))}
          </div>

          <div className="ds-card" style={{ maxHeight: 650, overflowY: 'auto' }}>
            <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: '#1c0a00', marginBottom: '0.8rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 6 }}>
              📋 My Bookings
              {bookings.length > 0 && <span className="ds-badge ds-badge-slate">{bookings.length}</span>}
            </h3>
            {loading ? <p style={{ color: '#9a7b6a' }}>Loading…</p> :
              filtered.length === 0 ? (
                <div className="ds-empty"><div className="ds-empty-icon">🎫</div><div className="ds-empty-title">No {tab !== 'all' ? tab : ''} bookings</div><div className="ds-empty-sub">Book a slot with your faculty using the wizard</div></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {filtered.map((b: any) => {
                    const style = statusStyles[b.status] || statusStyles.pending;
                    const purpose = purposeLabels[b.purpose] || purposeLabels.other;
                    const isPast = new Date(b.date) < new Date(new Date().toDateString());
                    return (
                      <div key={b.id} style={{ padding: '0.75rem 0.9rem', background: b.status === 'approved' ? 'rgba(22,163,74,0.03)' : b.status === 'rejected' ? 'rgba(220,38,38,0.03)' : 'rgba(255,248,240,0.8)', border: `1px solid ${b.status === 'approved' ? 'rgba(22,163,74,0.1)' : b.status === 'rejected' ? 'rgba(220,38,38,0.1)' : 'rgba(249,115,22,0.1)'}`, borderRadius: 12, transition: 'all 0.2s' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: '0.95rem' }}>{style.icon}</span>
                            <span style={{ fontWeight: 600, color: '#1c0a00', fontSize: '0.83rem' }}>{b.faculty?.full_name}</span>
                          </div>
                          <span className={`ds-badge ${style.badge}`}>{b.status}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.75rem', color: '#7c5a4a', marginBottom: '0.15rem' }}>
                          <span>📅 {new Date(b.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })}</span>
                          <span>⏰ {b.start_time?.slice(0, 5)} – {b.end_time?.slice(0, 5)}</span>
                          <span>{purpose.icon} {purpose.label}</span>
                        </div>
                        {b.description && <div style={{ fontSize: '0.72rem', color: '#b89070', marginTop: '0.15rem' }}>{b.description}</div>}
                        {b.status === 'pending' && !isPast && (
                          <button className="ds-btn ds-btn-danger" style={{ padding: '0.25rem 0.6rem', fontSize: '0.68rem', marginTop: '0.4rem' }} onClick={() => handleCancel(b.id)}>Cancel</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            }
          </div>
        </div>
      </div>
    </div>
  );
}
