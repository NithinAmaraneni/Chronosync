const supabase = require('../config/supabase');

// ── Get student timetable (by dept + year) ──
const getMyTimetable = async (req, res) => {
  try {
    const { data: profile } = await supabase
      .from('users')
      .select('department, year')
      .eq('id', req.user.id)
      .single();

    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found.' });

    const { data, error } = await supabase
      .from('timetable_slots')
      .select('*, subject:subjects(name, code, credits, semester), faculty:users!timetable_slots_faculty_id_fkey(full_name)')
      .eq('department', profile.department)
      .eq('year', profile.year)
      .order('day')
      .order('start_time');

    if (error) throw error;

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const grouped = {};
    days.forEach(d => grouped[d] = []);
    (data || []).forEach(slot => {
      if (grouped[slot.day]) grouped[slot.day].push(slot);
    });

    res.json({ success: true, timetable: grouped });
  } catch (err) {
    console.error('Get student timetable error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Get faculty list (for the student's department) ──
const getFacultyList = async (req, res) => {
  try {
    const { data: profile } = await supabase
      .from('users')
      .select('department')
      .eq('id', req.user.id)
      .single();

    const { data, error } = await supabase
      .from('users')
      .select('id, user_id, full_name, email, department')
      .eq('role', 'faculty')
      .eq('is_active', true)
      .eq('department', profile?.department || '');

    if (error) throw error;

    // Also load their subjects for display
    const facultyIds = (data || []).map(f => f.id);
    const { data: assignments } = await supabase
      .from('faculty_subjects')
      .select('faculty_id, subject:subjects(name, code)')
      .in('faculty_id', facultyIds.length ? facultyIds : ['_none_']);

    // Build subject map
    const subjectMap = {};
    for (const a of (assignments || [])) {
      if (!subjectMap[a.faculty_id]) subjectMap[a.faculty_id] = [];
      subjectMap[a.faculty_id].push(a.subject?.name || a.subject?.code);
    }

    const enriched = (data || []).map(f => ({
      ...f,
      subjects: subjectMap[f.id] || [],
    }));

    res.json({ success: true, faculty: enriched });
  } catch (err) {
    console.error('Get faculty list error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════
// GET FACULTY AVAILABLE SLOTS for a given date
// Checks: timetable, existing bookings, availability
// ═══════════════════════════════════════════
const getFacultySlots = async (req, res) => {
  try {
    const { faculty_id, date } = req.query;
    if (!faculty_id || !date) {
      return res.status(400).json({ success: false, message: 'faculty_id and date required.' });
    }

    const dateObj = new Date(date + 'T00:00:00');
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[dateObj.getDay()];

    // 1. Get faculty's timetable for that day (classes they're teaching)
    const { data: timetableSlots } = await supabase
      .from('timetable_slots')
      .select('start_time, end_time, subject:subjects(name)')
      .eq('faculty_id', faculty_id)
      .eq('day', dayName);

    // 2. Get existing bookings for that faculty+date (pending or approved)
    const { data: existingBookings } = await supabase
      .from('booking_slots')
      .select('start_time, end_time, status, student:users!booking_slots_student_id_fkey(full_name)')
      .eq('faculty_id', faculty_id)
      .eq('date', date)
      .in('status', ['pending', 'approved']);

    // 3. Get faculty availability restrictions
    const { data: availability } = await supabase
      .from('faculty_availability')
      .select('start_time, end_time, is_available, note')
      .eq('faculty_id', faculty_id)
      .eq('day', dayName);

    // 4. Check if faculty is on approved leave
    const { data: leaves } = await supabase
      .from('leave_requests')
      .select('start_date, end_date')
      .eq('faculty_id', faculty_id)
      .eq('status', 'approved')
      .lte('start_date', date)
      .gte('end_date', date);

    const isOnLeave = (leaves || []).length > 0;

    // Build time slot windows (30-minute intervals from 9:00 to 17:00)
    const slots = [];
    for (let h = 9; h < 17; h++) {
      for (let m = 0; m < 60; m += 30) {
        const start = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const endH = m === 30 ? h + 1 : h;
        const endM = m === 30 ? 0 : 30;
        const end = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

        let status = 'available';
        let conflict = null;

        // Check leave
        if (isOnLeave) {
          status = 'unavailable';
          conflict = 'Faculty is on approved leave';
        }

        // Check timetable conflict
        if (status === 'available') {
          const ttConflict = (timetableSlots || []).find(t =>
            t.start_time <= start + ':00' && t.end_time > start + ':00'
          );
          if (ttConflict) {
            status = 'class';
            conflict = `Teaching: ${ttConflict.subject?.name || 'Class'}`;
          }
        }

        // Check existing booking conflict
        if (status === 'available') {
          const bookConflict = (existingBookings || []).find(b =>
            b.start_time <= start + ':00' && b.end_time > start + ':00'
          );
          if (bookConflict) {
            status = 'booked';
            conflict = `Booked (${bookConflict.status})`;
          }
        }

        // Check availability restrictions
        if (status === 'available') {
          const unavail = (availability || []).find(a =>
            !a.is_available && a.start_time <= start + ':00' && a.end_time > start + ':00'
          );
          if (unavail) {
            status = 'unavailable';
            conflict = unavail.note || 'Marked unavailable';
          }
        }

        slots.push({ start, end, status, conflict });
      }
    }

    // Faculty info
    const { data: facultyInfo } = await supabase
      .from('users')
      .select('full_name, department')
      .eq('id', faculty_id)
      .maybeSingle();

    res.json({
      success: true,
      day: dayName,
      date,
      faculty: facultyInfo,
      isOnLeave,
      slots,
      summary: {
        available: slots.filter(s => s.status === 'available').length,
        class: slots.filter(s => s.status === 'class').length,
        booked: slots.filter(s => s.status === 'booked').length,
        unavailable: slots.filter(s => s.status === 'unavailable').length,
      },
    });
  } catch (err) {
    console.error('Get faculty slots error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════
// BOOK A SLOT — with full conflict checking
// ═══════════════════════════════════════════
const bookSlot = async (req, res) => {
  try {
    const { faculty_id, date, start_time, end_time, purpose, description } = req.body;

    // Validate time
    if (start_time >= end_time) {
      return res.status(400).json({ success: false, message: 'End time must be after start time.' });
    }

    // Check date is not in the past
    const today = new Date().toISOString().split('T')[0];
    if (date < today) {
      return res.status(400).json({ success: false, message: 'Cannot book slots in the past.' });
    }

    // Check: faculty double booking
    const { data: existingFaculty } = await supabase
      .from('booking_slots')
      .select('id, start_time, end_time')
      .eq('faculty_id', faculty_id)
      .eq('date', date)
      .in('status', ['pending', 'approved']);

    const fConflict = (existingFaculty || []).find(b =>
      b.start_time < end_time + ':00' && b.end_time > start_time + ':00'
    );
    if (fConflict) {
      return res.status(409).json({
        success: false,
        message: 'This faculty already has a booking at this time.',
        conflictType: 'faculty_booking',
      });
    }

    // Check: student double booking
    const { data: existingStudent } = await supabase
      .from('booking_slots')
      .select('id, start_time, end_time, faculty:users!booking_slots_faculty_id_fkey(full_name)')
      .eq('student_id', req.user.id)
      .eq('date', date)
      .in('status', ['pending', 'approved']);

    const sConflict = (existingStudent || []).find(b =>
      b.start_time < end_time + ':00' && b.end_time > start_time + ':00'
    );
    if (sConflict) {
      return res.status(409).json({
        success: false,
        message: `You already have a booking at this time with ${sConflict.faculty?.full_name || 'another faculty'}.`,
        conflictType: 'student_booking',
      });
    }

    // Check: timetable conflict for faculty
    const dateObj = new Date(date + 'T00:00:00');
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[dateObj.getDay()];

    const { data: ttConflict } = await supabase
      .from('timetable_slots')
      .select('start_time, end_time, subject:subjects(name)')
      .eq('faculty_id', faculty_id)
      .eq('day', dayName);

    const classConflict = (ttConflict || []).find(t =>
      t.start_time < end_time + ':00' && t.end_time > start_time + ':00'
    );
    if (classConflict) {
      return res.status(409).json({
        success: false,
        message: `Faculty has a class at this time: ${classConflict.subject?.name || 'Unknown'} (${classConflict.start_time?.slice(0, 5)} – ${classConflict.end_time?.slice(0, 5)}).`,
        conflictType: 'timetable',
      });
    }

    // Check: faculty on leave
    const { data: leaveConflict } = await supabase
      .from('leave_requests')
      .select('id')
      .eq('faculty_id', faculty_id)
      .eq('status', 'approved')
      .lte('start_date', date)
      .gte('end_date', date)
      .maybeSingle();

    if (leaveConflict) {
      return res.status(409).json({
        success: false,
        message: 'Faculty is on approved leave on this date.',
        conflictType: 'leave',
      });
    }

    // All clear — create booking
    const { data, error } = await supabase
      .from('booking_slots')
      .insert({
        student_id: req.user.id,
        faculty_id,
        date,
        start_time,
        end_time,
        purpose,
        description,
        status: 'pending',
      })
      .select('*, faculty:users!booking_slots_faculty_id_fkey(full_name)')
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, booking: data, message: `Slot booked with ${data.faculty?.full_name}! Awaiting approval.` });
  } catch (err) {
    console.error('Book slot error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Get my bookings (with filters) ──
const getMyBookings = async (req, res) => {
  try {
    const { status, limit } = req.query;
    let query = supabase
      .from('booking_slots')
      .select('*, faculty:users!booking_slots_faculty_id_fkey(full_name, email, department)')
      .eq('student_id', req.user.id)
      .order('date', { ascending: false })
      .order('start_time', { ascending: false });

    if (status && status !== 'all') query = query.eq('status', status);
    if (limit) query = query.limit(parseInt(limit));

    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, bookings: data || [] });
  } catch (err) {
    console.error('Get student bookings error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Cancel booking ──
const cancelBooking = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('booking_slots')
      .update({ status: 'cancelled' })
      .eq('id', req.params.id)
      .eq('student_id', req.user.id)
      .in('status', ['pending'])
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, booking: data, message: 'Booking cancelled.' });
  } catch (err) {
    console.error('Cancel booking error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getMyTimetable,
  getFacultyList,
  getFacultySlots,
  bookSlot,
  getMyBookings,
  cancelBooking,
};
