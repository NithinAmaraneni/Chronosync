const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');
const { generateUserId, generateOTP } = require('../utils/helpers');
const { sendCredentialsEmail } = require('../services/emailService');

/**
 * Safe activity log — does not throw if insert fails
 */
const logActivity = async (adminId, action, targetUserId, details) => {
  try {
    await supabase.from('activity_logs').insert({
      admin_id: adminId,
      action,
      target_user_id: targetUserId,
      details,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('⚠️ Activity log insert failed:', err.message);
  }
};

const syncFacultySubjects = async (facultyId, department, subjects = []) => {
  const subjectNames = (Array.isArray(subjects) ? subjects : [])
    .map((s) => String(s).trim())
    .filter(Boolean);

  if (subjectNames.length === 0) return;

  const filters = subjectNames.flatMap((s) => [`name.ilike.${s}`, `code.ilike.${s}`]);
  let query = supabase
    .from('subjects')
    .select('id, name, code')
    .or(filters.join(','));

  if (department) query = query.eq('department', department);

  const { data: matches, error } = await query;
  if (error || !matches?.length) return;

  const rows = matches.map((subject) => ({
    faculty_id: facultyId,
    subject_id: subject.id,
  }));

  await supabase
    .from('faculty_subjects')
    .upsert(rows, { onConflict: 'faculty_id,subject_id', ignoreDuplicates: true });
};

const hasTimeOverlap = (aStart, aEnd, bStart, bEnd) => {
  const norm = (v) => (String(v || '').length === 5 ? `${v}:00` : String(v || ''));
  return norm(aStart) < norm(bEnd) && norm(aEnd) > norm(bStart);
};

const validateTimetableSlotConflicts = async (slot, excludeId = null) => {
  if (slot.start_time >= slot.end_time) {
    return 'End time must be after start time.';
  }

  let query = supabase
    .from('timetable_slots')
    .select('id, subject_id, faculty_id, department, year, day, start_time, end_time, room, subject:subjects(name, code), faculty:users!timetable_slots_faculty_id_fkey(full_name)')
    .eq('day', slot.day);

  if (excludeId) query = query.neq('id', excludeId);

  const { data: existing, error } = await query;
  if (error) throw error;

  const conflicts = (existing || []).filter((candidate) => (
    hasTimeOverlap(slot.start_time, slot.end_time, candidate.start_time, candidate.end_time)
  ));

  const facultyConflict = conflicts.find((candidate) => candidate.faculty_id === slot.faculty_id);
  if (facultyConflict) {
    return `Faculty already has ${facultyConflict.subject?.name || 'a class'} at this time.`;
  }

  const roomName = String(slot.room || '').trim().toLowerCase();
  if (roomName) {
    const roomConflict = conflicts.find((candidate) => String(candidate.room || '').trim().toLowerCase() === roomName);
    if (roomConflict) {
      return `Room ${slot.room} is already booked at this time.`;
    }
  }

  const batchConflict = conflicts.find((candidate) =>
    candidate.department === slot.department &&
    (candidate.year || '') === (slot.year || '')
  );
  if (batchConflict) {
    return `This department/year already has ${batchConflict.subject?.name || 'a class'} at this time.`;
  }

  return null;
};

/**
 * Create a student account
 */
const createStudent = async (req, res) => {
  try {
    const { fullName, email, degreeCourse, department, year, phone } = req.body;

    console.log('📝 Creating student:', { fullName, email, department, degreeCourse, year });

    // Check if email already exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'A user with this email already exists.',
      });
    }

    // Generate unique student ID (retry if collision)
    let userId;
    let idExists = true;
    let attempts = 0;
    while (idExists && attempts < 10) {
      userId = generateUserId('student');
      const { data } = await supabase
        .from('users')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      idExists = !!data;
      attempts++;
    }

    // Generate OTP
    const otp = generateOTP();
    const salt = await bcrypt.genSalt(12);
    const otpHash = await bcrypt.hash(otp, salt);

    // Insert user
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        user_id: userId,
        email,
        full_name: fullName,
        password_hash: '',
        role: 'student',
        department,
        degree_course: degreeCourse,
        year,
        phone: phone || null,
        otp: otpHash,
        is_first_login: true,
        is_active: true,
        email_verified: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Supabase insert error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create student account: ' + error.message,
      });
    }

    console.log('✅ Student created:', userId);

    // Send email (don't let email failure crash the response)
    try {
      await sendCredentialsEmail({
        email,
        fullName,
        userId,
        otp,
        role: 'student',
      });
    } catch (emailErr) {
      console.warn('⚠️ Email send failed:', emailErr.message);
    }

    // Log activity (non-blocking)
    logActivity(req.user.id, 'created_student', userId, { fullName, email, department, degreeCourse });

    return res.status(201).json({
      success: true,
      message: 'Student account created successfully. Credentials sent via email.',
      user: {
        userId,
        fullName,
        email,
        role: 'student',
        department,
        degreeCourse,
        year,
      },
    });
  } catch (error) {
    console.error('❌ Create student error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error: ' + error.message,
    });
  }
};

