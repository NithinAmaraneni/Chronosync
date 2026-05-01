const supabase = require('../config/supabase');

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const timesOverlap = (startA, endA, startB, endB) => startA < endB && endA > startB;

const getDaysInRange = (startDate, endDate) => {
  if (!startDate || !endDate) return null;

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return null;

  const days = new Set();
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.add(WEEKDAYS[d.getDay()]);
  }
  return days;
};

const buildLeaveImpact = async (facultyId, startDate, endDate) => {
  const requestedDays = getDaysInRange(startDate, endDate);

  const { data: slots } = await supabase
    .from('timetable_slots')
    .select('id, day, start_time, end_time, department, year, room, slot_type, subject_id, subject:subjects(id, name, code)')
    .eq('faculty_id', facultyId)
    .order('day')
    .order('start_time');

  const affectedBaseSlots = requestedDays
    ? (slots || []).filter(slot => requestedDays.has(slot.day))
    : (slots || []);

  if (affectedBaseSlots.length === 0) {
    return {
      totalClasses: 0,
      affectedSlots: [],
      message: requestedDays
        ? 'No scheduled classes fall inside the selected leave dates.'
        : 'You have no scheduled classes. Leave will not affect the timetable.',
    };
  }

  const { data: faculty } = await supabase
    .from('users')
    .select('department')
    .eq('id', facultyId)
    .maybeSingle();

  const dept = faculty?.department;
  let potentialSubs = [];

  if (dept) {
    const { data: otherFaculty } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('role', 'faculty')
      .eq('is_active', true)
      .eq('department', dept)
      .neq('id', facultyId);

    const otherIds = (otherFaculty || []).map(f => f.id);
    const { data: expertise } = await supabase
      .from('faculty_subjects')
      .select('faculty_id, subject_id')
      .in('faculty_id', otherIds.length ? otherIds : ['_none_']);

    const { data: busySlots } = await supabase
      .from('timetable_slots')
      .select('faculty_id, day, start_time, end_time')
      .in('faculty_id', otherIds.length ? otherIds : ['_none_']);

    const { data: unavailable } = await supabase
      .from('faculty_availability')
      .select('faculty_id, day, start_time, end_time, is_available')
      .in('faculty_id', otherIds.length ? otherIds : ['_none_'])
      .eq('is_available', false);

    let leaveQuery = supabase
      .from('leave_requests')
      .select('faculty_id, start_date, end_date')
      .in('faculty_id', otherIds.length ? otherIds : ['_none_'])
      .eq('status', 'approved');
    if (startDate && endDate) {
      leaveQuery = leaveQuery.lte('start_date', endDate).gte('end_date', startDate);
    }
    const { data: approvedLeaves } = await leaveQuery;
    const onLeaveSet = new Set((approvedLeaves || []).map(l => l.faculty_id));

    const expertiseMap = {};
    for (const e of (expertise || [])) {
      if (!expertiseMap[e.faculty_id]) expertiseMap[e.faculty_id] = new Set();
      expertiseMap[e.faculty_id].add(e.subject_id);
    }

    potentialSubs = (otherFaculty || []).map(f => ({
      id: f.id,
      name: f.full_name,
      expertise: expertiseMap[f.id] || new Set(),
      busySlots: (busySlots || []).filter(s => s.faculty_id === f.id),
      unavailable: (unavailable || []).filter(a => a.faculty_id === f.id),
      onLeave: onLeaveSet.has(f.id),
    }));
  }

  const { data: classrooms } = await supabase
    .from('classrooms')
    .select('id, name, building, capacity, room_type, is_active')
    .eq('is_active', true);

  const { data: allSlots } = await supabase
    .from('timetable_slots')
    .select('id, day, start_time, end_time, room');

  const affectedSlots = affectedBaseSlots.map(slot => {
    const substitutes = potentialSubs
      .filter(f => !f.onLeave)
      .filter(f => !f.busySlots.some(s => s.day === slot.day && timesOverlap(s.start_time, s.end_time, slot.start_time, slot.end_time)))
      .filter(f => !f.unavailable.some(a => a.day === slot.day && timesOverlap(a.start_time, a.end_time, slot.start_time, slot.end_time)))
      .map(f => ({
        id: f.id,
        name: f.name,
        isExpert: f.expertise.has(slot.subject_id),
      }))
      .sort((a, b) => (b.isExpert ? 1 : 0) - (a.isExpert ? 1 : 0) || a.name.localeCompare(b.name));

    const freeRooms = (classrooms || [])
      .filter(room => !room.room_type || room.room_type === slot.slot_type || room.room_type === 'lecture')
      .filter(room => !(allSlots || []).some(s =>
        s.id !== slot.id &&
        s.day === slot.day &&
        (s.room === room.name || s.room === room.id) &&
        timesOverlap(s.start_time, s.end_time, slot.start_time, slot.end_time)
      ))
      .sort((a, b) => (b.capacity || 0) - (a.capacity || 0) || a.name.localeCompare(b.name))
      .slice(0, 5)
      .map(room => ({
        id: room.id,
        name: room.name,
        building: room.building,
        capacity: room.capacity,
        roomType: room.room_type,
      }));

    return {
      slotId: slot.id,
      subject: slot.subject?.name || slot.subject?.code || 'Unknown',
      subjectCode: slot.subject?.code,
      day: slot.day,
      time: `${slot.start_time?.slice(0, 5)} - ${slot.end_time?.slice(0, 5)}`,
      start_time: slot.start_time,
      end_time: slot.end_time,
      room: slot.room,
      availableSubstitutes: substitutes.length,
      expertSubstitutes: substitutes.filter(s => s.isExpert).length,
      substitutes: substitutes.slice(0, 8),
      topSubstitute: substitutes.length > 0 ? { id: substitutes[0].id, name: substitutes[0].name, isExpert: substitutes[0].isExpert } : null,
      freeRooms,
    };
  });

  const autoAssignable = affectedSlots.filter(s => s.availableSubstitutes > 0).length;
  const roomsAvailable = affectedSlots.filter(s => s.freeRooms.length > 0).length;

  return {
    totalClasses: affectedSlots.length,
    autoAssignable,
    roomsAvailable,
    needsManual: affectedSlots.length - autoAssignable,
    affectedSlots,
    message: autoAssignable === affectedSlots.length
      ? `All ${affectedSlots.length} affected classes have available substitute faculty.`
      : `${autoAssignable}/${affectedSlots.length} classes have available substitute faculty. ${roomsAvailable}/${affectedSlots.length} have free room suggestions.`,
  };
};

