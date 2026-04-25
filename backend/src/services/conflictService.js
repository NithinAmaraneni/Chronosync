/**
 * ═══════════════════════════════════════════════════════════════
 *  ChronoSync — Conflict Detection & Smart Rescheduling Service
 *  Handles dynamic timetable updates, real-time conflict
 *  detection, and instant targeted rescheduling.
 * ═══════════════════════════════════════════════════════════════
 *
 *  Triggers:
 *  ┌───────────────────────┐     ┌───────────────────────┐
 *  │ Faculty leave approved│──┐  │ Room deactivated      │──┐
 *  └───────────────────────┘  │  └───────────────────────┘  │
 *  ┌───────────────────────┐  │  ┌───────────────────────┐  │
 *  │ New subject assigned  │──┼──│ Manual trigger        │──┤
 *  └───────────────────────┘  │  └───────────────────────┘  │
 *                             ▼                             │
 *                    ┌────────────────┐                     │
 *                    │ detectConflicts │◄────────────────────┘
 *                    └───────┬────────┘
 *                            ▼
 *                    ┌────────────────┐
 *                    │ smartReschedule │ (targeted micro-GA)
 *                    └────────────────┘
 */

const supabase = require('../config/supabase');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ═══════════════════════════════════════════════════════════
// 1. CONFLICT DETECTION — Real-time timetable analysis
// ═══════════════════════════════════════════════════════════

/**
 * Scan the entire timetable (or a filtered subset) and report
 * every conflict with type, severity, and affected entities.
 */
