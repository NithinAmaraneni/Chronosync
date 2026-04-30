'use client';
import { useEffect, useState, FormEvent, useRef } from 'react';
import { api } from '@/lib/api';
import CSVUpload from '@/components/CSVUpload';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function AISchedulingPage() {
  // ── State ──
  const [activeTab, setActiveTab] = useState('generate');
  const [dept, setDept] = useState('');
  const [year, setYear] = useState('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [logEntries, setLogEntries] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [timeSlots, setTimeSlots] = useState<any[]>([]);
  const [constraints, setConstraints] = useState<any[]>([]);
  const [algoConfig, setAlgoConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Forms
  const [roomForm, setRoomForm] = useState({ name: '', building: '', capacity: '60', room_type: 'lecture' });
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [timeSlotForm, setTimeSlotForm] = useState({ slot_number: '1', start_time: '09:00', end_time: '10:00', slot_label: '', is_break: false });
  const [showTimeSlotForm, setShowTimeSlotForm] = useState(false);
  const [constForm, setConstForm] = useState({ constraint_type: 'max_hours_per_day', target_type: 'global', value: '5', priority: '5' });
  const [showConstForm, setShowConstForm] = useState(false);
  const [editingConstraintId, setEditingConstraintId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const logRef = useRef<HTMLDivElement>(null);

  const departments = ['Computer Science', 'Electronics', 'Mechanical', 'Civil', 'Electrical', 'Information Technology', 'Chemical', 'Biotechnology', 'Mathematics', 'Physics', 'Chemistry', 'Commerce', 'Arts'];
  const years = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'];

  // ── Load data ──
  useEffect(() => {
    Promise.allSettled([
      api.getClassrooms().then(d => setClassrooms(d.classrooms || [])),
      api.getTimeSlotTemplates().then(d => setTimeSlots(d.timeSlots || [])),
      api.getSchedulingConstraints().then(d => setConstraints(d.constraints || [])),
      api.getGenerationHistory().then(d => setHistory(d.generations || [])),
      api.getAlgorithmConfig().then(d => setAlgoConfig(d.config || null)),
    ]).finally(() => setLoading(false));
  }, []);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logEntries]);

  // ── Trigger generation ──
  const handleGenerate = async (e: FormEvent) => {
    e.preventDefault();
    if (!dept) return;
    setGenerating(true);
    setResult(null);
    setLogEntries([{ t: Date.now(), msg: '🚀 Starting AI timetable generation...' }]);
    setMsg('');

    try {
      const res = await api.triggerTimetableGeneration({ department: dept, year: year || undefined });
      setResult(res);
      setLogEntries(res.log || []);
      setMsg(res.message);
      // Refresh history
      api.getGenerationHistory().then(d => setHistory(d.generations || []));
    } catch (err: any) {
      setMsg(err.message || 'Generation failed');
      setLogEntries(prev => [...prev, { t: Date.now(), msg: `❌ ${err.message || 'Error'}` }]);
    } finally {
      setGenerating(false);
    }
  };

  // ── Room CRUD ──
  const handleAddRoom = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editingRoomId) {
        await api.updateClassroom(editingRoomId, { ...roomForm, capacity: parseInt(roomForm.capacity) });
        setMsg('Classroom updated.');
      } else {
        await api.createClassroom({ ...roomForm, capacity: parseInt(roomForm.capacity) });
        setMsg('Classroom added.');
      }
      setShowRoomForm(false);
      setEditingRoomId(null);
      setRoomForm({ name: '', building: '', capacity: '60', room_type: 'lecture' });
      const d = await api.getClassrooms();
      setClassrooms(d.classrooms || []);
    } catch (err: any) { setMsg(err.message); }
  };

  const handleDeleteRoom = async (id: string) => {
    if (!confirm('Deactivate this classroom? Affected slots may be reassigned.')) return;
    await api.deleteClassroom(id);
    const d = await api.getClassrooms();
    setClassrooms(d.classrooms || []);
  };

  const openEditRoom = (room: any) => {
    setEditingRoomId(room.id);
    setRoomForm({
      name: room.name || '',
      building: room.building || '',
      capacity: String(room.capacity || 60),
      room_type: room.room_type || 'lecture',
    });
    setShowRoomForm(true);
  };

  const handleSaveTimeSlot = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.upsertTimeSlot({
        ...timeSlotForm,
        slot_number: parseInt(timeSlotForm.slot_number),
      });
      setShowTimeSlotForm(false);
      setTimeSlotForm({ slot_number: '1', start_time: '09:00', end_time: '10:00', slot_label: '', is_break: false });
      const d = await api.getTimeSlotTemplates();
      setTimeSlots(d.timeSlots || []);
      setMsg('Time slot saved.');
    } catch (err: any) { setMsg(err.message); }
  };

  const openEditTimeSlot = (slot: any) => {
    setTimeSlotForm({
      slot_number: String(slot.slot_number || 1),
      start_time: slot.start_time?.slice(0, 5) || '09:00',
      end_time: slot.end_time?.slice(0, 5) || '10:00',
      slot_label: slot.slot_label || '',
      is_break: !!slot.is_break,
    });
    setShowTimeSlotForm(true);
  };

  const handleDeleteTimeSlot = async (id: string) => {
    if (!confirm('Delete this time slot template?')) return;
    try {
      await api.deleteTimeSlot(id);
      setTimeSlots(prev => prev.filter(s => s.id !== id));
      setMsg('Time slot deleted.');
    } catch (err: any) { setMsg(err.message); }
  };

  // ── Constraint CRUD ──
  const handleAddConstraint = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editingConstraintId) {
        await api.updateSchedulingConstraint(editingConstraintId, { ...constForm, priority: parseInt(constForm.priority) });
        setMsg('Constraint updated.');
      } else {
        await api.createSchedulingConstraint({ ...constForm, priority: parseInt(constForm.priority) });
        setMsg('Constraint added.');
      }
      setShowConstForm(false);
      setEditingConstraintId(null);
      const d = await api.getSchedulingConstraints();
      setConstraints(d.constraints || []);
    } catch (err: any) { setMsg(err.message); }
  };

  const handleDeleteConstraint = async (id: string) => {
    if (!confirm('Delete this constraint?')) return;
    await api.deleteSchedulingConstraint(id);
    setConstraints(prev => prev.filter(c => c.id !== id));
  };

  const openEditConstraint = (constraint: any) => {
    setEditingConstraintId(constraint.id);
    setConstForm({
      constraint_type: constraint.constraint_type || 'max_hours_per_day',
      target_type: constraint.target_type || 'global',
      value: constraint.value || '',
      priority: String(constraint.priority || 5),
    });
    setShowConstForm(true);
  };

  // ── Fitness visual ──
  const fitnessColor = (score: number) => {
    if (score > 100) return '#16a34a';
    if (score > 0) return '#d97706';
    return '#dc2626';
  };

  const constraintTypeLabels: Record<string, string> = {
    max_hours_per_day: '⏰ Max hours/day',
    max_consecutive: '🔗 Max consecutive',
    no_slot: '🚫 Block slot',
    preferred_slot: '⭐ Preferred slot',
    room_preference: '🏠 Room preference',
    break_after: '☕ Break after',
  };

  if (loading) return (
    <div>
      <div style={{ height: 36, width: 350, background: 'rgba(249,115,22,0.06)', borderRadius: 10, marginBottom: 12 }} />
      <div style={{ height: 20, width: 250, background: 'rgba(249,115,22,0.04)', borderRadius: 8, marginBottom: 32 }} />
      <div className="ds-grid-3 ds-stagger">
        {[...Array(3)].map((_, i) => <div key={i} style={{ height: 200, background: 'rgba(249,115,22,0.04)', borderRadius: 16 }} />)}
      </div>
    </div>
  );

  return (
    <div>
      <div className="ds-page-header ds-fade-in">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg, #7c3aed, #ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', boxShadow: '0 4px 20px rgba(124,58,237,0.3)' }}>🧬</div>
          <div>
            <h1 className="ds-page-title" style={{ marginBottom: 2 }}>AI Timetable Generator</h1>
            <p className="ds-page-sub">Hybrid Genetic Algorithm + Constraint Satisfaction • Conflict-free scheduling</p>
          </div>
        </div>
      </div>

      {msg && <div className={`ds-alert ${msg.includes('❌') || msg.includes('failed') || msg.includes('Error') ? 'ds-alert-error' : msg.includes('⚠️') ? 'ds-alert-info' : 'ds-alert-success'} ds-fade-in`}>
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span style={{ flex: 1 }}>{msg}</span>
        <button className="ds-btn ds-btn-ghost" style={{ padding: '0.2rem' }} onClick={() => setMsg('')}>✕</button>
      </div>}

      {/* Tabs */}
      <div className="ds-tabs ds-fade-in" style={{ marginBottom: '1.5rem' }}>
        {[
          { id: 'generate', label: '🧬 Generate', },
          { id: 'classrooms', label: '🏫 Classrooms' },
          { id: 'timeslots', label: '⏰ Time Slots' },
          { id: 'constraints', label: '📐 Constraints' },
          { id: 'history', label: '📊 History' },
        ].map(tab => (
          <button key={tab.id} className={`ds-tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>
        ))}
      </div>

      {/* ══════════════════════════════════════════ */}
      {/* TAB: GENERATE                             */}
      {/* ══════════════════════════════════════════ */}
      {activeTab === 'generate' && (
        <div className="ds-fade-in">
          <div className="ds-grid-2" style={{ alignItems: 'start', gap: '1.5rem' }}>
            {/* Left: Config + Trigger */}
            <div>
              {/* Algorithm card */}
              <div className="ds-card" style={{ marginBottom: '1rem', background: 'linear-gradient(135deg, rgba(124,58,237,0.04), rgba(236,72,153,0.04))' }}>
                <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: '#1c0a00', marginBottom: '0.6rem', fontSize: '0.95rem' }}>🧬 Algorithm Parameters</h3>
                {algoConfig && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                    {[
                      { label: 'Population', value: algoConfig.populationSize },
                      { label: 'Max Gens', value: algoConfig.maxGenerations },
                      { label: 'Elites', value: algoConfig.eliteCount },
                      { label: 'Crossover', value: `${(algoConfig.crossoverRate * 100).toFixed(0)}%` },
                      { label: 'Mutation', value: `${(algoConfig.mutationRate * 100).toFixed(0)}%` },
                      { label: 'Tournament', value: algoConfig.tournamentSize },
                    ].map(p => (
                      <div key={p.label} style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.7)', borderRadius: 10, textAlign: 'center', border: '1px solid rgba(124,58,237,0.08)' }}>
                        <div style={{ fontSize: '0.68rem', color: '#9a7b6a', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{p.label}</div>
                        <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, color: '#7c3aed', fontSize: '1.1rem' }}>{p.value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Generate form */}
              <form onSubmit={handleGenerate} className="ds-card">
                <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: '#1c0a00', marginBottom: '1rem', fontSize: '0.95rem' }}>🚀 Generate Timetable</h3>
                <div className="ds-form-group">
                  <label className="ds-label">Department *</label>
                  <select className="ds-select" value={dept} onChange={e => setDept(e.target.value)} required>
                    <option value="" disabled>Select department</option>
                    {departments.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div className="ds-form-group">
                  <label className="ds-label">Year (Optional)</label>
                  <select className="ds-select" value={year} onChange={e => setYear(e.target.value)}>
                    <option value="">All Years</option>
                    {years.map(y => <option key={y}>{y}</option>)}
                  </select>
                </div>
                <div className="ds-alert ds-alert-info" style={{ marginBottom: '1rem' }}>
                  <span>💡</span>
                  <span style={{ fontSize: '0.78rem' }}>Prerequisites: Add subjects, assign faculty, and optionally add classrooms before generating.</span>
                </div>
                <button type="submit" className="ds-btn ds-btn-primary" disabled={generating || !dept} style={{ width: '100%', justifyContent: 'center', padding: '0.8rem', background: generating ? 'rgba(124,58,237,0.5)' : 'linear-gradient(135deg, #7c3aed, #ec4899)' }}>
                  {generating ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 16, height: 16, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }} />
                      AI is evolving timetable...
                    </span>
                  ) : '🧬 Generate with AI'}
                </button>
              </form>

              {/* Result summary */}
              {result && result.data && (
                <div className="ds-card ds-fade-in" style={{ marginTop: '1rem' }}>
                  <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: '#1c0a00', marginBottom: '0.8rem', fontSize: '0.95rem' }}>📊 Generation Result</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                    <div style={{ padding: '0.75rem', background: 'rgba(22,163,74,0.05)', borderRadius: 12, textAlign: 'center', border: '1px solid rgba(22,163,74,0.12)' }}>
                      <div style={{ fontSize: '0.65rem', color: '#16a34a', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em' }}>Total Slots</div>
                      <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '1.4rem', color: '#16a34a' }}>{result.data.totalSlots}</div>
                    </div>
                    <div style={{ padding: '0.75rem', background: result.data.conflicts === 0 ? 'rgba(22,163,74,0.05)' : 'rgba(220,38,38,0.05)', borderRadius: 12, textAlign: 'center', border: `1px solid ${result.data.conflicts === 0 ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)'}` }}>
                      <div style={{ fontSize: '0.65rem', color: result.data.conflicts === 0 ? '#16a34a' : '#dc2626', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em' }}>Conflicts</div>
                      <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '1.4rem', color: result.data.conflicts === 0 ? '#16a34a' : '#dc2626' }}>{result.data.conflicts}</div>
                    </div>
                    <div style={{ padding: '0.75rem', background: 'rgba(124,58,237,0.05)', borderRadius: 12, textAlign: 'center', border: '1px solid rgba(124,58,237,0.12)' }}>
                      <div style={{ fontSize: '0.65rem', color: '#7c3aed', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em' }}>GA Generations</div>
                      <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '1.4rem', color: '#7c3aed' }}>{result.data.generationsRun}</div>
                    </div>
                    <div style={{ padding: '0.75rem', background: 'rgba(249,115,22,0.05)', borderRadius: 12, textAlign: 'center', border: '1px solid rgba(249,115,22,0.12)' }}>
                      <div style={{ fontSize: '0.65rem', color: '#ea580c', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em' }}>Fitness</div>
                      <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '1.4rem', color: fitnessColor(result.data.fitness) }}>{result.data.fitness?.toFixed(1)}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Live Log */}
            <div className="ds-card" style={{ background: '#1a1020', border: '1px solid rgba(124,58,237,0.2)', minHeight: 400 }}>
              <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: '#e2d6f5', marginBottom: '0.8rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: generating ? '#22c55e' : '#64748b', boxShadow: generating ? '0 0 8px #22c55e' : 'none' }} />
                Evolution Log
              </h3>
              <div ref={logRef} style={{ maxHeight: 450, overflowY: 'auto', fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: '0.72rem', lineHeight: 1.8 }}>
                {logEntries.length === 0 ? (
                  <div style={{ color: '#6b5a7a', textAlign: 'center', padding: '3rem 1rem' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🧬</div>
                    <div>Waiting for generation to start...</div>
                    <div style={{ fontSize: '0.65rem', marginTop: '0.3rem', color: '#4a3a5a' }}>Select a department and click Generate</div>
                  </div>
                ) : (
                  logEntries.map((entry: any, i: number) => {
                    const time = new Date(entry.t).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    const isError = entry.msg?.includes('❌');
                    const isSuccess = entry.msg?.includes('✅') || entry.msg?.includes('🎯') || entry.msg?.includes('💾');
                    const isProgress = entry.msg?.includes('🔄');
                    return (
                      <div key={i} style={{ display: 'flex', gap: 8, color: isError ? '#f87171' : isSuccess ? '#4ade80' : isProgress ? '#c4b5fd' : '#d1c4e9' }}>
                        <span style={{ color: '#6b5a7a', flexShrink: 0 }}>{time}</span>
                        <span>{entry.msg}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════ */}
      {/* TAB: CLASSROOMS                           */}
      {/* ══════════════════════════════════════════ */}
      {activeTab === 'classrooms' && (
        <div className="ds-fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <p className="ds-page-sub" style={{ margin: 0 }}>Manage classrooms and labs for scheduling</p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <CSVUpload
                title="Classrooms"
                icon="🏫"
                columns={['name', 'building', 'capacity', 'room_type', 'has_projector', 'has_ac']}
                sampleData={[
                  ['A-201', 'Block A', '60', 'lecture', 'true', 'false'],
                  ['Lab-301', 'Block C', '40', 'lab', 'true', 'true'],
                ]}
                onUpload={file => api.importClassroomsCSV(file)}
              />
              <button className="ds-btn ds-btn-primary" onClick={() => setShowRoomForm(!showRoomForm)}>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                {editingRoomId ? 'Edit Room' : 'Add Room'}
              </button>
            </div>
          </div>

          {showRoomForm && (
            <form onSubmit={handleAddRoom} className="ds-card ds-fade-in" style={{ marginBottom: '1rem' }}>
              <div className="ds-grid-4">
                <div className="ds-form-group"><label className="ds-label">Name *</label><input className="ds-input" value={roomForm.name} onChange={e => setRoomForm({ ...roomForm, name: e.target.value })} placeholder="e.g., A-201" required /></div>
                <div className="ds-form-group"><label className="ds-label">Building</label><input className="ds-input" value={roomForm.building} onChange={e => setRoomForm({ ...roomForm, building: e.target.value })} placeholder="Block A" /></div>
                <div className="ds-form-group"><label className="ds-label">Capacity</label><input className="ds-input" type="number" value={roomForm.capacity} onChange={e => setRoomForm({ ...roomForm, capacity: e.target.value })} /></div>
                <div className="ds-form-group"><label className="ds-label">Type</label><select className="ds-select" value={roomForm.room_type} onChange={e => setRoomForm({ ...roomForm, room_type: e.target.value })}><option value="lecture">Lecture</option><option value="lab">Lab</option><option value="seminar">Seminar</option><option value="auditorium">Auditorium</option></select></div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="ds-btn ds-btn-primary">{editingRoomId ? 'Save Room' : 'Add Room'}</button>
                <button type="button" className="ds-btn ds-btn-ghost" onClick={() => { setShowRoomForm(false); setEditingRoomId(null); }}>Cancel</button>
              </div>
            </form>
          )}

          <div className="ds-card">
            {classrooms.length === 0 ? (
              <div className="ds-empty"><div className="ds-empty-icon">🏫</div><div className="ds-empty-title">No classrooms</div><div className="ds-empty-sub">Add classrooms to enable room assignment during scheduling</div></div>
            ) : (
              <div className="ds-grid-4 ds-stagger">
                {classrooms.map((r: any) => (
                  <div key={r.id} style={{ padding: '0.9rem', background: 'rgba(255,248,240,0.8)', border: '1px solid rgba(249,115,22,0.1)', borderRadius: 13, position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                      <span style={{ fontWeight: 700, color: '#1c0a00', fontSize: '0.9rem' }}>{r.name}</span>
                      <div style={{ display: 'flex', gap: 4 }}>
                      <button className="ds-btn ds-btn-ghost" style={{ padding: '0.2rem' }} onClick={() => openEditRoom(r)} title="Edit room">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: 13, height: 13 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                      </button>
                      <button className="ds-btn ds-btn-ghost" style={{ padding: '0.2rem' }} onClick={() => handleDeleteRoom(r.id)} title="Deactivate room">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: 13, height: 13 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#9a7b6a' }}>{r.building || 'N/A'} • Cap: {r.capacity}</div>
                    <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.4rem' }}>
                      <span className={`ds-badge ${r.room_type === 'lab' ? 'ds-badge-blue' : 'ds-badge-orange'}`}>{r.room_type}</span>
                      {r.has_projector && <span className="ds-badge ds-badge-green">📽️</span>}
                      {r.has_ac && <span className="ds-badge ds-badge-blue">❄️</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════ */}
      {/* TAB: TIME SLOTS                           */}
      {/* ══════════════════════════════════════════ */}
      {activeTab === 'timeslots' && (
        <div className="ds-fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '0.5rem' }}>
            <p className="ds-page-sub" style={{ margin: 0 }}>Standard time periods used to build the timetable grid</p>
            <button className="ds-btn ds-btn-primary" onClick={() => setShowTimeSlotForm(!showTimeSlotForm)}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add / Edit Slot
            </button>
          </div>
          {showTimeSlotForm && (
            <form onSubmit={handleSaveTimeSlot} className="ds-card ds-fade-in" style={{ marginBottom: '1rem' }}>
              <div className="ds-grid-4">
                <div className="ds-form-group"><label className="ds-label">Slot Number</label><input className="ds-input" type="number" min="1" value={timeSlotForm.slot_number} onChange={e => setTimeSlotForm({ ...timeSlotForm, slot_number: e.target.value })} required /></div>
                <div className="ds-form-group"><label className="ds-label">Start</label><input className="ds-input" type="time" value={timeSlotForm.start_time} onChange={e => setTimeSlotForm({ ...timeSlotForm, start_time: e.target.value })} required /></div>
                <div className="ds-form-group"><label className="ds-label">End</label><input className="ds-input" type="time" value={timeSlotForm.end_time} onChange={e => setTimeSlotForm({ ...timeSlotForm, end_time: e.target.value })} required /></div>
                <div className="ds-form-group"><label className="ds-label">Label</label><input className="ds-input" value={timeSlotForm.slot_label} onChange={e => setTimeSlotForm({ ...timeSlotForm, slot_label: e.target.value })} placeholder="Period 1" /></div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem', fontSize: '0.82rem', color: '#1c0a00' }}><input type="checkbox" checked={timeSlotForm.is_break} onChange={e => setTimeSlotForm({ ...timeSlotForm, is_break: e.target.checked })} /> Break / non-teaching period</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="ds-btn ds-btn-primary">Save Slot</button>
                <button type="button" className="ds-btn ds-btn-ghost" onClick={() => setShowTimeSlotForm(false)}>Cancel</button>
              </div>
            </form>
          )}
          <div className="ds-card">
            {timeSlots.length === 0 ? (
              <div className="ds-empty"><div className="ds-empty-icon">⏰</div><div className="ds-empty-title">No slots defined</div><div className="ds-empty-sub">Run the v3 schema SQL to seed default time slots</div></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {timeSlots.map((s: any) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.7rem 1rem', background: s.is_break ? 'rgba(217,119,6,0.06)' : 'rgba(255,248,240,0.8)', border: `1px solid ${s.is_break ? 'rgba(217,119,6,0.15)' : 'rgba(249,115,22,0.1)'}`, borderRadius: 11 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: s.is_break ? 'rgba(217,119,6,0.12)' : 'rgba(124,58,237,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.82rem', fontWeight: 700, color: s.is_break ? '#d97706' : '#7c3aed' }}>{s.slot_number}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: '#1c0a00', fontSize: '0.85rem' }}>{s.slot_label || `Period ${s.slot_number}`}</div>
                      <div style={{ fontSize: '0.75rem', color: '#9a7b6a' }}>{s.start_time?.slice(0, 5)} – {s.end_time?.slice(0, 5)}</div>
                    </div>
                    <span className={`ds-badge ${s.is_break ? 'ds-badge-amber' : 'ds-badge-blue'}`}>{s.is_break ? 'Break' : 'Class'}</span>
                    <button className="ds-btn ds-btn-ghost" style={{ padding: '0.2rem' }} onClick={() => openEditTimeSlot(s)} title="Edit time slot">
                      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: 13, height: 13 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    </button>
                    <button className="ds-btn ds-btn-ghost" style={{ padding: '0.2rem' }} onClick={() => handleDeleteTimeSlot(s.id)} title="Delete time slot">
                      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: 13, height: 13 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════ */}
      {/* TAB: CONSTRAINTS                          */}
      {/* ══════════════════════════════════════════ */}
      {activeTab === 'constraints' && (
        <div className="ds-fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <p className="ds-page-sub" style={{ margin: 0 }}>Scheduling rules the AI engine respects</p>
            <button className="ds-btn ds-btn-primary" onClick={() => { setEditingConstraintId(null); setConstForm({ constraint_type: 'max_hours_per_day', target_type: 'global', value: '5', priority: '5' }); setShowConstForm(!showConstForm); }}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              {editingConstraintId ? 'Edit Constraint' : 'Add Constraint'}
            </button>
          </div>

          {showConstForm && (
            <form onSubmit={handleAddConstraint} className="ds-card ds-fade-in" style={{ marginBottom: '1rem' }}>
              <div className="ds-grid-4">
                <div className="ds-form-group"><label className="ds-label">Type *</label><select className="ds-select" value={constForm.constraint_type} onChange={e => setConstForm({ ...constForm, constraint_type: e.target.value })}>{Object.entries(constraintTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                <div className="ds-form-group"><label className="ds-label">Scope</label><select className="ds-select" value={constForm.target_type} onChange={e => setConstForm({ ...constForm, target_type: e.target.value })}><option value="global">Global</option><option value="faculty">Faculty</option><option value="department">Department</option></select></div>
                <div className="ds-form-group"><label className="ds-label">Value</label><input className="ds-input" value={constForm.value} onChange={e => setConstForm({ ...constForm, value: e.target.value })} placeholder="e.g., 5" /></div>
                <div className="ds-form-group"><label className="ds-label">Priority (1-10)</label><input className="ds-input" type="number" min="1" max="10" value={constForm.priority} onChange={e => setConstForm({ ...constForm, priority: e.target.value })} /></div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="ds-btn ds-btn-primary">{editingConstraintId ? 'Save' : 'Add'}</button>
                <button type="button" className="ds-btn ds-btn-ghost" onClick={() => { setShowConstForm(false); setEditingConstraintId(null); }}>Cancel</button>
              </div>
            </form>
          )}

          <div className="ds-card">
            {constraints.length === 0 ? (
              <div className="ds-empty"><div className="ds-empty-icon">📐</div><div className="ds-empty-title">No custom constraints</div><div className="ds-empty-sub">The AI uses default rules. Add custom constraints for fine-tuning.</div></div>
            ) : (
              <table className="ds-table">
                <thead><tr><th>Type</th><th>Scope</th><th>Value</th><th>Priority</th><th></th></tr></thead>
                <tbody>{constraints.map((c: any) => (
                  <tr key={c.id}>
                    <td><span className="ds-badge ds-badge-blue">{constraintTypeLabels[c.constraint_type] || c.constraint_type}</span></td>
                    <td style={{ textTransform: 'capitalize' }}>{c.target_type}</td>
                    <td>{c.value || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ flex: 1, height: 6, background: 'rgba(0,0,0,0.06)', borderRadius: 3 }}>
                          <div style={{ width: `${c.priority * 10}%`, height: 6, borderRadius: 3, background: c.priority >= 7 ? '#dc2626' : c.priority >= 4 ? '#d97706' : '#16a34a' }} />
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1c0a00' }}>{c.priority}</span>
                      </div>
                    </td>
                    <td><div style={{ display: 'flex', gap: 4 }}>
                    <button className="ds-btn ds-btn-ghost" style={{ padding: '0.2rem' }} onClick={() => openEditConstraint(c)} title="Edit constraint">
                      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: 13, height: 13 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    </button>
                    <button className="ds-btn ds-btn-ghost" style={{ padding: '0.2rem' }} onClick={() => handleDeleteConstraint(c.id)} title="Delete constraint">
                      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: 13, height: 13 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button></div></td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════ */}
      {/* TAB: HISTORY                              */}
      {/* ══════════════════════════════════════════ */}
      {activeTab === 'history' && (
        <div className="ds-fade-in">
          <p className="ds-page-sub" style={{ marginBottom: '1rem' }}>Past timetable generation runs</p>
          <div className="ds-card">
            {history.length === 0 ? (
              <div className="ds-empty"><div className="ds-empty-icon">📊</div><div className="ds-empty-title">No generations yet</div><div className="ds-empty-sub">Run the AI generator to see history</div></div>
            ) : (
              <table className="ds-table">
                <thead><tr><th>Department</th><th>Year</th><th>Status</th><th>Fitness</th><th>Conflicts</th><th>Slots</th><th>Gens</th><th>Time</th></tr></thead>
                <tbody>{history.map((g: any) => (
                  <tr key={g.id}>
                    <td style={{ fontWeight: 600 }}>{g.department}</td>
                    <td>{g.year || 'All'}</td>
                    <td><span className={`ds-badge ${g.status === 'completed' ? 'ds-badge-green' : g.status === 'running' ? 'ds-badge-amber' : 'ds-badge-red'}`}>{g.status}</span></td>
                    <td style={{ fontWeight: 600, color: fitnessColor(g.fitness_score || 0) }}>{g.fitness_score?.toFixed(1) ?? '—'}</td>
                    <td><span className={`ds-badge ${g.conflicts_remaining === 0 ? 'ds-badge-green' : 'ds-badge-red'}`}>{g.conflicts_remaining ?? '—'}</span></td>
                    <td>{g.total_slots_placed ?? '—'}</td>
                    <td>{g.generations_run ?? '—'}</td>
                    <td style={{ fontSize: '0.75rem', color: '#9a7b6a' }}>{new Date(g.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
