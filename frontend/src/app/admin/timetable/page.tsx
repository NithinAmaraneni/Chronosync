'use client';
import { useEffect, useState, FormEvent } from 'react';
import { api } from '@/lib/api';

/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */

export default function AdminTimetablePage() {
  const [slots, setSlots] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [faculty, setFaculty] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ subject_id: '', faculty_id: '', department: '', year: '', day: 'Monday', start_time: '09:00', end_time: '10:00', room: '', slot_type: 'lecture' });
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [filterDept, setFilterDept] = useState('');

  const departments = ['Computer Science','Electronics','Mechanical','Civil','Electrical','Information Technology','Chemical','Biotechnology','Mathematics','Physics','Chemistry','Commerce','Arts'];
  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const years = ['1st Year','2nd Year','3rd Year','4th Year','5th Year'];

  const load = () => Promise.allSettled([
    api.getTimetableSlots(filterDept || undefined).then(d => setSlots(d.slots || [])),
    api.getSubjects().then(d => setSubjects(d.subjects || [])),
    api.getUsers({ role: 'faculty' }).then(d => setFaculty(d.users || [])),
  ]).finally(() => setLoading(false));

  useEffect(() => { load(); }, [filterDept]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true); setMsg('');
    try {
      if (editingSlotId) {
        await api.updateTimetableSlot(editingSlotId, form);
        setMsg('Slot updated!');
      } else {
        await api.createTimetableSlot(form);
        setMsg('Slot created!');
      }
      setShowForm(false);
      setEditingSlotId(null);
      load();
    } catch (err: any) { setMsg(err.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const openCreate = () => {
    setEditingSlotId(null);
    setForm({ subject_id: '', faculty_id: '', department: '', year: '', day: 'Monday', start_time: '09:00', end_time: '10:00', room: '', slot_type: 'lecture' });
    setShowForm(!showForm);
  };

  const openEdit = (slot: any) => {
    setEditingSlotId(slot.id);
    setForm({
      subject_id: slot.subject_id || '',
      faculty_id: slot.faculty_id || '',
      department: slot.department || '',
      year: slot.year || '',
      day: slot.day || 'Monday',
      start_time: slot.start_time?.slice(0, 5) || '09:00',
      end_time: slot.end_time?.slice(0, 5) || '10:00',
      room: slot.room || '',
      slot_type: slot.slot_type || 'lecture',
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (slot: any) => {
    if (!confirm(`Delete ${slot.subject?.name || 'this'} slot?`)) return;
    try {
      await api.deleteTimetableSlot(slot.id);
      setMsg('Slot deleted.');
      load();
    } catch (err: any) { setMsg(err.message || 'Failed to delete slot.'); }
  };

  // Group by day for visual grid
  const grouped: Record<string, any[]> = {};
  days.forEach(d => grouped[d] = []);
  slots.forEach(s => { if (grouped[s.day]) grouped[s.day].push(s); });

  return (
    <div>
      <div className="ds-page-header ds-fade-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div>
          <h1 className="ds-page-title">Timetable Management 📅</h1>
          <p className="ds-page-sub">Create and view timetable slots</p>
        </div>
        <button className="ds-btn ds-btn-primary" onClick={openCreate}>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          {editingSlotId ? 'Edit Slot' : 'Add Slot'}
        </button>
      </div>

      {msg && <div className={`ds-alert ${msg.includes('Failed') ? 'ds-alert-error' : 'ds-alert-success'}`}>
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>{msg}
      </div>}

      {showForm && (
        <div className="ds-card ds-fade-in" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: '#1c0a00', marginBottom: '1rem' }}>{editingSlotId ? 'Edit Timetable Slot' : 'New Timetable Slot'}</h3>
          <form onSubmit={handleCreate}>
            <div className="ds-grid-2">
              <div className="ds-form-group"><label className="ds-label">Subject</label><select className="ds-select" value={form.subject_id} onChange={e => setForm({ ...form, subject_id: e.target.value })} required><option value="" disabled>Select</option>{subjects.map((s: any) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}</select></div>
              <div className="ds-form-group"><label className="ds-label">Faculty</label><select className="ds-select" value={form.faculty_id} onChange={e => setForm({ ...form, faculty_id: e.target.value })} required><option value="" disabled>Select</option>{faculty.map((f: any) => <option key={f.id} value={f.id}>{f.full_name}</option>)}</select></div>
            </div>
            <div className="ds-grid-3">
              <div className="ds-form-group"><label className="ds-label">Department</label><select className="ds-select" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} required><option value="" disabled>Select</option>{departments.map(d => <option key={d}>{d}</option>)}</select></div>
              <div className="ds-form-group"><label className="ds-label">Year</label><select className="ds-select" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })}><option value="">All Years</option>{years.map(y => <option key={y}>{y}</option>)}</select></div>
              <div className="ds-form-group"><label className="ds-label">Day</label><select className="ds-select" value={form.day} onChange={e => setForm({ ...form, day: e.target.value })}>{days.map(d => <option key={d}>{d}</option>)}</select></div>
            </div>
            <div className="ds-grid-4">
              <div className="ds-form-group"><label className="ds-label">Start</label><input className="ds-input" type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} required /></div>
              <div className="ds-form-group"><label className="ds-label">End</label><input className="ds-input" type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} required /></div>
              <div className="ds-form-group"><label className="ds-label">Room</label><input className="ds-input" value={form.room} onChange={e => setForm({ ...form, room: e.target.value })} placeholder="e.g., A-201" /></div>
              <div className="ds-form-group"><label className="ds-label">Type</label><select className="ds-select" value={form.slot_type} onChange={e => setForm({ ...form, slot_type: e.target.value })}><option value="lecture">Lecture</option><option value="lab">Lab</option><option value="tutorial">Tutorial</option><option value="seminar">Seminar</option></select></div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="ds-btn ds-btn-primary" disabled={saving}>{saving ? 'Saving...' : editingSlotId ? 'Save Slot' : 'Create Slot'}</button>
              <button type="button" className="ds-btn ds-btn-ghost" onClick={() => { setShowForm(false); setEditingSlotId(null); }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Filter */}
      <div style={{ marginBottom: '1rem' }} className="ds-fade-in">
        <div className="ds-tabs">
          <button className={`ds-tab ${filterDept === '' ? 'active' : ''}`} onClick={() => setFilterDept('')}>All</button>
          {departments.slice(0, 5).map(d => <button key={d} className={`ds-tab ${filterDept === d ? 'active' : ''}`} onClick={() => setFilterDept(d)}>{d}</button>)}
        </div>
      </div>

      {/* Grid */}
      <div className="ds-card ds-fade-in" style={{ padding: '1rem' }}>
        {loading ? <p style={{ color: '#9a7b6a' }}>Loading…</p> : (
          <div className="ds-timetable">
            {days.map(day => (
              <div key={day}>
                <div className="ds-tt-day">{day.slice(0, 3)}</div>
                {grouped[day].length === 0 ? (
                  <div className="ds-tt-empty">—</div>
                ) : (
                  grouped[day].map((slot: any) => (
                    <div key={slot.id} className="ds-tt-slot">
                      <div className="ds-tt-slot-subject">{slot.subject?.name || slot.subject?.code}</div>
                      <div className="ds-tt-slot-time">{slot.start_time?.slice(0, 5)} – {slot.end_time?.slice(0, 5)}</div>
                      {slot.faculty?.full_name && <div className="ds-tt-slot-room">👩‍🏫 {slot.faculty.full_name}</div>}
                      {slot.room && <div className="ds-tt-slot-room">📍 {slot.room}</div>}
                      <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                        <button className="ds-btn ds-btn-ghost" style={{ padding: '0.18rem' }} onClick={() => openEdit(slot)} title="Edit slot">
                          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: 13, height: 13 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                        </button>
                        <button className="ds-btn ds-btn-ghost" style={{ padding: '0.18rem' }} onClick={() => handleDelete(slot)} title="Delete slot">
                          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: 13, height: 13 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