async function detectConflicts(department) {
  // Load current timetable slots
  let query = supabase
    .from('timetable_slots')
    .select('*, subject:subjects(name, code), faculty:users!timetable_slots_faculty_id_fkey(full_name, user_id)')
    .order('day')
    .order('start_time');
  if (department) query = query.eq('department', department);
  const { data: slots } = await query;
  if (!slots || slots.length === 0) return { conflicts: [], stats: { total: 0 }, slots: [] };

  // Load approved leaves (current & future)
  const today = new Date().toISOString().split('T')[0];
  const { data: leaves } = await supabase
    .from('leave_requests')
    .select('*, faculty:users!leave_requests_faculty_id_fkey(full_name)')
    .eq('status', 'approved')
    .gte('end_date', today);

  // Load availability
  const facultyIds = [...new Set(slots.filter(s => s.faculty_id).map(s => s.faculty_id))];
  const { data: availability } = await supabase
    .from('faculty_availability')
    .select('*')
    .in('faculty_id', facultyIds.length ? facultyIds : ['_none_']);

  // Load rooms
  const { data: rooms } = await supabase
    .from('classrooms')
    .select('id, name, is_active')
    .eq('is_active', false);
  const deactivatedRoomIds = new Set((rooms || []).map(r => r.id));

  const conflicts = [];

  // ── (A) Faculty Double-Booking ──
  const facultyTimeMap = {};
  for (const slot of slots) {
    if (!slot.faculty_id) continue;
    const key = `${slot.faculty_id}_${slot.day}_${slot.start_time}`;
    if (!facultyTimeMap[key]) facultyTimeMap[key] = [];
    facultyTimeMap[key].push(slot);
  }
  for (const [, group] of Object.entries(facultyTimeMap)) {
    if (group.length > 1) {
      conflicts.push({
        type: 'faculty_double_booking',
        severity: 'critical',
        icon: '🔴',
        title: `Faculty double-booked`,
        description: `${group[0].faculty?.full_name || 'Unknown'} has ${group.length} classes at ${group[0].day} ${group[0].start_time?.slice(0, 5)}`,
        affectedSlots: group.map(s => s.id),
        day: group[0].day,
        time: group[0].start_time,
        faculty_id: group[0].faculty_id,
        faculty_name: group[0].faculty?.full_name,
      });
    }
  }

  // ── (B) Room Double-Booking ──
  const roomTimeMap = {};
  for (const slot of slots) {
    if (!slot.room) continue;
    const key = `${slot.room}_${slot.day}_${slot.start_time}`;
    if (!roomTimeMap[key]) roomTimeMap[key] = [];
    roomTimeMap[key].push(slot);
  }
  for (const [, group] of Object.entries(roomTimeMap)) {
    if (group.length > 1) {
      conflicts.push({
        type: 'room_double_booking',
        severity: 'critical',
        icon: '🏠',
        title: `Room double-booked`,
        description: `Room is used by ${group.length} classes at ${group[0].day} ${group[0].start_time?.slice(0, 5)}`,
        affectedSlots: group.map(s => s.id),
        day: group[0].day,
        time: group[0].start_time,
        room: group[0].room,
      });
    }
  }

  // ── (C) Student Group Conflict ──
  const deptTimeMap = {};
  for (const slot of slots) {
    const key = `${slot.department}_${slot.year || 'all'}_${slot.day}_${slot.start_time}`;
    if (!deptTimeMap[key]) deptTimeMap[key] = [];
    deptTimeMap[key].push(slot);
  }
  for (const [, group] of Object.entries(deptTimeMap)) {
    if (group.length > 1) {
      conflicts.push({
        type: 'student_group_conflict',
        severity: 'high',
        icon: '🎓',
        title: `Student group overlap`,
        description: `${group[0].department} ${group[0].year || ''} has ${group.length} classes at ${group[0].day} ${group[0].start_time?.slice(0, 5)}`,
        affectedSlots: group.map(s => s.id),
        day: group[0].day,
        time: group[0].start_time,
        department: group[0].department,
      });
    }
  }

  // ── (D) Faculty on Approved Leave ──
  for (const leave of (leaves || [])) {
    // Find slots where this faculty is teaching during their leave
    const affected = slots.filter(s =>
      s.faculty_id === leave.faculty_id
    );
    if (affected.length > 0) {
      conflicts.push({
        type: 'faculty_on_leave',
        severity: 'high',
        icon: '🏖️',
        title: `Faculty on approved leave`,
        description: `${leave.faculty?.full_name || 'Faculty'} has ${affected.length} classes but is on leave (${leave.start_date} → ${leave.end_date})`,
        affectedSlots: affected.map(s => s.id),
        faculty_id: leave.faculty_id,
        faculty_name: leave.faculty?.full_name,
        leave_start: leave.start_date,
        leave_end: leave.end_date,
        leave_id: leave.id,
      });
    }
  }

  // ── (E) Deactivated Room Still in Use ──
  for (const slot of slots) {
    if (slot.room && deactivatedRoomIds.has(slot.room)) {
      conflicts.push({
        type: 'deactivated_room',
        severity: 'medium',
        icon: '🚫',
        title: `Deactivated room in use`,
        description: `Slot on ${slot.day} ${slot.start_time?.slice(0, 5)} uses a deactivated room`,
        affectedSlots: [slot.id],
        day: slot.day,
        time: slot.start_time,
        room: slot.room,
      });
    }
  }

  // ── (F) Faculty Availability Violation ──
  for (const slot of slots) {
    if (!slot.faculty_id) continue;
    const facultyAvail = (availability || []).filter(
      a => a.faculty_id === slot.faculty_id && a.day === slot.day && !a.is_available
    );
    for (const a of facultyAvail) {
      if (a.start_time <= slot.end_time && a.end_time >= slot.start_time) {
        conflicts.push({
          type: 'availability_violation',
          severity: 'medium',
          icon: '⏰',
          title: `Faculty unavailable`,
          description: `${slot.faculty?.full_name || 'Faculty'} marked unavailable on ${slot.day} ${slot.start_time?.slice(0, 5)} but has a class`,
          affectedSlots: [slot.id],
          day: slot.day,
          time: slot.start_time,
          faculty_id: slot.faculty_id,
          faculty_name: slot.faculty?.full_name,
        });
      }
    }
  }

  // ── (G) Unassigned Faculty (orphan slots) ──
  const unassigned = slots.filter(s => !s.faculty_id);
  if (unassigned.length > 0) {
    conflicts.push({
      type: 'no_faculty',
      severity: 'low',
      icon: '👤',
      title: `Unassigned faculty`,
      description: `${unassigned.length} slot(s) have no faculty assigned`,
      affectedSlots: unassigned.map(s => s.id),
    });
  }

  // Build stats
  const severityCount = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const c of conflicts) severityCount[c.severity]++;

  return {
    conflicts,
    stats: {
      total: conflicts.length,
      ...severityCount,
      slotsAffected: [...new Set(conflicts.flatMap(c => c.affectedSlots))].length,
    },
    slotCount: slots.length,
  };
}

