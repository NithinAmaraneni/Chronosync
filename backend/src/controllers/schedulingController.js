const supabase = require('../config/supabase');
const { generateTimetable, DEFAULT_CONFIG } = require('../services/schedulingEngine');
const {
  detectConflicts,
  smartReschedule,
  onLeaveApproved,
  onRoomDeactivated,
  onNewSubjectAssigned,
  autoFixAll,
} = require('../services/conflictService');


// ═══════════════════════════════════════════
// CLASSROOMS CRUD
// ═══════════════════════════════════════════
const getClassrooms = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('classrooms')
      .select('*')
      .order('building')
      .order('name');
    if (error) throw error;
    res.json({ success: true, classrooms: data || [] });
  } catch (err) {
    console.error('Get classrooms error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const createClassroom = async (req, res) => {
  try {
    const { name, building, floor, capacity, room_type, has_projector, has_ac } = req.body;
    const { data, error } = await supabase
      .from('classrooms')
      .insert({
        name,
        building: building || null,
        floor: floor || null,
        capacity: capacity || 60,
        room_type: room_type || 'lecture',
        has_projector: has_projector !== false,
        has_ac: has_ac || false,
      })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ success: true, classroom: data, message: 'Classroom added.' });
  } catch (err) {
    console.error('Create classroom error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateClassroom = async (req, res) => {
  try {
    const { name, building, floor, capacity, room_type, has_projector, has_ac, is_active } = req.body;
    const updates = {
      name,
      building: building || null,
      floor: floor || null,
      capacity: capacity || 60,
      room_type: room_type || 'lecture',
      has_projector: has_projector !== false,
      has_ac: has_ac || false,
    };
    if (typeof is_active === 'boolean') updates.is_active = is_active;

    const { data, error } = await supabase
      .from('classrooms')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, classroom: data, message: 'Classroom updated.' });
  } catch (err) {
    console.error('Update classroom error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteClassroom = async (req, res) => {
  try {
    const roomId = req.params.id;
    const { error } = await supabase
      .from('classrooms')
      .update({ is_active: false })
      .eq('id', roomId);
    if (error) throw error;

    // Auto-trigger room rescheduling (non-blocking)
    onRoomDeactivated(roomId)
      .then(r => console.log(`[Auto-Reschedule] Room deactivated → ${r.reassigned || 0} slots reassigned`))
      .catch(e => console.error('[Auto-Reschedule] Room hook error:', e.message));

    res.json({ success: true, message: 'Classroom deactivated. Affected slots are being reassigned.' });
  } catch (err) {
    console.error('Delete classroom error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════
// TIME SLOT TEMPLATES
// ═══════════════════════════════════════════
const getTimeSlots = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('time_slot_templates')
      .select('*')
      .order('slot_number');
    if (error) throw error;
    res.json({ success: true, timeSlots: data || [] });
  } catch (err) {
    console.error('Get time slots error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const upsertTimeSlot = async (req, res) => {
  try {
    const { slot_number, start_time, end_time, slot_label, is_break } = req.body;
    const { data, error } = await supabase
      .from('time_slot_templates')
      .upsert({
        slot_number,
        start_time,
        end_time,
        slot_label: slot_label || `Period ${slot_number}`,
        is_break: is_break || false,
      }, { onConflict: 'slot_number' })
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, timeSlot: data, message: 'Time slot saved.' });
  } catch (err) {
    console.error('Upsert time slot error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteTimeSlot = async (req, res) => {
  try {
    const { error } = await supabase
      .from('time_slot_templates')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true, message: 'Time slot deleted.' });
  } catch (err) {
    console.error('Delete time slot error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════
// SCHEDULING CONSTRAINTS
// ═══════════════════════════════════════════
const getConstraints = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('scheduling_constraints')
      .select('*')
      .order('priority', { ascending: false });
    if (error) throw error;
    res.json({ success: true, constraints: data || [] });
  } catch (err) {
    console.error('Get constraints error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const createConstraint = async (req, res) => {
  try {
    const { constraint_type, target_type, target_id, day, slot_number, value, priority } = req.body;
    const { data, error } = await supabase
      .from('scheduling_constraints')
      .insert({
        constraint_type,
        target_type: target_type || 'global',
        target_id: target_id || null,
        day: day || null,
        slot_number: slot_number || null,
        value: value || null,
        priority: priority || 5,
      })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ success: true, constraint: data, message: 'Constraint added.' });
  } catch (err) {
    console.error('Create constraint error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateConstraint = async (req, res) => {
  try {
    const { constraint_type, target_type, target_id, day, slot_number, value, priority } = req.body;
    const { data, error } = await supabase
      .from('scheduling_constraints')
      .update({
        constraint_type,
        target_type: target_type || 'global',
        target_id: target_id || null,
        day: day || null,
        slot_number: slot_number || null,
        value: value || null,
        priority: priority || 5,
      })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, constraint: data, message: 'Constraint updated.' });
  } catch (err) {
    console.error('Update constraint error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteConstraint = async (req, res) => {
  try {
    const { error } = await supabase
      .from('scheduling_constraints')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true, message: 'Constraint removed.' });
  } catch (err) {
    console.error('Delete constraint error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════
// AI TIMETABLE GENERATION
// ═══════════════════════════════════════════
const triggerGeneration = async (req, res) => {
  try {
    const { department, year, config } = req.body;
    if (!department) {
      return res.status(400).json({ success: false, message: 'Department is required.' });
    }

    // Run the GA (synchronous — typically completes in 1-5 seconds)
    const result = await generateTimetable(department, year || null, config || {});

    res.json({
      success: result.success,
      message: result.message,
      data: {
        generationId: result.generationId,
        fitness: result.fitness,
        conflicts: result.conflicts,
        generationsRun: result.generationsRun,
        totalSlots: result.totalSlots,
      },
      log: result.log,
    });
  } catch (err) {
    console.error('Generation error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════
// GENERATION HISTORY
// ═══════════════════════════════════════════
const getGenerationHistory = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('timetable_generations')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    res.json({ success: true, generations: data || [] });
  } catch (err) {
    console.error('Get generation history error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const getGenerationDetail = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('timetable_generations')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (error) throw error;
    res.json({ success: true, generation: data });
  } catch (err) {
    console.error('Get generation detail error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const getAlgorithmConfig = async (req, res) => {
  res.json({ success: true, config: DEFAULT_CONFIG });
};

// ═══════════════════════════════════════════
// CONFLICT DETECTION & RESCHEDULING
// ═══════════════════════════════════════════
const getConflicts = async (req, res) => {
  try {
    const { department } = req.query;
    const result = await detectConflicts(department || null);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Conflict detection error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const triggerAutoFix = async (req, res) => {
  try {
    const { department } = req.body;
    const result = await autoFixAll(department || null);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Auto-fix error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const triggerSmartReschedule = async (req, res) => {
  try {
    const { slotIds } = req.body;
    if (!slotIds || slotIds.length === 0) {
      return res.status(400).json({ success: false, message: 'slotIds array is required.' });
    }
    const result = await smartReschedule(slotIds);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Smart reschedule error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const triggerLeaveEvent = async (req, res) => {
  try {
    const { faculty_id, leave_start, leave_end } = req.body;
    if (!faculty_id) return res.status(400).json({ success: false, message: 'faculty_id required.' });
    const result = await onLeaveApproved(faculty_id, leave_start, leave_end);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Leave event error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const triggerRoomEvent = async (req, res) => {
  try {
    const { room_id } = req.body;
    if (!room_id) return res.status(400).json({ success: false, message: 'room_id required.' });
    const result = await onRoomDeactivated(room_id);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Room event error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const triggerSubjectEvent = async (req, res) => {
  try {
    const { faculty_id, subject_id } = req.body;
    if (!faculty_id || !subject_id) return res.status(400).json({ success: false, message: 'faculty_id and subject_id required.' });
    const result = await onNewSubjectAssigned(faculty_id, subject_id);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Subject event error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getClassrooms,
  createClassroom,
  updateClassroom,
  deleteClassroom,
  getTimeSlots,
  upsertTimeSlot,
  deleteTimeSlot,
  getConstraints,
  createConstraint,
  updateConstraint,
  deleteConstraint,
  triggerGeneration,
  getGenerationHistory,
  getGenerationDetail,
  getAlgorithmConfig,
  getConflicts,
  triggerAutoFix,
  triggerSmartReschedule,
  triggerLeaveEvent,
  triggerRoomEvent,
  triggerSubjectEvent,
};