const buildCoverageNote = (coverageMode, coveragePlan, impact) => {
  if (!coverageMode || !impact?.affectedSlots?.length) return '';

  const lines = [
    '',
    '[Coverage Plan]',
    `Mode: ${coverageMode === 'self' ? 'Faculty will take class in another free room' : 'Other faculty will take class'}`,
  ];

  for (const slot of impact.affectedSlots) {
    const choice = coveragePlan?.[slot.slotId] || {};
    if (coverageMode === 'self') {
      const room = slot.freeRooms.find(r => r.id === choice.room_id || r.name === choice.room);
      lines.push(`- slot ${slot.slotId}: ${slot.day} ${slot.time} ${slot.subject}: room ${room?.name || choice.room || 'not selected'}`);
    } else {
      const sub = slot.substitutes.find(s => s.id === choice.faculty_id);
      lines.push(`- slot ${slot.slotId}: ${slot.day} ${slot.time} ${slot.subject}: substitute ${sub?.name || 'not selected'}`);
    }
  }

  return lines.join('\n');
};

// ── Get faculty's assigned subjects ──
const getMySubjects = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('faculty_subjects')
      .select('id, assigned_at, subject:subjects(id, name, code, department, credits, semester)')
      .eq('faculty_id', req.user.id);

    if (error) throw error;
    res.json({ success: true, subjects: data || [] });
  } catch (err) {
    console.error('Get faculty subjects error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Get faculty timetable ──
const getMyTimetable = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('timetable_slots')
      .select('*, subject:subjects(name, code, credits, semester)')
      .eq('faculty_id', req.user.id)
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
    console.error('Get faculty timetable error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Get/Set availability ──
const getAvailability = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('faculty_availability')
      .select('*')
      .eq('faculty_id', req.user.id)
      .order('day')
      .order('start_time');

    if (error) throw error;
    res.json({ success: true, availability: data || [] });
  } catch (err) {
    console.error('Get availability error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const setAvailability = async (req, res) => {
  try {
    const { day, start_time, end_time, is_available, note } = req.body;

    const { data, error } = await supabase
      .from('faculty_availability')
      .upsert({
        faculty_id: req.user.id,
        day,
        start_time,
        end_time,
        is_available,
        note,
      }, { onConflict: 'faculty_id,day,start_time' })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, slot: data, message: 'Availability updated.' });
  } catch (err) {
    console.error('Set availability error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteAvailability = async (req, res) => {
  try {
    const { error } = await supabase
      .from('faculty_availability')
      .delete()
      .eq('id', req.params.id)
      .eq('faculty_id', req.user.id);

    if (error) throw error;
    res.json({ success: true, message: 'Availability slot removed.' });
  } catch (err) {
    console.error('Delete availability error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Leave requests ──
const getLeaveRequests = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('faculty_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, leaves: data || [] });
  } catch (err) {
    console.error('Get leaves error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const applyLeave = async (req, res) => {
  try {
    const { start_date, end_date, reason, coverage_mode, coverage_plan } = req.body;

    if (new Date(start_date) > new Date(end_date)) {
      return res.status(400).json({ success: false, message: 'End date must be after start date.' });
    }

    const impact = await buildLeaveImpact(req.user.id, start_date, end_date);
    const coverageNote = buildCoverageNote(coverage_mode, coverage_plan, impact);

    const { data, error } = await supabase
      .from('leave_requests')
      .insert({
        faculty_id: req.user.id,
        start_date,
        end_date,
        reason: `${reason}${coverageNote}`,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, leave: data, message: 'Leave request submitted.' });
  } catch (err) {
    console.error('Apply leave error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Faculty bookings (incoming from students) ──
const getMyBookings = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('booking_slots')
      .select('*, student:users!booking_slots_student_id_fkey(full_name, email, user_id, department)')
      .eq('faculty_id', req.user.id)
      .order('date', { ascending: true });

    if (error) throw error;
    res.json({ success: true, bookings: data || [] });
  } catch (err) {
    console.error('Get faculty bookings error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateBookingStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const { data, error } = await supabase
      .from('booking_slots')
      .update({ status })
      .eq('id', req.params.id)
      .eq('faculty_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, booking: data, message: `Booking ${status}.` });
  } catch (err) {
    console.error('Update booking error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Leave Impact Preview ──
// Shows faculty what classes will be affected before they submit
const getLeaveImpact = async (req, res) => {
  try {
    const facultyId = req.user.id;
    const { start_date, end_date } = req.query;
    const impact = await buildLeaveImpact(facultyId, start_date, end_date);

    res.json({
      success: true,
      impact,
    });
  } catch (err) {
    console.error('Leave impact error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Get Students for Chat ──
const getStudents = async (req, res) => {
  try {
    const { data: facultyProfile } = await supabase
      .from('users')
      .select('department')
      .eq('id', req.user.id)
      .single();

    let query = supabase
      .from('users')
      .select('id, user_id, full_name, email, department')
      .eq('role', 'student')
      .eq('is_active', true);

    if (facultyProfile && facultyProfile.department) {
      query = query.eq('department', facultyProfile.department);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ success: true, students: data || [] });
  } catch (err) {
    console.error('Get students error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getMySubjects,
  getMyTimetable,
  getAvailability,
  setAvailability,
  deleteAvailability,
  getLeaveRequests,
  applyLeave,
  getMyBookings,
  updateBookingStatus,
  getLeaveImpact,
  getStudents,
};