// ═══════════════════════════════════════════════════════════
// 2. SMART RESCHEDULER — Targeted micro-fix for specific issues
//    Instead of re-running the full GA, we do a focused search
//    that only moves the affected slots.
// ═══════════════════════════════════════════════════════════

/**
 * Reschedule specific slots affected by a conflict.
 * Uses a focused CSP backtracking search with randomization.
 */
async function smartReschedule(affectedSlotIds, options = {}) {
  const log = [{ t: Date.now(), msg: '🔧 Smart rescheduler starting...' }];

  // Load affected slots
  const { data: affectedSlots } = await supabase
    .from('timetable_slots')
    .select('*, subject:subjects(name, code)')
    .in('id', affectedSlotIds);

  if (!affectedSlots || affectedSlots.length === 0) {
    return { success: false, message: 'No affected slots found.', log, changes: [] };
  }

  // Load all slots to avoid creating new conflicts
  const departments = [...new Set(affectedSlots.map(s => s.department))];
  const { data: allSlots } = await supabase
    .from('timetable_slots')
    .select('*')
    .in('department', departments);

  // Load time slot templates
  const { data: timeSlotTemplates } = await supabase
    .from('time_slot_templates')
    .select('*')
    .eq('is_break', false)
    .order('slot_number');

  // Load available rooms
  const { data: rooms } = await supabase
    .from('classrooms')
    .select('*')
    .eq('is_active', true);

  // Load faculty availability
  const facultyIds = [...new Set(affectedSlots.filter(s => s.faculty_id).map(s => s.faculty_id))];
  const { data: availability } = await supabase
    .from('faculty_availability')
    .select('*')
    .in('faculty_id', facultyIds.length ? facultyIds : ['_none_']);

  const tSlots = timeSlotTemplates || [];
  const rms = rooms || [];
  const avail = availability || [];
  const otherSlots = (allSlots || []).filter(s => !affectedSlotIds.includes(s.id));

  log.push({ t: Date.now(), msg: `📊 ${affectedSlots.length} slots to reschedule, ${otherSlots.length} existing slots, ${tSlots.length} time periods, ${rms.length} rooms` });

  const changes = [];
  let fixed = 0;

  for (const slot of affectedSlots) {
    let bestOption = null;
    let bestScore = -Infinity;
    const maxAttempts = 200;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const day = DAYS[Math.floor(Math.random() * DAYS.length)];
      const tSlot = tSlots[Math.floor(Math.random() * tSlots.length)];
      const room = rms.length > 0 ? rms[Math.floor(Math.random() * rms.length)] : null;

      if (!tSlot) continue;

      let score = 100; // Start with good score

      // Check faculty conflict with existing slots
      if (slot.faculty_id) {
        const facultyConflict = otherSlots.some(s =>
          s.faculty_id === slot.faculty_id &&
          s.day === day &&
          s.start_time === tSlot.start_time
        );
        if (facultyConflict) { score -= 200; }
      }

      // Check room conflict
      if (room) {
        const roomConflict = otherSlots.some(s =>
          s.room === room.id &&
          s.day === day &&
          s.start_time === tSlot.start_time
        );
        if (roomConflict) { score -= 200; }
      }

      // Check student group conflict (same dept+year same time)
      const deptConflict = otherSlots.some(s =>
        s.department === slot.department &&
        (s.year === slot.year || !s.year || !slot.year) &&
        s.day === day &&
        s.start_time === tSlot.start_time
      );
      if (deptConflict) { score -= 150; }

      // Check faculty availability
      if (slot.faculty_id) {
        const unavailable = avail.some(a =>
          a.faculty_id === slot.faculty_id &&
          a.day === day &&
          !a.is_available &&
          a.start_time <= tSlot.end_time &&
          a.end_time >= tSlot.start_time
        );
        if (unavailable) { score -= 60; }
      }

      // Prefer earlier slots + weekdays
      const dayIdx = DAYS.indexOf(day);
      if (dayIdx < 5) score += 5; // Prefer Mon-Fri
      if (tSlot.slot_number <= 4) score += 3; // Prefer morning

      // Prefer keeping same day if possible
      if (day === slot.day) score += 10;

      if (score > bestScore) {
        bestScore = score;
        bestOption = { day, start_time: tSlot.start_time, end_time: tSlot.end_time, room: room?.id || null };
      }

      // Perfect score — stop early
      if (score >= 100) break;
    }

    if (bestOption && bestScore > 0) {
      // Update the slot in DB
      const { error: updateErr } = await supabase
        .from('timetable_slots')
        .update({
          day: bestOption.day,
          start_time: bestOption.start_time,
          end_time: bestOption.end_time,
          room: bestOption.room,
        })
        .eq('id', slot.id);

      if (!updateErr) {
        changes.push({
          slotId: slot.id,
          subject: slot.subject?.name || slot.subject?.code,
          from: { day: slot.day, time: `${slot.start_time?.slice(0, 5)}-${slot.end_time?.slice(0, 5)}` },
          to: { day: bestOption.day, time: `${bestOption.start_time?.slice(0, 5)}-${bestOption.end_time?.slice(0, 5)}` },
          score: bestScore,
        });
        fixed++;
        // Add to otherSlots so subsequent fixes know about this move
        otherSlots.push({ ...slot, ...bestOption });
      }

      log.push({ t: Date.now(), msg: `✅ Moved ${slot.subject?.name || 'slot'}: ${slot.day} → ${bestOption.day} ${bestOption.start_time?.slice(0, 5)} (score: ${bestScore})` });
    } else {
      log.push({ t: Date.now(), msg: `⚠️ Could not find conflict-free slot for ${slot.subject?.name || slot.id}` });
    }
  }

  log.push({ t: Date.now(), msg: `🏁 Rescheduled ${fixed}/${affectedSlots.length} slots` });

  return {
    success: fixed > 0,
    message: fixed === affectedSlots.length
      ? `✅ All ${fixed} slots rescheduled successfully!`
      : fixed > 0
        ? `⚠️ ${fixed}/${affectedSlots.length} slots rescheduled. ${affectedSlots.length - fixed} need manual attention.`
        : `❌ Could not reschedule any slots automatically.`,
    changes,
    fixed,
    total: affectedSlots.length,
    log,
  };
}

