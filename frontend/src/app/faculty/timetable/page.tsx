'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function FacultyTimetablePage() {
  const [timetable, setTimetable] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const sortSections = (a: string, b: string) => {
    const an = Number(a.match(/\d+/)?.[0] || 999);
    const bn = Number(b.match(/\d+/)?.[0] || 999);
    return an - bn || a.localeCompare(b);
  };

  useEffect(() => {
    api.getFacultyTimetable().then(d => { setTimetable(d.timetable || {}); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="ds-fade-in"><div style={{ height: 400, background: 'rgba(249,115,22,0.04)', borderRadius: 16 }} /></div>;

  const flatSlots = days.flatMap(d => timetable[d] || []);
  const hasSlots = flatSlots.length > 0;
  const byYearSem = flatSlots.reduce((acc: Record<string, Record<string, Record<string, any[]>>>, slot: any) => {
    const yearKey = slot.year || 'All Years';
    const semKey = slot.subject?.semester || 'Unassigned Semester';
    if (!acc[yearKey]) acc[yearKey] = {};
    if (!acc[yearKey][semKey]) {
      acc[yearKey][semKey] = {};
      days.forEach(d => acc[yearKey][semKey][d] = []);
    }
    if (acc[yearKey][semKey][slot.day]) acc[yearKey][semKey][slot.day].push(slot);
    return acc;
  }, {});

  return (
    <div>
      <div className="ds-page-header ds-fade-in">
        <h1 className="ds-page-title">My Timetable 📅</h1>
        <p className="ds-page-sub">Your weekly teaching schedule</p>
      </div>
      {!hasSlots ? (
        <div className="ds-card ds-fade-in"><div className="ds-empty"><div className="ds-empty-icon">📅</div><div className="ds-empty-title">No schedule yet</div><div className="ds-empty-sub">Your timetable will appear once the admin generates it</div></div></div>
      ) : (
        <div className="ds-card ds-fade-in" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {Object.keys(byYearSem).sort(sortSections).map(yearKey => (
              <div key={yearKey}>
                <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, color: '#1c0a00', marginBottom: '0.75rem' }}>{yearKey}</h3>
                {Object.keys(byYearSem[yearKey]).sort(sortSections).map(semKey => (
                  <section key={`${yearKey}-${semKey}`} style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '0.85rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem' }}>
                      <span className="ds-badge ds-badge-blue">{semKey}</span>
                      <span style={{ fontSize: '0.76rem', color: '#9a7b6a' }}>{days.reduce((sum, day) => sum + byYearSem[yearKey][semKey][day].length, 0)} classes</span>
                    </div>
                    <div className="ds-timetable">
                      {days.map(day => (
                        <div key={day}>
                          <div className="ds-tt-day">{day.slice(0, 3)}</div>
                          {byYearSem[yearKey][semKey][day].length === 0 ? (
                            <div className="ds-tt-empty">No class</div>
                          ) : (
                            byYearSem[yearKey][semKey][day].map((slot: any) => (
                              <div key={slot.id} className="ds-tt-slot">
                                <div className="ds-tt-slot-subject">{slot.subject?.name || slot.subject?.code}</div>
                                <div className="ds-tt-slot-time">{slot.start_time?.slice(0, 5)} – {slot.end_time?.slice(0, 5)}</div>
                                {slot.room && <div className="ds-tt-slot-room">📍 {slot.room}</div>}
                              </div>
                            ))
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
