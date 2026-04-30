'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '@/lib/api';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function ConflictDashboardPage() {
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ total: 0, critical: 0, high: 0, medium: 0, low: 0, slotsAffected: 0 });
  const [slotCount, setSlotCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fixing, setFixing] = useState(false);
  const [fixingSlots, setFixingSlots] = useState<Set<string>>(new Set());
  const [dept, setDept] = useState('');
  const [log, setLog] = useState<any[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [msg, setMsg] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const timerRef = useRef<any>(null);

  const departments = ['Computer Science', 'Electronics', 'Mechanical', 'Civil', 'Electrical', 'Information Technology', 'Chemical', 'Biotechnology', 'Mathematics', 'Physics', 'Chemistry', 'Commerce', 'Arts'];

  const loadConflicts = useCallback(async () => {
    try {
      const d = await api.getConflicts(dept || undefined);
      setConflicts(d.conflicts || []);
      setStats({ total: 0, critical: 0, high: 0, medium: 0, low: 0, slotsAffected: 0, ...(d.stats || {}) });
      setSlotCount(d.slotCount || 0);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [dept]);

  useEffect(() => { loadConflicts(); }, [loadConflicts]);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    if (autoRefresh) {
      timerRef.current = setInterval(loadConflicts, 15000);
      return () => clearInterval(timerRef.current);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [autoRefresh, loadConflicts]);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  // ── Auto Fix All ──
  const handleAutoFix = async () => {
    setFixing(true);
    setLog([{ t: Date.now(), msg: '🤖 Starting auto-fix...' }]);
    setShowLog(true);
    setMsg('');
    try {
      const result = await api.triggerAutoFix(dept || undefined);
      setLog(result.log || []);
      setMsg(result.message || '');
      await loadConflicts();
    } catch (err: any) {
      setMsg(err.message || 'Auto-fix failed');
      setLog(prev => [...prev, { t: Date.now(), msg: `❌ ${err.message}` }]);
    } finally {
      setFixing(false);
    }
  };

  // ── Fix specific conflict ──
  const handleFixConflict = async (conflict: any) => {
    const ids = conflict.affectedSlots || [];
    if (ids.length === 0) return;
    setFixingSlots(prev => new Set([...prev, ...ids]));
    try {
      const result = await api.triggerSmartReschedule(ids);
      setLog(prev => [...prev, ...result.log]);
      setShowLog(true);
      setMsg(result.message);
      await loadConflicts();
    } catch (err: any) {
      setMsg(err.message);
    } finally {
      setFixingSlots(prev => {
        const next = new Set(prev);
        ids.forEach((id: string) => next.delete(id));
        return next;
      });
    }
  };

  const severityStyles: Record<string, { bg: string; border: string; badge: string }> = {
    critical: { bg: 'rgba(220,38,38,0.04)', border: 'rgba(220,38,38,0.15)', badge: 'ds-badge-red' },
    high: { bg: 'rgba(217,119,6,0.04)', border: 'rgba(217,119,6,0.15)', badge: 'ds-badge-amber' },
    medium: { bg: 'rgba(37,99,235,0.04)', border: 'rgba(37,99,235,0.12)', badge: 'ds-badge-blue' },
    low: { bg: 'rgba(100,116,139,0.04)', border: 'rgba(100,116,139,0.12)', badge: 'ds-badge-slate' },
  };

  const healthScore = slotCount > 0 ? Math.max(0, Math.round(100 - (stats.total / Math.max(slotCount, 1)) * 100 * 5)) : 100;
  const healthColor = healthScore >= 80 ? '#16a34a' : healthScore >= 50 ? '#d97706' : '#dc2626';

  return (
    <div>
      {/* Header */}
      <div className="ds-page-header ds-fade-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: stats.total === 0 ? 'linear-gradient(135deg, #16a34a, #22c55e)' : 'linear-gradient(135deg, #dc2626, #f97316)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', boxShadow: `0 4px 20px ${stats.total === 0 ? 'rgba(22,163,74,0.3)' : 'rgba(220,38,38,0.3)'}`, transition: 'all 0.4s' }}>
            {stats.total === 0 ? '✅' : '⚡'}
          </div>
          <div>
            <h1 className="ds-page-title" style={{ marginBottom: 2 }}>Conflict Dashboard</h1>
            <p className="ds-page-sub">
              Real-time conflict detection • Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
              <span style={{ marginLeft: 8, width: 6, height: 6, borderRadius: '50%', background: autoRefresh ? '#22c55e' : '#94a3b8', display: 'inline-block', boxShadow: autoRefresh ? '0 0 6px #22c55e' : 'none' }} />
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: '#7c5a4a', cursor: 'pointer' }}>
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} style={{ accentColor: '#f97316' }} />
            Auto-refresh
          </label>
          <button className="ds-btn ds-btn-outline" onClick={loadConflicts} disabled={loading}>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Scan
          </button>
          <button className="ds-btn ds-btn-primary" onClick={handleAutoFix} disabled={fixing || stats.total === 0} style={{ background: fixing ? 'rgba(124,58,237,0.5)' : stats.total === 0 ? 'rgba(22,163,74,0.6)' : 'linear-gradient(135deg, #dc2626, #f97316)' }}>
            {fixing ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 14, height: 14, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }} />
                Fixing...
              </span>
            ) : stats.total === 0 ? '✅ All Clear' : `🤖 Auto-Fix All (${stats.total})`}
          </button>
        </div>
      </div>

      {msg && <div className={`ds-alert ${msg.includes('❌') || msg.includes('failed') ? 'ds-alert-error' : msg.includes('⚠️') ? 'ds-alert-info' : 'ds-alert-success'} ds-fade-in`}>
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span style={{ flex: 1 }}>{msg}</span>
        <button className="ds-btn ds-btn-ghost" style={{ padding: '0.2rem' }} onClick={() => setMsg('')}>✕</button>
      </div>}

      {/* Department filter */}
      <div style={{ marginBottom: '1.5rem' }} className="ds-fade-in">
        <div className="ds-tabs">
          <button className={`ds-tab ${dept === '' ? 'active' : ''}`} onClick={() => setDept('')}>All Depts</button>
          {departments.slice(0, 5).map(d => (
            <button key={d} className={`ds-tab ${dept === d ? 'active' : ''}`} onClick={() => setDept(d)}>{d}</button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="ds-grid-4 ds-stagger" style={{ marginBottom: '1.5rem' }}>
        {/* Health score */}
        <div className="ds-stat-card" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: -10, top: -10, width: 80, height: 80, borderRadius: '50%', background: `${healthColor}10` }} />
          <div style={{ fontSize: '0.65rem', color: '#9a7b6a', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em', marginBottom: '0.4rem' }}>Health Score</div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '2.2rem', fontWeight: 800, color: healthColor }}>{healthScore}%</div>
          <div style={{ width: '100%', background: 'rgba(0,0,0,0.06)', borderRadius: 6, height: 6, marginTop: '0.5rem' }}>
            <div style={{ width: `${healthScore}%`, background: healthColor, height: 6, borderRadius: 6, transition: 'width 0.8s ease' }} />
          </div>
        </div>

        {/* Severity breakdown */}
        <div className="ds-stat-card">
          <div className="ds-stat-icon" style={{ background: 'rgba(220,38,38,0.08)' }}>🔴</div>
          <div className="ds-stat-value" style={{ color: stats.critical > 0 ? '#dc2626' : '#1c0a00' }}>{stats.critical}</div>
          <div className="ds-stat-label">Critical</div>
        </div>
        <div className="ds-stat-card">
          <div className="ds-stat-icon" style={{ background: 'rgba(217,119,6,0.08)' }}>🟠</div>
          <div className="ds-stat-value" style={{ color: stats.high > 0 ? '#d97706' : '#1c0a00' }}>{stats.high}</div>
          <div className="ds-stat-label">High</div>
        </div>
        <div className="ds-stat-card">
          <div className="ds-stat-icon" style={{ background: 'rgba(37,99,235,0.08)' }}>🔵</div>
          <div className="ds-stat-value">{(stats.medium ?? 0) + (stats.low ?? 0)}</div>
          <div className="ds-stat-label">Medium + Low</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: showLog ? '1fr 380px' : '1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Conflicts List */}
        <div>
          {loading ? (
            <div className="ds-card"><div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>{[...Array(4)].map((_, i) => <div key={i} style={{ height: 70, background: 'rgba(249,115,22,0.04)', borderRadius: 12 }} />)}</div></div>
          ) : conflicts.length === 0 ? (
            <div className="ds-card ds-fade-in">
              <div className="ds-empty">
                <div className="ds-empty-icon">🎉</div>
                <div className="ds-empty-title">Timetable is conflict-free!</div>
                <div className="ds-empty-sub">{slotCount} slots analyzed • No issues detected</div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {conflicts.map((c: any, i: number) => {
                const style = severityStyles[c.severity] || severityStyles.low;
                const isFixing = c.affectedSlots?.some((id: string) => fixingSlots.has(id));
                return (
                  <div key={i} className="ds-fade-in" style={{ padding: '1rem 1.2rem', background: style.bg, border: `1px solid ${style.border}`, borderRadius: 14, display: 'flex', alignItems: 'start', gap: 12, animationDelay: `${i * 0.03}s`, transition: 'all 0.3s' }}>
                    <span style={{ fontSize: '1.3rem', flexShrink: 0, marginTop: 2 }}>{c.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.25rem' }}>
                        <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: '#1c0a00', fontSize: '0.88rem' }}>{c.title}</span>
                        <span className={`ds-badge ${style.badge}`}>{c.severity}</span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#7c5a4a', lineHeight: 1.5 }}>{c.description}</div>
                      <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                        {c.day && <span className="ds-badge ds-badge-slate">{c.day}</span>}
                        {c.time && <span className="ds-badge ds-badge-slate">{c.time?.slice(0, 5)}</span>}
                        {c.faculty_name && <span className="ds-badge ds-badge-orange">{c.faculty_name}</span>}
                        <span className="ds-badge ds-badge-slate">{c.affectedSlots?.length || 0} slot(s)</span>
                      </div>
                    </div>
                    <button
                      className="ds-btn ds-btn-outline"
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.72rem', flexShrink: 0, borderColor: style.border }}
                      disabled={isFixing}
                      onClick={() => handleFixConflict(c)}
                    >
                      {isFixing ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 12, height: 12, border: '2px solid currentcolor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }} />
                          Fixing
                        </span>
                      ) : '🔧 Fix'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Log Panel */}
        {showLog && (
          <div className="ds-card ds-fade-in" style={{ background: '#1a1020', border: '1px solid rgba(124,58,237,0.2)', position: 'sticky', top: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: '#e2d6f5', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: fixing ? '#22c55e' : '#64748b', boxShadow: fixing ? '0 0 6px #22c55e' : 'none' }} />
                Rescheduling Log
              </h3>
              <button className="ds-btn ds-btn-ghost" style={{ padding: '0.2rem', color: '#6b5a7a' }} onClick={() => setShowLog(false)}>✕</button>
            </div>
            <div ref={logRef} style={{ maxHeight: 400, overflowY: 'auto', fontFamily: "'JetBrains Mono','Fira Code',monospace", fontSize: '0.68rem', lineHeight: 1.9 }}>
              {log.map((entry: any, i: number) => {
                const time = new Date(entry.t).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
                const isErr = entry.msg?.includes('❌');
                const isOk = entry.msg?.includes('✅') || entry.msg?.includes('🔄');
                return (
                  <div key={i} style={{ display: 'flex', gap: 6, color: isErr ? '#f87171' : isOk ? '#4ade80' : '#d1c4e9' }}>
                    <span style={{ color: '#6b5a7a', flexShrink: 0 }}>{time}</span>
                    <span>{entry.msg}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Show log toggle */}
      {!showLog && log.length > 0 && (
        <button className="ds-btn ds-btn-ghost ds-fade-in" style={{ marginTop: '1rem' }} onClick={() => setShowLog(true)}>
          📋 Show rescheduling log ({log.length} entries)
        </button>
      )}
    </div>
  );
}