// ═══════════════════════════════════════════════════════════
// 3. EVENT TRIGGER HOOKS — Automatic conflict response
// ═══════════════════════════════════════════════════════════

/**
 * Called when a faculty leave is approved.
 * Finds replacement faculty using a multi-factor scoring system:
 *   1. Subject expertise (faculty_subjects match)
 *   2. Availability (not busy + not marked unavailable)
 *   3. Workload balance (fewer classes = preferred)
 *   4. Department match
 */
async function onLeaveApproved(facultyId, leaveStart, leaveEnd) {
  const log = [{ t: Date.now(), msg: `🏖️ Leave trigger: faculty ${facultyId}, ${leaveStart} → ${leaveEnd}` }];

  // Find all the leaving faculty's timetable slots + the subject for each
  const { data: slots } = await supabase
    .from('timetable_slots')
    .select('id, day, start_time, end_time, department, year, room, subject_id, subject:subjects(id, name, code)')
    .eq('faculty_id', facultyId);

  if (!slots || slots.length === 0) {
    log.push({ t: Date.now(), msg: '📭 No timetable slots affected' });
    return { triggered: false, message: 'No slots affected.', log, changes: [] };
  }

  log.push({ t: Date.now(), msg: `📋 ${slots.length} slots affected by leave` });

  // Get leaving faculty info
  const { data: leavingFaculty } = await supabase
    .from('users')
    .select('department, full_name')
    .eq('id', facultyId)
    .maybeSingle();

  const dept = leavingFaculty?.department;
  if (!dept) {
    log.push({ t: Date.now(), msg: '⚠️ Could not determine faculty department' });
    return { triggered: false, message: 'Faculty department not found.', log, changes: [] };
  }

  log.push({ t: Date.now(), msg: `👩‍🏫 ${leavingFaculty.full_name} (${dept})` });

  // ══════════════════════════════════════════
  // Load all candidate data in parallel
  // ══════════════════════════════════════════

  // All active faculty in the same department (excluding the leaving one)
  const { data: candidates } = await supabase
    .from('users')
    .select('id, full_name, department')
    .eq('role', 'faculty')
    .eq('is_active', true)
    .eq('department', dept)
    .neq('id', facultyId);

  if (!candidates || candidates.length === 0) {
    log.push({ t: Date.now(), msg: '❌ No other faculty in department to substitute' });
    return { triggered: true, message: 'No substitute faculty available in department.', log, changes: [], substituted: 0, remaining: slots.length, total: slots.length };
  }

  log.push({ t: Date.now(), msg: `🔍 ${candidates.length} potential substitutes found` });

  const candidateIds = candidates.map(c => c.id);

  // Load subject expertise for all candidates
  const { data: expertiseRaw } = await supabase
    .from('faculty_subjects')
    .select('faculty_id, subject_id')
    .in('faculty_id', candidateIds);
  const expertise = expertiseRaw || [];

  // Build expertise map: { faculty_id: Set(subject_ids) }
  const expertiseMap = {};
  for (const e of expertise) {
    if (!expertiseMap[e.faculty_id]) expertiseMap[e.faculty_id] = new Set();
    expertiseMap[e.faculty_id].add(e.subject_id);
  }

  // Load all current timetable slots for candidates (to check busy times + workload)
  const { data: candidateSlots } = await supabase
    .from('timetable_slots')
    .select('faculty_id, day, start_time')
    .in('faculty_id', candidateIds);

  // Build busy map: { "faculty_day_time": true }
  const busyMap = {};
  const workloadMap = {};
  for (const s of (candidateSlots || [])) {
    busyMap[`${s.faculty_id}_${s.day}_${s.start_time}`] = true;
    workloadMap[s.faculty_id] = (workloadMap[s.faculty_id] || 0) + 1;
  }

  // Load availability restrictions
  const { data: availRaw } = await supabase
    .from('faculty_availability')
    .select('faculty_id, day, start_time, end_time, is_available')
    .in('faculty_id', candidateIds)
    .eq('is_available', false);
  const unavailMap = {};
  for (const a of (availRaw || [])) {
    const key = `${a.faculty_id}_${a.day}`;
    if (!unavailMap[key]) unavailMap[key] = [];
    unavailMap[key].push(a);
  }

  // Load approved leaves for candidates
  const today = new Date().toISOString().split('T')[0];
  const { data: candidateLeaves } = await supabase
    .from('leave_requests')
    .select('faculty_id, start_date, end_date')
    .in('faculty_id', candidateIds)
    .eq('status', 'approved')
    .gte('end_date', today);
  const onLeaveSet = new Set((candidateLeaves || []).map(l => l.faculty_id));

  // ══════════════════════════════════════════
  // Score and assign substitutes
  // ══════════════════════════════════════════
  let substituted = 0;
  const changes = [];
  const avgWorkload = Object.values(workloadMap).length > 0
    ? Object.values(workloadMap).reduce((a, b) => a + b, 0) / Object.values(workloadMap).length
    : 0;

  for (const slot of slots) {
    // Score each candidate for this specific slot
    const scored = [];

    for (const candidate of candidates) {
      let score = 0;
      const reasons = [];

      // (1) Filter: Is the candidate on leave themselves?
      if (onLeaveSet.has(candidate.id)) continue;

      // (2) Filter: Is the candidate busy at this exact time?
      if (busyMap[`${candidate.id}_${slot.day}_${slot.start_time}`]) continue;

      // (3) Subject expertise (+50 if teaches same subject)
      const subjectId = slot.subject_id || slot.subject?.id;
      if (subjectId && expertiseMap[candidate.id]?.has(subjectId)) {
        score += 50;
        reasons.push('subject expert');
      } else {
        // Check if they teach ANY subject (at least they're a teacher)
        if (expertiseMap[candidate.id]?.size > 0) {
          score += 10;
          reasons.push('has expertise');
        }
      }

      // (4) Availability: not marked unavailable at this time (+30)
      const unavailKey = `${candidate.id}_${slot.day}`;
      const unavails = unavailMap[unavailKey] || [];
      const isUnavailable = unavails.some(a =>
        a.start_time <= slot.end_time && a.end_time >= slot.start_time
      );
      if (!isUnavailable) {
        score += 30;
        reasons.push('available');
      } else {
        score -= 20;
        reasons.push('marked unavailable');
      }

      // (5) Workload balance: prefer faculty with fewer classes (+20 max)
      const candLoad = workloadMap[candidate.id] || 0;
      const loadScore = Math.max(0, 20 - Math.abs(candLoad - avgWorkload) * 3);
      score += loadScore;
      if (candLoad <= avgWorkload) reasons.push('balanced load');

      // (6) Department match (+10 — already filtered by dept, but bonus for confidence)
      score += 10;

      scored.push({ candidate, score, reasons });
    }

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    if (scored.length > 0 && scored[0].score > 0) {
      const best = scored[0];

      // Update timetable slot
      await supabase
        .from('timetable_slots')
        .update({ faculty_id: best.candidate.id })
        .eq('id', slot.id);

      // Track the assigned workload
      busyMap[`${best.candidate.id}_${slot.day}_${slot.start_time}`] = true;
      workloadMap[best.candidate.id] = (workloadMap[best.candidate.id] || 0) + 1;

      changes.push({
        slotId: slot.id,
        subject: slot.subject?.name || slot.subject?.code,
        action: 'substituted',
        from: facultyId,
        fromName: leavingFaculty.full_name,
        to: best.candidate.id,
        toName: best.candidate.full_name,
        day: slot.day,
        time: slot.start_time?.slice(0, 5),
        matchScore: best.score,
        matchReasons: best.reasons,
      });
      substituted++;
      log.push({
        t: Date.now(),
        msg: `✅ ${slot.day} ${slot.start_time?.slice(0, 5)} ${slot.subject?.name || ''} → ${best.candidate.full_name} (score: ${best.score}, ${best.reasons.join(', ')})`,
      });
    } else {
      log.push({
        t: Date.now(),
        msg: `⚠️ ${slot.day} ${slot.start_time?.slice(0, 5)} ${slot.subject?.name || ''}: No suitable substitute found`,
      });
    }
  }

  const remaining = slots.length - substituted;
  log.push({ t: Date.now(), msg: `🏁 Result: ${substituted} substituted, ${remaining} need manual attention` });

  return {
    triggered: true,
    message: substituted === slots.length
      ? `✅ All ${substituted} classes reassigned to qualified substitute faculty!`
      : substituted > 0
        ? `⚠️ ${substituted}/${slots.length} classes substituted (by expertise match). ${remaining} need manual reassignment.`
        : `❌ Could not find suitable substitutes. Manual assignment required.`,
    changes,
    substituted,
    remaining,
    total: slots.length,
    log,
  };
}

