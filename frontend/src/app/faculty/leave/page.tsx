'use client';
import { useEffect, useState, FormEvent } from 'react';
import { api } from '@/lib/api';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function FacultyLeavePage() {
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ start_date: '', end_date: '', reason: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [impact, setImpact] = useState<any>(null);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [tab, setTab] = useState('all');

  const load = () => api.getFacultyLeaves().then(d => { setLeaves(d.leaves || []); setLoading(false); }).catch(() => setLoading(false));
  useEffect(() => { load(); }, []);

  // Load impact preview when form opens
  const handleOpenForm = async () => {
    setShowForm(true);
    setLoadingImpact(true);
    try {
      const d = await api.getLeaveImpact();
      setImpact(d.impact);
    } catch (err) { console.error(err); }
    finally { setLoadingImpact(false); }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true); setMsg('');
    try {
      await api.applyFacultyLeave(form);
      setMsg('✅ Leave request submitted successfully! Your classes will be automatically reassigned when approved.');
      setForm({ start_date: '', end_date: '', reason: '' });
      setShowForm(false);
      setImpact(null);
      load();
    } catch (err: any) { setMsg(err.message || 'Failed to submit'); }
    finally { setSaving(false); }
  };

  const statusBadge = (s: string) => {
    if (s === 'approved') return 'ds-badge-green';
    if (s === 'rejected') return 'ds-badge-red';
    return 'ds-badge-amber';
  };

  const statusIcon = (s: string) => {
    if (s === 'approved') return '✅';
    if (s === 'rejected') return '❌';
    return '⏳';
  };

  const filtered = tab === 'all' ? leaves : leaves.filter(l => l.status === tab);

  // Count by status  
  const counts = { pending: 0, approved: 0, rejected: 0 };
  for (const l of leaves) {
    if (counts[l.status as keyof typeof counts] !== undefined) counts[l.status as keyof typeof counts]++;
  }

  return (
    <div>
      <div className="ds-page-header ds-fade-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 16, background: 'linear-gradient(135deg, #f97316, #eab308)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', boxShadow: '0 4px 14px rgba(249,115,22,0.3)' }}>🏖️</div>
          <div>
            <h1 className="ds-page-title" style={{ marginBottom: 2 }}>Leave Management</h1>
            <p className="ds-page-sub">Apply for leave with automatic class reassignment</p>
          </div>
        </div>
        <button className="ds-btn ds-btn-primary" onClick={showForm ? () => { setShowForm(false); setImpact(null); } : handleOpenForm}>
          {showForm ? (
            <><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>Close</>
          ) : (
            <><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>Apply Leave</>
          )}
        </button>
      </div>

      {msg && <div className={`ds-alert ${msg.includes('Failed') || msg.includes('❌') ? 'ds-alert-error' : 'ds-alert-success'} ds-fade-in`}>
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        <span style={{ flex: 1 }}>{msg}</span>
        <button className="ds-btn ds-btn-ghost" style={{ padding: '0.2rem' }} onClick={() => setMsg('')}>✕</button>
      </div>}

      {/* ══════════════════════════════════ */}
      {/* LEAVE APPLICATION FORM + IMPACT   */}
      {/* ══════════════════════════════════ */}
      {showForm && (
        <div className="ds-fade-in" style={{ display: 'grid', gridTemplateColumns: impact?.totalClasses ? '1fr 1fr' : '1fr', gap: '1.5rem', marginBottom: '2rem' }}>
          {/* Form */}
          <div className="ds-card">
            <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: '#1c0a00', marginBottom: '1rem', fontSize: '1rem' }}>📝 New Leave Request</h3>
            <form onSubmit={handleSubmit}>
              <div className="ds-grid-2">
                <div className="ds-form-group">
                  <label className="ds-label">Start Date *</label>
                  <input className="ds-input" type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} min={new Date().toISOString().split('T')[0]} required />
                </div>
                <div className="ds-form-group">
                  <label className="ds-label">End Date *</label>
                  <input className="ds-input" type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} min={form.start_date || new Date().toISOString().split('T')[0]} required />
                </div>
              </div>
              <div className="ds-form-group">
                <label className="ds-label">Reason *</label>
                <textarea className="ds-textarea" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Briefly describe the reason for leave..." required />
              </div>

              <div className="ds-alert ds-alert-info" style={{ marginBottom: '1rem' }}>
                <span>🤖</span>
                <span style={{ fontSize: '0.78rem' }}>When your leave is approved, ChronoSync will <strong>automatically find replacement faculty</strong> based on subject expertise and availability.</span>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="ds-btn ds-btn-primary" disabled={saving} style={{ flex: 1, justifyContent: 'center' }}>
                  {saving ? '⏳ Submitting...' : '📤 Submit Leave Request'}
                </button>
                <button type="button" className="ds-btn ds-btn-ghost" onClick={() => { setShowForm(false); setImpact(null); }}>Cancel</button>
              </div>
            </form>
          </div>

          {/* Impact Preview */}
          {impact?.totalClasses > 0 && (
            <div className="ds-card" style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.02), rgba(124,58,237,0.02))' }}>
              <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: '#1c0a00', marginBottom: '0.8rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                ⚡ Impact Preview
                {loadingImpact && <span style={{ width: 14, height: 14, border: '2px solid #f97316', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }} />}
              </h3>

              {/* Summary stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
                <div style={{ padding: '0.6rem', background: 'rgba(249,115,22,0.06)', borderRadius: 10, textAlign: 'center', border: '1px solid rgba(249,115,22,0.12)' }}>
                  <div style={{ fontSize: '0.6rem', color: '#ea580c', textTransform: 'uppercase', fontWeight: 700 }}>Classes</div>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '1.3rem', color: '#ea580c' }}>{impact.totalClasses}</div>
                </div>
                <div style={{ padding: '0.6rem', background: 'rgba(22,163,74,0.06)', borderRadius: 10, textAlign: 'center', border: '1px solid rgba(22,163,74,0.12)' }}>
                  <div style={{ fontSize: '0.6rem', color: '#16a34a', textTransform: 'uppercase', fontWeight: 700 }}>Auto-assign</div>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '1.3rem', color: '#16a34a' }}>{impact.autoAssignable}</div>
                </div>
                <div style={{ padding: '0.6rem', background: impact.needsManual > 0 ? 'rgba(220,38,38,0.06)' : 'rgba(22,163,74,0.06)', borderRadius: 10, textAlign: 'center', border: `1px solid ${impact.needsManual > 0 ? 'rgba(220,38,38,0.12)' : 'rgba(22,163,74,0.12)'}` }}>
                  <div style={{ fontSize: '0.6rem', color: impact.needsManual > 0 ? '#dc2626' : '#16a34a', textTransform: 'uppercase', fontWeight: 700 }}>Manual</div>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '1.3rem', color: impact.needsManual > 0 ? '#dc2626' : '#16a34a' }}>{impact.needsManual}</div>
                </div>
              </div>

              <p style={{ fontSize: '0.78rem', color: '#7c5a4a', marginBottom: '0.8rem', lineHeight: 1.5, padding: '0.5rem 0.6rem', background: 'rgba(249,115,22,0.04)', borderRadius: 8 }}>
                {impact.message}
              </p>

              {/* Per-slot breakdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: 260, overflowY: 'auto' }}>
                {impact.affectedSlots?.map((slot: any, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.55rem 0.7rem', background: slot.availableSubstitutes > 0 ? 'rgba(22,163,74,0.04)' : 'rgba(220,38,38,0.04)', border: `1px solid ${slot.availableSubstitutes > 0 ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)'}`, borderRadius: 10 }}>
                    <span style={{ fontSize: '0.9rem' }}>{slot.availableSubstitutes > 0 ? '✅' : '⚠️'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: '#1c0a00', fontSize: '0.8rem' }}>{slot.subject}</div>
                      <div style={{ fontSize: '0.7rem', color: '#9a7b6a' }}>{slot.day} • {slot.time}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {slot.topSubstitute ? (
                        <div>
                          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: slot.topSubstitute.isExpert ? '#16a34a' : '#d97706' }}>
                            {slot.topSubstitute.name}
                          </div>
                          <div style={{ display: 'flex', gap: '0.2rem', justifyContent: 'flex-end' }}>
                            {slot.topSubstitute.isExpert && <span className="ds-badge ds-badge-green" style={{ fontSize: '0.6rem', padding: '0.1rem 0.4rem' }}>Expert</span>}
                            <span className="ds-badge ds-badge-slate" style={{ fontSize: '0.6rem', padding: '0.1rem 0.4rem' }}>{slot.availableSubstitutes} avail</span>
                          </div>
                        </div>
                      ) : (
                        <span className="ds-badge ds-badge-red" style={{ fontSize: '0.6rem' }}>No sub</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No classes impact */}
          {impact && impact.totalClasses === 0 && (
            <div className="ds-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="ds-empty">
                <div className="ds-empty-icon">✅</div>
                <div className="ds-empty-title">No classes affected</div>
                <div className="ds-empty-sub">You have no scheduled classes. Your leave will not impact the timetable.</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════ */}
      {/* LEAVE HISTORY                     */}
      {/* ══════════════════════════════════ */}
      <div className="ds-tabs ds-fade-in" style={{ marginBottom: '1rem' }}>
        {[
          { id: 'all', label: `All (${leaves.length})` },
          { id: 'pending', label: `⏳ Pending (${counts.pending})` },
          { id: 'approved', label: `✅ Approved (${counts.approved})` },
          { id: 'rejected', label: `❌ Rejected (${counts.rejected})` },
        ].map(t => (
          <button key={t.id} className={`ds-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      <div className="ds-card ds-fade-in">
        {loading ? <p style={{ color: '#9a7b6a' }}>Loading…</p> : filtered.length === 0 ? (
          <div className="ds-empty"><div className="ds-empty-icon">📋</div><div className="ds-empty-title">No {tab !== 'all' ? tab : ''} leave requests</div><div className="ds-empty-sub">Apply for leave using the button above</div></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {filtered.map((l: any) => (
              <div key={l.id} style={{ display: 'flex', alignItems: 'start', gap: 12, padding: '1rem 1.2rem', background: l.status === 'approved' ? 'rgba(22,163,74,0.03)' : l.status === 'rejected' ? 'rgba(220,38,38,0.03)' : 'rgba(217,119,6,0.03)', border: `1px solid ${l.status === 'approved' ? 'rgba(22,163,74,0.1)' : l.status === 'rejected' ? 'rgba(220,38,38,0.1)' : 'rgba(217,119,6,0.1)'}`, borderRadius: 14, transition: 'all 0.2s' }}>
                <span style={{ fontSize: '1.4rem', flexShrink: 0, marginTop: 2 }}>{statusIcon(l.status)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.25rem' }}>
                    <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: '#1c0a00', fontSize: '0.88rem' }}>
                      {new Date(l.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} → {new Date(l.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span className={`ds-badge ${statusBadge(l.status)}`}>{l.status}</span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#7c5a4a', lineHeight: 1.5 }}>{l.reason}</div>
                  {l.admin_note && (
                    <div style={{ marginTop: '0.4rem', padding: '0.4rem 0.6rem', background: 'rgba(249,115,22,0.04)', borderRadius: 8, fontSize: '0.75rem', color: '#9a7b6a' }}>
                      💬 Admin: {l.admin_note}
                    </div>
                  )}
                  {l.status === 'approved' && (
                    <div style={{ marginTop: '0.4rem', padding: '0.4rem 0.6rem', background: 'rgba(22,163,74,0.04)', borderRadius: 8, fontSize: '0.75rem', color: '#16a34a' }}>
                      🤖 Classes have been automatically reassigned to substitute faculty
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#b89070', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {new Date(l.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
