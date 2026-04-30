const supabase = require('../config/supabase');

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
    const { start_date, end_date, reason } = req.body;

    if (new Date(start_date) > new Date(end_date)) {
      return res.status(400).json({ success: false, message: 'End date must be after start date.' });
    }

    const { data, error } = await supabase
      .from('leave_requests')
      .insert({
        faculty_id: req.user.id,
        start_date,
        end_date,
        reason,
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

    // Fetch faculty's timetable slots
    const { data: slots } = await supabase
      .from('timetable_slots')
      .select('id, day, start_time, end_time, department, room, subject_id, subject:subjects(name, code)')
      .eq('faculty_id', facultyId)
      .order('day')
      .order('start_time');

    if (!slots || slots.length === 0) {
      return res.json({
        success: true,
        impact: {
          totalClasses: 0,
          affectedSlots: [],
          message: 'You have no scheduled classes. Leave will not affect the timetable.',
        },
      });
    }

    // Load faculty info
    const { data: faculty } = await supabase
      .from('users')
      .select('department')
      .eq('id', facultyId)
      .maybeSingle();

    const dept = faculty?.department;

    // Find available substitutes per slot
    let potentialSubs = [];
    if (dept) {
      const { data: otherFaculty } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('role', 'faculty')
        .eq('is_active', true)
        .eq('department', dept)
        .neq('id', facultyId);

      // Load their expertise
      const otherIds = (otherFaculty || []).map(f => f.id);
      const { data: expertise } = await supabase
        .from('faculty_subjects')
        .select('faculty_id, subject_id')
        .in('faculty_id', otherIds.length ? otherIds : ['_none_']);

      // Load their busy schedule
      const { data: busySlots } = await supabase
        .from('timetable_slots')
        .select('faculty_id, day, start_time')
        .in('faculty_id', otherIds.length ? otherIds : ['_none_']);

      const busyMap = {};
      for (const s of (busySlots || [])) {
        busyMap[`${s.faculty_id}_${s.day}_${s.start_time}`] = true;
      }

      const expertiseMap = {};
      for (const e of (expertise || [])) {
        if (!expertiseMap[e.faculty_id]) expertiseMap[e.faculty_id] = new Set();
        expertiseMap[e.faculty_id].add(e.subject_id);
      }

      potentialSubs = (otherFaculty || []).map(f => ({
        id: f.id,
        name: f.full_name,
        expertise: expertiseMap[f.id] || new Set(),
        busyMap,
      }));
    }

    // Build impact for each slot
    const affectedSlots = slots.map(slot => {
      const subs = potentialSubs
        .filter(f => !f.busyMap[`${f.id}_${slot.day}_${slot.start_time}`])
        .map(f => ({
          id: f.id,
          name: f.name,
          isExpert: f.expertise.has(slot.subject_id),
        }))
        .sort((a, b) => (b.isExpert ? 1 : 0) - (a.isExpert ? 1 : 0));

      return {
        slotId: slot.id,
        subject: slot.subject?.name || slot.subject?.code || 'Unknown',
        day: slot.day,
        time: `${slot.start_time?.slice(0, 5)} – ${slot.end_time?.slice(0, 5)}`,
        room: slot.room,
        availableSubstitutes: subs.length,
        expertSubstitutes: subs.filter(s => s.isExpert).length,
        topSubstitute: subs.length > 0 ? { name: subs[0].name, isExpert: subs[0].isExpert } : null,
      };
    });

    const autoAssignable = affectedSlots.filter(s => s.availableSubstitutes > 0).length;

    res.json({
      success: true,
      impact: {
        totalClasses: slots.length,
        autoAssignable,
        needsManual: slots.length - autoAssignable,
        affectedSlots,
        message: autoAssignable === slots.length
          ? `All ${slots.length} classes can be auto-assigned to substitutes.`
          : `${autoAssignable}/${slots.length} classes can be auto-assigned. ${slots.length - autoAssignable} may need manual attention.`,
      },
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