/**
 * Called when a classroom is deactivated.
 * Finds and reassigns all slots using that room.
 */
async function onRoomDeactivated(roomId) {
  const log = [{ t: Date.now(), msg: `🏠 Room deactivation trigger: ${roomId}` }];

  // Find affected slots
  const { data: affected } = await supabase
    .from('timetable_slots')
    .select('id, day, start_time, room, subject:subjects(name)')
    .eq('room', roomId);

  if (!affected || affected.length === 0) {
    log.push({ t: Date.now(), msg: '📭 No slots use this room' });
    return { triggered: false, message: 'No slots affected.', log, changes: [] };
  }

  log.push({ t: Date.now(), msg: `📋 ${affected.length} slots use deactivated room` });

  // Find available rooms
  const { data: activeRooms } = await supabase
    .from('classrooms')
    .select('*')
    .eq('is_active', true)
    .neq('id', roomId);

  // Load all current slots to check room usage
  const { data: allSlots } = await supabase
    .from('timetable_slots')
    .select('room, day, start_time');

  const changes = [];
  let reassigned = 0;

  for (const slot of affected) {
    // Find rooms that are free at this time
    const busyRooms = new Set(
      (allSlots || [])
        .filter(s => s.day === slot.day && s.start_time === slot.start_time && s.room)
        .map(s => s.room)
    );

    const freeRoom = (activeRooms || []).find(r => !busyRooms.has(r.id));
    if (freeRoom) {
      await supabase
        .from('timetable_slots')
        .update({ room: freeRoom.id })
        .eq('id', slot.id);

      changes.push({
        slotId: slot.id,
        subject: slot.subject?.name,
        action: 'room_reassigned',
        from: roomId,
        to: freeRoom.id,
        toName: freeRoom.name,
        day: slot.day,
        time: slot.start_time?.slice(0, 5),
      });
      reassigned++;
      log.push({ t: Date.now(), msg: `🔄 ${slot.day} ${slot.start_time?.slice(0, 5)}: ${slot.subject?.name} → Room ${freeRoom.name}` });
    } else {
      // No room available — clear room assignment
      await supabase
        .from('timetable_slots')
        .update({ room: null })
        .eq('id', slot.id);

      changes.push({
        slotId: slot.id, subject: slot.subject?.name,
        action: 'room_cleared', day: slot.day, time: slot.start_time?.slice(0, 5),
      });
      log.push({ t: Date.now(), msg: `⚠️ ${slot.day} ${slot.start_time?.slice(0, 5)}: No free room — cleared assignment` });
    }
  }

  log.push({ t: Date.now(), msg: `🏁 ${reassigned} rooms reassigned, ${affected.length - reassigned} cleared` });

  return {
    triggered: true,
    message: `🔄 ${reassigned}/${affected.length} slots reassigned to new rooms.`,
    changes,
    reassigned,
    total: affected.length,
    log,
  };
}

