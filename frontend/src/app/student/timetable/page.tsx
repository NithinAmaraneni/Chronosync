'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function StudentTimetablePage() {
  const [timetable, setTimetable] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  useEffect(() => {
    api.getStudentTimetable().then(d => { setTimetable(d.timetable || {}); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="ds-fade-in"><div style={{ height: 400, background: 'rgba(249,115,22,0.04)', borderRadius: 16 }} /></div>;

  const hasSlots = days.some(d => (timetable[d] || []).length > 0);

  return (
    <div>
      <div className="ds-page-header ds-fade-in">
        <h1 className="ds-page-title">My Timetable 📅</h1>
        <p className="ds-page-sub">Your weekly class schedule</p>
      </div>
      {!hasSlots ? (
        <div className="ds-card ds-fade-in"><div className="ds-empty"><div className="ds-empty-icon">📅</div><div className="ds-empty-title">No timetable yet</div><div className="ds-empty-sub">Your schedule will appear once the admin generates the timetable</div></div></div>
      ) : (
        <div className="ds-card ds-fade-in" style={{ padding: '1rem' }}>
          <div className="ds-timetable">
            {days.map(day => (
              <div key={day}>
                <div className="ds-tt-day">{day.slice(0, 3)}</div>
                {(timetable[day] || []).length === 0 ? (
                  <div className="ds-tt-empty">Free</div>
                ) : (
                  (timetable[day] || []).map((slot: any) => (
                    <div key={slot.id} className="ds-tt-slot">
                      <div className="ds-tt-slot-subject">{slot.subject?.name || slot.subject?.code}</div>
                      <div className="ds-tt-slot-time">{slot.start_time?.slice(0, 5)} – {slot.end_time?.slice(0, 5)}</div>
                      {slot.faculty?.full_name && <div className="ds-tt-slot-room">👩‍🏫 {slot.faculty.full_name}</div>}
                      {slot.room && <div className="ds-tt-slot-room">📍 {slot.room}</div>}
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