/**
 * Create a faculty account
 */
const createFaculty = async (req, res) => {
  try {
    const { fullName, email, department, subjects } = req.body;

    console.log('📝 Creating faculty:', { fullName, email, department });

    // Check if email already exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'A user with this email already exists.',
      });
    }

    // Generate unique faculty ID
    let userId;
    let idExists = true;
    let attempts = 0;
    while (idExists && attempts < 10) {
      userId = generateUserId('faculty');
      const { data } = await supabase
        .from('users')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      idExists = !!data;
      attempts++;
    }

    // Generate OTP
    const otp = generateOTP();
    const salt = await bcrypt.genSalt(12);
    const otpHash = await bcrypt.hash(otp, salt);

    // Parse subjects array
    const subjectsArray = Array.isArray(subjects)
      ? subjects
      : typeof subjects === 'string'
        ? subjects.split(',').map((s) => s.trim()).filter(Boolean)
        : [];

    // Insert user
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        user_id: userId,
        email,
        full_name: fullName,
        password_hash: '',
        role: 'faculty',
        department,
        subjects: subjectsArray,
        otp: otpHash,
        is_first_login: true,
        is_active: true,
        email_verified: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Supabase insert error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create faculty account: ' + error.message,
      });
    }

    console.log('✅ Faculty created:', userId);

    try {
      await syncFacultySubjects(newUser.id, department, subjectsArray);
    } catch (syncErr) {
      console.warn('⚠️ Faculty subject sync failed:', syncErr.message);
    }

    // Send email (non-blocking)
    try {
      await sendCredentialsEmail({
        email,
        fullName,
        userId,
        otp,
        role: 'faculty',
      });
    } catch (emailErr) {
      console.warn('⚠️ Email send failed:', emailErr.message);
    }

    // Log activity (non-blocking)
    logActivity(req.user.id, 'created_faculty', userId, { fullName, email, department, subjects: subjectsArray });

    return res.status(201).json({
      success: true,
      message: 'Faculty account created successfully. Credentials sent via email.',
      user: {
        userId,
        fullName,
        email,
        role: 'faculty',
        department,
        subjects: subjectsArray,
      },
    });
  } catch (error) {
    console.error('❌ Create faculty error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error: ' + error.message,
    });
  }
};

/**
 * Get all users with optional filtering
 */