/**
 * Called when a new subject is assigned to a faculty.
 * Inserts new slots into the timetable using CSP search.
 */
async function onNewSubjectAssigned(facultyId, subjectId) {
  const log = [{ t: Date.now(), msg: `📚 New subject trigger: faculty=${facultyId}, subject=${subjectId}` }];

  // Load subject details
  const { data: subject } = await supabase
    .from('subjects')
    .select('*')
    .eq('id', subjectId)
    .maybeSingle();

  if (!subject) {
    return { triggered: false, message: 'Subject not found.', log, changes: [] };
  }

  const sessionsNeeded = Math.min(subject.credits || 3, 6);
  log.push({ t: Date.now(), msg: `📋 Need to schedule ${sessionsNeeded} sessions for ${subject.name}` });

  // Load existing timetable
  const { data: allSlots } = await supabase
    .from('timetable_slots')
    .select('*')
    .eq('department', subject.department);

  // Load time slots + rooms
  const { data: timeSlots } = await supabase
    .from('time_slot_templates')
    .select('*')
    .eq('is_break', false)
    .order('slot_number');

  const { data: rooms } = await supabase
    .from('classrooms')
    .select('*')
    .eq('is_active', true);

  const tSlots = timeSlots || [];
  const rms = rooms || [];
  const existing = allSlots || [];

  const newSlots = [];
  const changes = [];
  const usedDays = new Set();

  for (let i = 0; i < sessionsNeeded; i++) {
    let placed = false;

    // Try each day-slot combo, preferring spread across different days
    const shuffledDays = [...DAYS].sort(() => Math.random() - 0.5);
    // Prefer days not yet used
    shuffledDays.sort((a, b) => (usedDays.has(a) ? 1 : 0) - (usedDays.has(b) ? 1 : 0));

    for (const day of shuffledDays) {
      if (placed) break;
      const shuffledSlots = [...tSlots].sort(() => Math.random() - 0.5);

      for (const tSlot of shuffledSlots) {
        // Check faculty free
        const facBusy = existing.some(s =>
          s.faculty_id === facultyId && s.day === day && s.start_time === tSlot.start_time
        );
        if (facBusy) continue;

        // Check dept free
        const deptBusy = existing.some(s =>
          s.department === subject.department && s.day === day && s.start_time === tSlot.start_time
        );
        if (deptBusy) continue;

        // Find a free room
        const busyRooms = new Set(
          existing.filter(s => s.day === day && s.start_time === tSlot.start_time && s.room).map(s => s.room)
        );
        const freeRoom = rms.find(r => !busyRooms.has(r.id));

        const newSlot = {
          subject_id: subjectId,
          faculty_id: facultyId,
          department: subject.department,
          year: null,
          day,
          start_time: tSlot.start_time,
          end_time: tSlot.end_time,
          room: freeRoom?.id || null,
          slot_type: 'lecture',
        };

        const { data: inserted, error: insErr } = await supabase
          .from('timetable_slots')
          .insert(newSlot)
          .select()
          .single();

        if (!insErr && inserted) {
          newSlots.push(inserted);
          existing.push(inserted); // Track so next session avoids this slot
          usedDays.add(day);
          changes.push({
            slotId: inserted.id,
            subject: subject.name,
            action: 'added',
            day,
            time: `${tSlot.start_time?.slice(0, 5)}-${tSlot.end_time?.slice(0, 5)}`,
            room: freeRoom?.name || null,
          });
          log.push({ t: Date.now(), msg: `✅ Session ${i + 1} placed: ${day} ${tSlot.start_time?.slice(0, 5)}${freeRoom ? ` (${freeRoom.name})` : ''}` });
          placed = true;
        }
        break; // Move to next session
      }
    }

    if (!placed) {
      log.push({ t: Date.now(), msg: `⚠️ Could not place session ${i + 1} — no conflict-free slot available` });
    }
  }

  log.push({ t: Date.now(), msg: `🏁 Placed ${newSlots.length}/${sessionsNeeded} sessions` });

  return {
    triggered: true,
    message: newSlots.length === sessionsNeeded
      ? `✅ All ${sessionsNeeded} sessions for "${subject.name}" scheduled!`
      : `⚠️ ${newSlots.length}/${sessionsNeeded} sessions placed. ${sessionsNeeded - newSlots.length} need manual scheduling.`,
    changes,
    placed: newSlots.length,
    total: sessionsNeeded,
    log,
  };
}

