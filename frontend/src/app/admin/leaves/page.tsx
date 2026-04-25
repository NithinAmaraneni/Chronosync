'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function AdminLeavesPage() {
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending');
  const [processing, setProcessing] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [msg, setMsg] = useState('');

  const load = () => api.getLeaveRequests()
    .then(d => { setLeaves(d.leaves || []); setLoading(false); })
    .catch(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const handleAction = async (leave: any, status: string) => {
    setProcessing(leave.id);
    setMsg('');
    setResult(null);
    try {
      await api.updateLeaveStatus(leave.id, status);
      setLeaves(prev => prev.map(l => l.id === leave.id ? { ...l, status } : l));

      if (status === 'approved') {
        // Show substitution result — trigger manually for immediate feedback
        setMsg(`✅ Leave approved for ${leave.faculty?.full_name || 'faculty'}. Auto-reassignment triggered.`);
        try {
          const res = await api.triggerLeaveEvent(
            leave.faculty_id,
            leave.start_date,
            leave.end_date
          );
          setResult(res);
          setMsg(res.message || '✅ Leave approved and classes reassigned.');
        } catch {
          setMsg('✅ Leave approved. Auto-reassignment running in background.');
        }
      } else {
        setMsg(`❌ Leave rejected for ${leave.faculty?.full_name || 'faculty'}.`);
      }
    } catch (err: any) { setMsg(err.message || 'Action failed.'); }
    finally { setProcessing(null); }
  };

  const filtered = tab === 'all' ? leaves : leaves.filter(l => l.status === tab);
  const counts = { pending: 0, approved: 0, rejected: 0 };
  for (const l of leaves) {
    if (counts[l.status as keyof typeof counts] !== undefined)
      counts[l.status as keyof typeof counts]++;
  }

  const statusIcon = (s: string) => s === 'approved' ? '✅' : s === 'rejected' ? '❌' : '⏳';

  return (
    <div>
      <div className="ds-page-header ds-fade-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 16, background: 'linear-gradient(135deg, #f97316, #eab308)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', boxShadow: '0 4px 14px rgba(249,115,22,0.3)' }}>🏖️</div>
          <div>
            <h1 className="ds-page-title" style={{ marginBottom: 2 }}>Leave Management</h1>
            <p className="ds-page-sub">Approve leaves → classes auto-reassign to <span>expert substitutes</span></p>
          </div>
        </div>
        <button className="ds-btn ds-btn-outline" onClick={load}>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Refresh
        </button>
      </div>

      {/* Stats row */}
      <div className="ds-grid-3 ds-stagger" style={{ marginBottom: '1.5rem' }}>
        <div className="ds-stat-card" onClick={() => setTab('pending')} style={{ cursor: 'pointer', borderColor: tab === 'pending' ? 'rgba(217,119,6,0.3)' : undefined }}>
          <div className="ds-stat-icon" style={{ background: 'rgba(217,119,6,0.08)' }}>⏳</div>
          <div className="ds-stat-value" style={{ color: '#d97706' }}>{counts.pending}</div>
          <div className="ds-stat-label">Pending Review</div>
        </div>
        <div className="ds-stat-card" onClick={() => setTab('approved')} style={{ cursor: 'pointer', borderColor: tab === 'approved' ? 'rgba(22,163,74,0.3)' : undefined }}>
          <div className="ds-stat-icon" style={{ background: 'rgba(22,163,74,0.08)' }}>✅</div>
          <div className="ds-stat-value" style={{ color: '#16a34a' }}>{counts.approved}</div>
          <div className="ds-stat-label">Approved</div>
        </div>
        <div className="ds-stat-card" onClick={() => setTab('rejected')} style={{ cursor: 'pointer', borderColor: tab === 'rejected' ? 'rgba(220,38,38,0.3)' : undefined }}>
          <div className="ds-stat-icon" style={{ background: 'rgba(220,38,38,0.08)' }}>❌</div>
          <div className="ds-stat-value" style={{ color: '#dc2626' }}>{counts.rejected}</div>
          <div className="ds-stat-label">Rejected</div>
        </div>
      </div>

      {msg && <div className={`ds-alert ${msg.includes('❌') || msg.includes('failed') ? 'ds-alert-error' : msg.includes('⚠️') ? 'ds-alert-info' : 'ds-alert-success'} ds-fade-in`}>
        <span style={{ flex: 1 }}>{msg}</span>
        <button className="ds-btn ds-btn-ghost" style={{ padding: '0.2rem' }} onClick={() => { setMsg(''); setResult(null); }}>✕</button>
      </div>}

      {/* Substitution result panel */}
      {result?.changes?.length > 0 && (
        <div className="ds-card ds-fade-in" style={{ marginBottom: '1.5rem', background: 'linear-gradient(135deg, rgba(22,163,74,0.02), rgba(124,58,237,0.02))' }}>
          <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: '#1c0a00', marginBottom: '0.8rem', fontSize: '0.95rem' }}>
            🤖 Auto-Substitution Results
            <span className="ds-badge ds-badge-green" style={{ marginLeft: 8 }}>{result.substituted || result.changes.length} assigned</span>
            {result.remaining > 0 && <span className="ds-badge ds-badge-amber" style={{ marginLeft: 4 }}>{result.remaining} manual</span>}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: 250, overflowY: 'auto' }}>
            {result.changes.map((c: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.5rem 0.7rem', background: 'rgba(22,163,74,0.04)', border: '1px solid rgba(22,163,74,0.1)', borderRadius: 10 }}>
                <span style={{ fontSize: '0.85rem' }}>🔄</span>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600, color: '#1c0a00', fontSize: '0.82rem' }}>{c.subject || 'Class'}</span>
                  <span style={{ color: '#9a7b6a', fontSize: '0.75rem', marginLeft: 6 }}>{c.day} {c.time}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontWeight: 600, color: '#16a34a', fontSize: '0.78rem' }}>→ {c.toName}</span>
                  {c.matchReasons && (
                    <div style={{ display: 'flex', gap: '0.15rem', justifyContent: 'flex-end', marginTop: 2 }}>
                      {c.matchReasons.map((r: string, j: number) => (
                        <span key={j} className={`ds-badge ${r === 'subject expert' ? 'ds-badge-green' : 'ds-badge-slate'}`} style={{ fontSize: '0.58rem', padding: '0.08rem 0.3rem' }}>{r}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="ds-tabs ds-fade-in" style={{ marginBottom: '1rem' }}>
        {[
          { id: 'pending', label: `⏳ Pending (${counts.pending})` },
          { id: 'approved', label: `✅ Approved (${counts.approved})` },
          { id: 'rejected', label: `❌ Rejected (${counts.rejected})` },
          { id: 'all', label: `All (${leaves.length})` },
        ].map(t => (
          <button key={t.id} className={`ds-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* Leave cards */}
      <div className="ds-fade-in">
        {loading ? <div className="ds-card"><p style={{ color: '#9a7b6a' }}>Loading…</p></div> : filtered.length === 0 ? (
          <div className="ds-card">
            <div className="ds-empty"><div className="ds-empty-icon">📋</div><div className="ds-empty-title">No {tab !== 'all' ? tab : ''} leave requests</div></div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {filtered.map((l: any) => {
              const isProcessing = processing === l.id;
              return (
                <div key={l.id} style={{ display: 'flex', alignItems: 'start', gap: 12, padding: '1rem 1.2rem', background: l.status === 'approved' ? 'rgba(22,163,74,0.03)' : l.status === 'rejected' ? 'rgba(220,38,38,0.03)' : 'rgba(255,255,255,0.85)', border: `1px solid ${l.status === 'approved' ? 'rgba(22,163,74,0.1)' : l.status === 'rejected' ? 'rgba(220,38,38,0.1)' : 'rgba(249,115,22,0.1)'}`, borderRadius: 14, transition: 'all 0.2s' }}>
                  <span style={{ fontSize: '1.4rem', flexShrink: 0, marginTop: 2 }}>{statusIcon(l.status)}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: '#1c0a00', fontSize: '0.9rem' }}>{l.faculty?.full_name || 'Faculty'}</span>
                      <span className={`ds-badge ${l.status === 'approved' ? 'ds-badge-green' : l.status === 'rejected' ? 'ds-badge-red' : 'ds-badge-amber'}`}>{l.status}</span>
                      {l.faculty?.department && <span className="ds-badge ds-badge-slate">{l.faculty.department}</span>}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#4a3020', marginBottom: '0.2rem' }}>
                      📅 {new Date(l.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} → {new Date(l.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#7c5a4a' }}>💬 {l.reason}</div>
                    {l.status === 'approved' && (
                      <div style={{ marginTop: '0.4rem', padding: '0.35rem 0.6rem', background: 'rgba(22,163,74,0.04)', borderRadius: 8, fontSize: '0.72rem', color: '#16a34a' }}>
                        🤖 System auto-assigned substitute faculty based on expertise match
                      </div>
                    )}
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    {l.status === 'pending' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <button
                          className="ds-btn ds-btn-primary"
                          style={{ padding: '0.4rem 0.9rem', fontSize: '0.72rem', justifyContent: 'center' }}
                          disabled={isProcessing}
                          onClick={() => handleAction(l, 'approved')}
                        >
                          {isProcessing ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ width: 12, height: 12, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }} />
                              Processing...
                            </span>
                          ) : '✅ Approve & Reassign'}
                        </button>
                        <button
                          className="ds-btn ds-btn-danger"
                          style={{ padding: '0.4rem 0.9rem', fontSize: '0.72rem', justifyContent: 'center' }}
                          disabled={isProcessing}
                          onClick={() => handleAction(l, 'rejected')}
                        >
                          ❌ Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