const getUsers = async (req, res) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('users')
      .select('id, user_id, email, full_name, role, department, degree_course, year, phone, subjects, is_active, email_verified, is_first_login, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (role && role !== 'all') {
      query = query.eq('role', role);
    }

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,user_id.ilike.%${search}%`);
    }

    const { data: users, error, count } = await query;

    if (error) {
      console.error('Get users error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch users.',
      });
    }

    return res.status(200).json({
      success: true,
      users,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error('Get users error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
};

/**
 * Get single user details
 */
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: user, error } = await supabase
      .from('users')
      .select('id, user_id, email, full_name, role, department, degree_course, year, phone, subjects, is_active, email_verified, is_first_login, created_at, updated_at')
      .eq('id', id)
      .single();

    if (error || !user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('Get user error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
};

/**
 * Deactivate a user
 */
const deactivateUser = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: user, error: findError } = await supabase
      .from('users')
      .select('id, user_id, role, full_name')
      .eq('id', id)
      .single();

    if (findError || !user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    if (user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot deactivate admin accounts.',
      });
    }

    const { error } = await supabase
      .from('users')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Failed to deactivate user.',
      });
    }

    // Log activity (non-blocking)
    logActivity(req.user.id, 'deactivated_user', user.user_id, { fullName: user.full_name, role: user.role });

    return res.status(200).json({
      success: true,
      message: 'User deactivated successfully.',
    });
  } catch (error) {
    console.error('Deactivate user error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      fullName,
      email,
      department,
      degreeCourse,
      year,
      phone,
      subjects,
      isActive,
    } = req.body;

    const { data: user, error: findError } = await supabase
      .from('users')
      .select('id, user_id, role')
      .eq('id', id)
      .single();

    if (findError || !user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const updates = {
      updated_at: new Date().toISOString(),
    };
    if (fullName !== undefined) updates.full_name = fullName;
    if (email !== undefined) updates.email = email;
    if (department !== undefined) updates.department = department;
    if (degreeCourse !== undefined) updates.degree_course = degreeCourse;
    if (year !== undefined) updates.year = year;
    if (phone !== undefined) updates.phone = phone || null;
    if (Array.isArray(subjects)) updates.subjects = subjects;
    if (typeof isActive === 'boolean' && user.role !== 'admin') updates.is_active = isActive;

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select('id, user_id, email, full_name, role, department, degree_course, year, phone, subjects, is_active, email_verified, is_first_login, created_at')
      .single();

    if (error) throw error;

    if (user.role === 'faculty' && Array.isArray(subjects)) {
      await syncFacultySubjects(id, department, subjects);
    }

    logActivity(req.user.id, 'updated_user', user.user_id, updates);

    return res.json({ success: true, user: data, message: 'User updated successfully.' });
  } catch (error) {
    console.error('Update user error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const reactivateUser = async (req, res) => {
  try {
    const { data: user, error: findError } = await supabase
      .from('users')
      .select('id, user_id, role')
      .eq('id', req.params.id)
      .single();

    if (findError || !user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    if (user.role === 'admin') {
      return res.status(403).json({ success: false, message: 'Admin accounts do not need reactivation.' });
    }

    const { data, error } = await supabase
      .from('users')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('id, user_id, email, full_name, role, department, degree_course, year, phone, subjects, is_active, email_verified, is_first_login, created_at')
      .single();

    if (error) throw error;
    logActivity(req.user.id, 'reactivated_user', user.user_id, {});
    return res.json({ success: true, user: data, message: 'User reactivated successfully.' });
  } catch (error) {
    console.error('Reactivate user error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get dashboard analytics
 */
const getAnalytics = async (req, res) => {
  try {
    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // ═══════════════════════════════════════
    // 1. BASIC COUNTS (parallel)
    // ═══════════════════════════════════════
    const [
      { count: totalStudents },
      { count: totalFaculty },
      { count: activeUsers },
      { count: pendingFirstLogin },
      { count: totalSubjects },
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'student'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'faculty'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_active', true).neq('role', 'admin'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_first_login', true).neq('role', 'admin'),
      supabase.from('subjects').select('*', { count: 'exact', head: true }),
    ]);

    // ═══════════════════════════════════════
    // 2. TIMETABLE DATA
    // ═══════════════════════════════════════
    const { data: allSlots } = await supabase
      .from('timetable_slots')
      .select('*, subject:subjects(name, code, credits, semester), faculty:users!timetable_slots_faculty_id_fkey(full_name, department)')
      .order('day')
      .order('start_time');

    const slots = allSlots || [];

    // ═══════════════════════════════════════
    // 3. CLASSROOM DATA
    // ═══════════════════════════════════════
    const { data: classrooms } = await supabase
      .from('classrooms')
      .select('*');
    const rooms = classrooms || [];
    const activeRooms = rooms.filter(r => r.is_active);

    // ═══════════════════════════════════════
    // 4. TIME SLOT TEMPLATES
    // ═══════════════════════════════════════
    const { data: timeTemplates } = await supabase
      .from('time_slot_templates')
      .select('*')
      .eq('is_break', false)
      .order('slot_number');
    const tSlots = timeTemplates || [];
    const maxSlotsPerDay = tSlots.length || 7;
    const totalPossibleSlots = DAYS.length * maxSlotsPerDay;

    // ═══════════════════════════════════════
    // 5. CLASSROOM UTILIZATION
    // ═══════════════════════════════════════
    const roomUsage = {};
    for (const room of activeRooms) {
      roomUsage[room.id] = {
        id: room.id,
        name: room.name,
        capacity: room.capacity || 0,
        type: room.type || 'lecture_hall',
        usedSlots: 0,
        totalPossible: totalPossibleSlots,
        usage: 0,
        idleSlots: 0,
        classes: [],
      };
    }
    for (const slot of slots) {
      if (slot.room && roomUsage[slot.room]) {
        roomUsage[slot.room].usedSlots++;
        roomUsage[slot.room].classes.push({
          day: slot.day,
          time: `${slot.start_time?.slice(0, 5)}-${slot.end_time?.slice(0, 5)}`,
          subject: slot.subject?.name || slot.subject?.code,
        });
      }
    }
    const roomUtilization = Object.values(roomUsage).map(r => {
      r.usage = totalPossibleSlots > 0 ? Math.round((r.usedSlots / totalPossibleSlots) * 100) : 0;
      r.idleSlots = totalPossibleSlots - r.usedSlots;
      return r;
    }).sort((a, b) => b.usage - a.usage);

    const avgRoomUsage = roomUtilization.length > 0
      ? Math.round(roomUtilization.reduce((s, r) => s + r.usage, 0) / roomUtilization.length)
      : 0;

    // Rooms not assigned any slot
    const unusedRooms = roomUtilization.filter(r => r.usedSlots === 0);

    // ═══════════════════════════════════════
    // 6. FACULTY WORKLOAD DISTRIBUTION
    // ═══════════════════════════════════════
    const facultyLoad = {};
    for (const slot of slots) {
      if (!slot.faculty_id) continue;
      if (!facultyLoad[slot.faculty_id]) {
        facultyLoad[slot.faculty_id] = {
          id: slot.faculty_id,
          name: slot.faculty?.full_name || 'Unknown',
          department: slot.faculty?.department || '',
          totalClasses: 0,
          uniqueSubjects: new Set(),
          dayBreakdown: {},
        };
      }
      facultyLoad[slot.faculty_id].totalClasses++;
      if (slot.subject?.name) facultyLoad[slot.faculty_id].uniqueSubjects.add(slot.subject.name);
      facultyLoad[slot.faculty_id].dayBreakdown[slot.day] =
        (facultyLoad[slot.faculty_id].dayBreakdown[slot.day] || 0) + 1;
    }
    const workloadData = Object.values(facultyLoad)
      .map(f => ({
        ...f,
        uniqueSubjects: f.uniqueSubjects.size,
        subjectList: [...f.uniqueSubjects],
        avgPerDay: Number((f.totalClasses / DAYS.length).toFixed(1)),
      }))
      .sort((a, b) => b.totalClasses - a.totalClasses);

    const avgWorkload = workloadData.length > 0
      ? Math.round(workloadData.reduce((s, f) => s + f.totalClasses, 0) / workloadData.length)
      : 0;
    const overloaded = workloadData.filter(f => f.totalClasses > avgWorkload * 1.5);
    const underloaded = workloadData.filter(f => f.totalClasses < avgWorkload * 0.5 && f.totalClasses > 0);

    // ═══════════════════════════════════════
    // 7. DAY × PERIOD HEATMAP
    // ═══════════════════════════════════════
    const heatmap = [];
    for (let di = 0; di < DAYS.length; di++) {
      for (let ti = 0; ti < tSlots.length; ti++) {
        const tSlot = tSlots[ti];
        const count = slots.filter(s =>
          s.day === DAYS[di] && s.start_time === tSlot.start_time
        ).length;
        heatmap.push({
          day: DAYS[di],
          dayIndex: di,
          period: `P${ti + 1}`,
          periodIndex: ti,
          time: `${tSlot.start_time?.slice(0, 5)}-${tSlot.end_time?.slice(0, 5)}`,
          count,
          intensity: activeRooms.length > 0
            ? Math.round((count / activeRooms.length) * 100)
            : 0,
        });
      }
    }

    // ═══════════════════════════════════════
    // 8. DAY DISTRIBUTION (bar chart)
    // ═══════════════════════════════════════
    const dayDistribution = DAYS.map(day => ({
      day: day.slice(0, 3),
      fullDay: day,
      classes: slots.filter(s => s.day === day).length,
    }));

    // ═══════════════════════════════════════
    // 9. DEPARTMENT BREAKDOWN
    // ═══════════════════════════════════════
    const { data: allUsers } = await supabase
      .from('users')
      .select('department, role')
      .eq('is_active', true)
      .neq('role', 'admin');

    const deptData = {};
    for (const u of (allUsers || [])) {
      const d = u.department || 'Unassigned';
      if (!deptData[d]) deptData[d] = { name: d, students: 0, faculty: 0, classes: 0 };
      if (u.role === 'student') deptData[d].students++;
      if (u.role === 'faculty') deptData[d].faculty++;
    }
    for (const s of slots) {
      const d = s.department || 'Unassigned';
      if (!deptData[d]) deptData[d] = { name: d, students: 0, faculty: 0, classes: 0 };
      deptData[d].classes++;
    }
    const departmentBreakdown = Object.values(deptData).sort((a, b) => b.classes - a.classes);

    const sectionData = {};
    for (const slot of slots) {
      const year = slot.year || 'All Years';
      const semester = slot.subject?.semester || 'Unassigned Semester';
      const key = `${year}|${semester}`;
      if (!sectionData[key]) sectionData[key] = { year, semester, classes: 0, departments: new Set() };
      sectionData[key].classes++;
      if (slot.department) sectionData[key].departments.add(slot.department);
    }
    const sectionBreakdown = Object.values(sectionData)
      .map(section => ({ ...section, departments: section.departments.size }))
      .sort((a, b) => {
        const ay = Number(String(a.year).match(/\d+/)?.[0] || 999);
        const by = Number(String(b.year).match(/\d+/)?.[0] || 999);
        const as = Number(String(a.semester).match(/\d+/)?.[0] || 999);
        const bs = Number(String(b.semester).match(/\d+/)?.[0] || 999);
        return ay - by || as - bs;
      });

    // ═══════════════════════════════════════
    // 10. ENERGY EFFICIENCY ANALYTICS
    // ═══════════════════════════════════════
    const WATTS_PER_ROOM = 2000; // Avg power per occupied room-hour
    const HOURS_PER_SLOT = 1;
    const totalRoomHoursUsed = slots.filter(s => s.room).length * HOURS_PER_SLOT;
    const totalRoomHoursAvailable = activeRooms.length * totalPossibleSlots * HOURS_PER_SLOT;
    const energyUsedKWh = (totalRoomHoursUsed * WATTS_PER_ROOM) / 1000;
    const energyMaxKWh = (totalRoomHoursAvailable * WATTS_PER_ROOM) / 1000;
    const energySavedKWh = energyMaxKWh - energyUsedKWh;
    const energyEfficiency = totalRoomHoursAvailable > 0
      ? Math.round((1 - totalRoomHoursUsed / totalRoomHoursAvailable) * 100)
      : 0;

    // Peak hour identification
    const periodCounts = {};
    for (const slot of slots) {
      const key = slot.start_time?.slice(0, 5) || 'unknown';
      periodCounts[key] = (periodCounts[key] || 0) + 1;
    }
    const peakPeriod = Object.entries(periodCounts).sort(([, a], [, b]) => b - a)[0];

    // Idle time: slots with 0 classes across all rooms
    const idleTimePeriods = [];
    for (const day of DAYS) {
      for (const t of tSlots) {
        const count = slots.filter(s => s.day === day && s.start_time === t.start_time).length;
        if (count === 0) {
          idleTimePeriods.push({
            day,
            time: `${t.start_time?.slice(0, 5)}-${t.end_time?.slice(0, 5)}`,
            allRoomsIdle: true,
          });
        }
      }
    }

    // ═══════════════════════════════════════
    // 11. RECENT ACTIVITY
    // ═══════════════════════════════════════
    const { data: recentLogs } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    // ═══════════════════════════════════════
    // RESPONSE
    // ═══════════════════════════════════════
    return res.status(200).json({
      success: true,
      analytics: {
        // Basic stats
        totalStudents: totalStudents || 0,
        totalFaculty: totalFaculty || 0,
        activeUsers: activeUsers || 0,
        pendingFirstLogin: pendingFirstLogin || 0,
        totalSubjects: totalSubjects || 0,
        totalSlots: slots.length,
        totalRooms: activeRooms.length,

        // Room utilization
        roomUtilization,
        avgRoomUsage,
        unusedRooms: unusedRooms.length,

        // Faculty workload
        workloadData,
        avgWorkload,
        overloadedFaculty: overloaded.length,
        underloadedFaculty: underloaded.length,

        // Heatmap
        heatmap,
        periodsPerDay: tSlots.length,

        // Charts
        dayDistribution,
        departmentBreakdown,
        sectionBreakdown,

        // Energy
        energy: {
          usedKWh: Math.round(energyUsedKWh),
          maxKWh: Math.round(energyMaxKWh),
          savedKWh: Math.round(energySavedKWh),
          efficiency: energyEfficiency,
          roomHoursUsed: totalRoomHoursUsed,
          roomHoursAvailable: totalRoomHoursAvailable,
          peakPeriod: peakPeriod ? { time: peakPeriod[0], classes: peakPeriod[1] } : null,
          idleTimePeriods,
          totalIdleSlots: idleTimePeriods.length,
        },

        // Activity
        recentActivity: recentLogs || [],
      },
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
};

/**
 * Get activity logs
 */
const getActivityLogs = async (req, res) => {
  try {
    const { page = 1, limit = 30 } = req.query;
    const offset = (page - 1) * limit;

    const { data: logs, error, count } = await supabase
      .from('activity_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch activity logs.',
      });
    }

    return res.status(200).json({
      success: true,
      logs,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error('Activity logs error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
};

// ── Subjects ──
const getSubjects = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .order('department')
      .order('name');
    if (error) throw error;
    res.json({ success: true, subjects: data || [] });
  } catch (err) {
    console.error('Get subjects error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const createSubject = async (req, res) => {
  try {
    const { name, code, department, credits, semester } = req.body;
    const { data, error } = await supabase
      .from('subjects')
      .insert({ name, code, department, credits: credits || 3, semester })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ success: true, subject: data, message: 'Subject created.' });
  } catch (err) {
    console.error('Create subject error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateSubject = async (req, res) => {
  try {
    const { name, code, department, credits, semester } = req.body;
    const { data, error } = await supabase
      .from('subjects')
      .update({ name, code, department, credits: credits || 3, semester: semester || null })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, subject: data, message: 'Subject updated.' });
  } catch (err) {
    console.error('Update subject error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteSubject = async (req, res) => {
  try {
    const subjectId = req.params.id;
    const [{ count: assignmentCount }, { count: slotCount }] = await Promise.all([
      supabase.from('faculty_subjects').select('*', { count: 'exact', head: true }).eq('subject_id', subjectId),
      supabase.from('timetable_slots').select('*', { count: 'exact', head: true }).eq('subject_id', subjectId),
    ]);

    if ((assignmentCount || 0) > 0 || (slotCount || 0) > 0) {
      return res.status(409).json({
        success: false,
        message: 'Subject is assigned or used in timetable slots. Remove those links before deleting.',
      });
    }

    const { error } = await supabase.from('subjects').delete().eq('id', subjectId);
    if (error) throw error;
    res.json({ success: true, message: 'Subject deleted.' });
  } catch (err) {
    console.error('Delete subject error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const assignSubject = async (req, res) => {
  try {
    const { faculty_id, subject_id } = req.body;
    const { data, error } = await supabase
      .from('faculty_subjects')
      .insert({ faculty_id, subject_id })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ success: true, assignment: data, message: 'Subject assigned to faculty.' });
  } catch (err) {
    console.error('Assign subject error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Timetable ──
const getTimetableSlots = async (req, res) => {
  try {
    const { department } = req.query;
    let query = supabase
      .from('timetable_slots')
      .select('*, subject:subjects(name, code, credits, semester), faculty:users!timetable_slots_faculty_id_fkey(full_name)')
      .order('day')
      .order('start_time');
    if (department) query = query.eq('department', department);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, slots: data || [] });
  } catch (err) {
    console.error('Get timetable error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const createTimetableSlot = async (req, res) => {
  try {
    const { subject_id, faculty_id, department, year, day, start_time, end_time, room, slot_type } = req.body;
    const conflictMessage = await validateTimetableSlotConflicts({ subject_id, faculty_id, department, year, day, start_time, end_time, room });
    if (conflictMessage) {
      return res.status(409).json({ success: false, message: conflictMessage });
    }

    const { data, error } = await supabase
      .from('timetable_slots')
      .insert({ subject_id, faculty_id, department, year, day, start_time, end_time, room, slot_type: slot_type || 'lecture' })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ success: true, slot: data, message: 'Timetable slot created.' });
  } catch (err) {
    console.error('Create timetable slot error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateTimetableSlot = async (req, res) => {
  try {
    const { subject_id, faculty_id, department, year, day, start_time, end_time, room, slot_type } = req.body;
    const slot = { subject_id, faculty_id, department, year, day, start_time, end_time, room, slot_type: slot_type || 'lecture' };
    const conflictMessage = await validateTimetableSlotConflicts(slot, req.params.id);
    if (conflictMessage) {
      return res.status(409).json({ success: false, message: conflictMessage });
    }

    const { data, error } = await supabase
      .from('timetable_slots')
      .update(slot)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, slot: data, message: 'Timetable slot updated.' });
  } catch (err) {
    console.error('Update timetable slot error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteTimetableSlot = async (req, res) => {
  try {
    const { error } = await supabase
      .from('timetable_slots')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true, message: 'Timetable slot deleted.' });
  } catch (err) {
    console.error('Delete timetable slot error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Leave management ──
const getLeaveRequests = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*, faculty:users!leave_requests_faculty_id_fkey(full_name, email, department)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ success: true, leaves: data || [] });
  } catch (err) {
    console.error('Get leaves error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateLeaveStatus = async (req, res) => {
  try {
    const { status, admin_note } = req.body;
    const { data, error } = await supabase
      .from('leave_requests')
      .update({ status, admin_note, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;

    // Auto-trigger rescheduling on approval (non-blocking)
    const selfCoverage = data?.reason?.includes('Mode: Faculty will take class in another free room');
    if (status === 'approved' && selfCoverage) {
      const roomChoices = [...(data.reason || '').matchAll(/slot ([0-9a-f-]{36}): .*: room ([^\n]+)/gi)];
      for (const [, slotId, room] of roomChoices) {
        if (room && room !== 'not selected') {
          await supabase
            .from('timetable_slots')
            .update({ room })
            .eq('id', slotId)
            .eq('faculty_id', data.faculty_id);
        }
      }
    }

    if (status === 'approved' && data?.faculty_id && !selfCoverage) {
      try {
        const { onLeaveApproved } = require('../services/conflictService');
        onLeaveApproved(data.faculty_id, data.start_date, data.end_date)
          .then(r => console.log(`[Auto-Reschedule] Leave approved → ${r.substituted || 0} classes reassigned`))
          .catch(e => console.error('[Auto-Reschedule] Error:', e.message));
      } catch (hookErr) {
        console.error('[Auto-Reschedule] Hook error:', hookErr.message);
      }
    }

    res.json({ success: true, leave: data, message: `Leave ${status}.` });
  } catch (err) {
    console.error('Update leave error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  createStudent,
  createFaculty,
  getUsers,
  getUserById,
  deactivateUser,
  updateUser,
  reactivateUser,
  getAnalytics,
  getActivityLogs,
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  assignSubject,
  getTimetableSlots,
  createTimetableSlot,
  updateTimetableSlot,
  deleteTimetableSlot,
  getLeaveRequests,
  updateLeaveStatus,
};