// ═══════════════════════════════════════════════════════════
// 4. AUTO-FIX ALL — Scan + fix all conflicts in one pass
// ═══════════════════════════════════════════════════════════
async function autoFixAll(department) {
  const log = [{ t: Date.now(), msg: '🤖 Auto-fix all conflicts starting...' }];

  // Detect all current conflicts
  const detection = await detectConflicts(department);
  log.push({ t: Date.now(), msg: `📊 Found ${detection.conflicts.length} conflicts` });

  if (detection.conflicts.length === 0) {
    log.push({ t: Date.now(), msg: '✅ No conflicts to fix!' });
    return { success: true, message: '✅ Timetable is conflict-free!', fixed: 0, total: 0, log, changes: [] };
  }

  // Collect all affected slot IDs
  const allAffected = [...new Set(detection.conflicts.flatMap(c => c.affectedSlots))];
  log.push({ t: Date.now(), msg: `🔧 ${allAffected.length} unique slots to fix` });

  // Run smart rescheduler on all affected
  const rescheduleResult = await smartReschedule(allAffected);
  log.push(...rescheduleResult.log);

  // Re-run detection to confirm
  const postFix = await detectConflicts(department);
  log.push({ t: Date.now(), msg: `📊 Post-fix: ${postFix.conflicts.length} conflicts remaining` });

  return {
    success: postFix.conflicts.length === 0,
    message: postFix.conflicts.length === 0
      ? `✅ All conflicts resolved! Fixed ${rescheduleResult.fixed} slots.`
      : `⚠️ Fixed ${rescheduleResult.fixed} slots, ${postFix.conflicts.length} conflicts remain.`,
    fixed: rescheduleResult.fixed,
    total: allAffected.length,
    remainingConflicts: postFix.conflicts.length,
    changes: rescheduleResult.changes,
    log,
  };
}

// ═══════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════
module.exports = {
  detectConflicts,
  smartReschedule,
  onLeaveApproved,
  onRoomDeactivated,
  onNewSubjectAssigned,
  autoFixAll,
};
