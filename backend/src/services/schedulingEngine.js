/**
 * ═══════════════════════════════════════════════════════════════
 *  ChronoSync AI Scheduling Engine
 *  Hybrid Genetic Algorithm (GA) + Constraint Satisfaction (CSP)
 * ═══════════════════════════════════════════════════════════════
 *
 *  Algorithm Overview:
 *  ┌────────────────────────────────────────────┐
 *  │ 1. Load inputs (faculty, subjects, rooms)  │
 *  │ 2. Build CSP constraint graph              │
 *  │ 3. Generate initial population (random)    │
 *  │ 4. Evaluate fitness for each chromosome    │
 *  │ 5. Selection (tournament)                  │
 *  │ 6. Crossover (uniform)                     │
 *  │ 7. Mutation (swap / reassign)              │
 *  │ 8. CSP repair pass (fix hard violations)   │
 *  │ 9. Repeat 4-8 until convergence            │
 *  │ 10. Return best chromosome as timetable    │
 *  └────────────────────────────────────────────┘
 */

const supabase = require('../config/supabase');

// ═══════════════════════════════════════════
// CONFIGURATION DEFAULTS
// ═══════════════════════════════════════════
const DEFAULT_CONFIG = {
  populationSize: 80,
  maxGenerations: 500,
  eliteCount: 4,
  crossoverRate: 0.85,
  mutationRate: 0.15,
  tournamentSize: 5,
  convergenceThreshold: 30, // stop if no improvement for N generations
  creditBasedClassCount: true,
  defaultSessionsPerSubject: 3,
  // Fitness weights
  weights: {
    hardConflict: -100,       // faculty teaches >1 class at same time
    roomConflict: -100,       // room double-booked
    studentConflict: -80,     // same dept+year has 2 classes at same time
    availabilityViolation: -60, // faculty unavailable at assigned slot
    maxHoursViolation: -30,   // faculty exceeds max hours/day
    consecutiveViolation: -20, // too many consecutive classes
    workloadBalance: 10,      // reward balanced workload across faculty
    roomEfficiency: 5,        // reward good room-type matching
    preferredSlot: 8,         // reward using preferred time slots
    gapPenalty: -5,           // penalize gaps in student schedules
  },
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function normalizeSemester(value) {
  return String(value || 'Unassigned').trim() || 'Unassigned';
}

function semesterNumber(value) {
  const match = String(value || '').match(/\d+/);
  return match ? Number(match[0]) : null;
}

function yearLabelFromSemester(value) {
  const sem = semesterNumber(value);
  if (!sem) return null;
  const year = Math.ceil(sem / 2);
  const suffix = year === 1 ? 'st' : year === 2 ? 'nd' : year === 3 ? 'rd' : 'th';
  return `${year}${suffix} Year`;
}

// ═══════════════════════════════════════════
// DATA LOADER — Fetch all inputs from Supabase
// ═══════════════════════════════════════════
async function loadSchedulingData(department, year) {
  const log = [];
  log.push({ t: Date.now(), msg: '📥 Loading scheduling data...' });

  // Faculty for this department
  const { data: facultyRaw } = await supabase
    .from('users')
    .select('id, user_id, full_name, department, subjects')
    .eq('role', 'faculty')
    .eq('is_active', true)
    .eq('department', department);
  const faculty = facultyRaw || [];

  // Faculty-subject assignments
  const facultyIds = faculty.map(f => f.id);
  const { data: assignmentsRaw } = await supabase
    .from('faculty_subjects')
    .select('faculty_id, subject_id, subject:subjects(*)')
    .in('faculty_id', facultyIds.length ? facultyIds : ['_none_']);
  const assignments = assignmentsRaw || [];

  // Subjects for this department
  const { data: subjectsRaw } = await supabase
    .from('subjects')
    .select('*')
    .eq('department', department);
  const subjects = (subjectsRaw || []).filter((subject) => {
    if (!year) return true;
    return yearLabelFromSemester(subject.semester) === year;
  });

  // Classrooms
  const { data: roomsRaw } = await supabase
    .from('classrooms')
    .select('*')
    .eq('is_active', true)
    .order('capacity', { ascending: false });
  const rooms = roomsRaw || [];

  // Time slots
  const { data: slotsRaw } = await supabase
    .from('time_slot_templates')
    .select('*')
    .eq('is_break', false)
    .order('slot_number');
  const timeSlots = slotsRaw || [];

  // Faculty availability
  const { data: availRaw } = await supabase
    .from('faculty_availability')
    .select('*')
    .in('faculty_id', facultyIds.length ? facultyIds : ['_none_']);
  const availability = availRaw || [];

  // Constraints
  const { data: constraintsRaw } = await supabase
    .from('scheduling_constraints')
    .select('*')
    .or(`target_type.eq.global,target_type.eq.department`);
  const constraints = constraintsRaw || [];

  log.push({
    t: Date.now(),
    msg: `📊 Loaded: ${faculty.length} faculty, ${subjects.length} subjects, ${rooms.length} rooms, ${timeSlots.length} slots`,
  });

  return { faculty, subjects, assignments, rooms, timeSlots, availability, constraints, log };
}

// ═══════════════════════════════════════════
// GENE REPRESENTATION
// Each gene = one class assignment:
// { subjectId, facultyId, day, slotIdx, roomId }
// A chromosome = array of genes (complete timetable)
// ═══════════════════════════════════════════

// Build the list of classes that need to be scheduled
function normalizeToken(value) {
  return String(value || '').trim().toLowerCase();
}

function getFacultyPoolForSubject(subject, assignments, faculty) {
  const assignedIds = assignments
    .filter(a => a.subject_id === subject.id)
    .map(a => a.faculty_id)
    .filter(Boolean);

  if (assignedIds.length > 0) {
    return assignedIds;
  }

  const subjectName = normalizeToken(subject.name);
  const subjectCode = normalizeToken(subject.code);
  const legacyMatches = faculty
    .filter((member) => (member.subjects || []).some((entry) => {
      const token = normalizeToken(entry);
      return token === subjectName || token === subjectCode;
    }))
    .map((member) => member.id);

  if (legacyMatches.length > 0) {
    return legacyMatches;
  }

  return faculty.map((member) => member.id);
}

function getSessionsPerWeek(subject, config) {
  if (!config.creditBasedClassCount) {
    return Math.max(1, Number(config.defaultSessionsPerSubject) || 3);
  }

  const credits = Number(subject.credits);
  return Math.max(1, Number.isFinite(credits) ? Math.round(credits) : Number(config.defaultSessionsPerSubject) || 3);
}

function buildClassList(subjects, assignments, faculty = [], config = DEFAULT_CONFIG) {
  const classes = [];
  for (const subject of subjects) {
    const sessionsPerWeek = getSessionsPerWeek(subject, config);
    const facultyPool = getFacultyPoolForSubject(subject, assignments, faculty);

    for (let i = 0; i < sessionsPerWeek; i++) {
      const facultyId = facultyPool.length > 0 ? facultyPool[i % facultyPool.length] : null;
      classes.push({
        classId: `${subject.id}_${i}`,
        subjectId: subject.id,
        subjectName: subject.name,
        subjectCode: subject.code,
        facultyId,
        department: subject.department,
        semester: normalizeSemester(subject.semester),
        academicYear: yearLabelFromSemester(subject.semester),
      });
    }
  }
  return classes;
}

// ═══════════════════════════════════════════
// CHROMOSOME — Random initialization
// ═══════════════════════════════════════════
function createRandomChromosome(classes, timeSlots, rooms, days) {
  return classes.map(cls => ({
    ...cls,
    day: days[Math.floor(Math.random() * days.length)],
    slotIdx: Math.floor(Math.random() * timeSlots.length),
    roomId: rooms.length > 0 ? rooms[Math.floor(Math.random() * rooms.length)].id : null,
  }));
}

function createPopulation(size, classes, timeSlots, rooms, days) {
  const pop = [];
  for (let i = 0; i < size; i++) {
    pop.push(createRandomChromosome(classes, timeSlots, rooms, days));
  }
  return pop;
}

// ═══════════════════════════════════════════
// FITNESS EVALUATION
// ═══════════════════════════════════════════
function evaluateFitness(chromosome, timeSlots, rooms, availability, config) {
  const w = config.weights;
  let score = 0;
  let hardConflicts = 0;

  // Index genes by (day, slotIdx) for fast lookup
  const daySlotMap = {};
  for (const gene of chromosome) {
    const key = `${gene.day}_${gene.slotIdx}`;
    if (!daySlotMap[key]) daySlotMap[key] = [];
    daySlotMap[key].push(gene);
  }

  // ── Hard Constraint: Faculty conflict ──
  // Faculty cannot teach two classes at the same time
  for (const genes of Object.values(daySlotMap)) {
    const facultySeen = {};
    for (const g of genes) {
      if (!g.facultyId) continue;
      if (facultySeen[g.facultyId]) {
        score += w.hardConflict;
        hardConflicts++;
      }
      facultySeen[g.facultyId] = true;
    }
  }

  // ── Hard Constraint: Room conflict ──
  // Same room cannot be used by two classes at the same time
  for (const genes of Object.values(daySlotMap)) {
    const roomSeen = {};
    for (const g of genes) {
      if (!g.roomId) continue;
      if (roomSeen[g.roomId]) {
        score += w.roomConflict;
        hardConflicts++;
      }
      roomSeen[g.roomId] = true;
    }
  }

  // ── Hard Constraint: Student group conflict ──
  // Same department + semester students can't have 2 classes at once.
  for (const genes of Object.values(daySlotMap)) {
    const groupSeen = {};
    for (const g of genes) {
      const groupKey = `${g.department}_${g.semester || 'Unassigned'}`;
      if (groupSeen[groupKey]) {
        score += w.studentConflict;
        hardConflicts++;
      }
      groupSeen[groupKey] = true;
    }
  }

  // ── Soft Constraint: Faculty availability ──
  const availMap = {};
  for (const a of availability) {
    const aKey = `${a.faculty_id}_${a.day}`;
    if (!availMap[aKey]) availMap[aKey] = [];
    availMap[aKey].push(a);
  }

  for (const gene of chromosome) {
    if (!gene.facultyId) continue;
    const aKey = `${gene.facultyId}_${gene.day}`;
    const slots = availMap[aKey] || [];
    for (const a of slots) {
      if (!a.is_available) {
        // Check time overlap
        const geneSlot = timeSlots[gene.slotIdx];
        if (geneSlot && a.start_time <= geneSlot.end_time && a.end_time >= geneSlot.start_time) {
          score += w.availabilityViolation;
        }
      }
    }
  }

  // ── Soft Constraint: Max hours per day per faculty ──
  const facultyDayCount = {};
  for (const gene of chromosome) {
    if (!gene.facultyId) continue;
    const key = `${gene.facultyId}_${gene.day}`;
    facultyDayCount[key] = (facultyDayCount[key] || 0) + 1;
  }
  for (const count of Object.values(facultyDayCount)) {
    if (count > 5) score += w.maxHoursViolation * (count - 5);
  }

  // ── Soft Constraint: Consecutive classes ──
  const facultyDaySlots = {};
  for (const gene of chromosome) {
    if (!gene.facultyId) continue;
    const key = `${gene.facultyId}_${gene.day}`;
    if (!facultyDaySlots[key]) facultyDaySlots[key] = [];
    facultyDaySlots[key].push(gene.slotIdx);
  }
  for (const slots of Object.values(facultyDaySlots)) {
    slots.sort((a, b) => a - b);
    let consec = 1;
    for (let i = 1; i < slots.length; i++) {
      if (slots[i] === slots[i - 1] + 1) {
        consec++;
        if (consec > 3) score += w.consecutiveViolation;
      } else {
        consec = 1;
      }
    }
  }

  // ── Reward: Workload balance ──
  const totalPerFaculty = {};
  for (const gene of chromosome) {
    if (!gene.facultyId) continue;
    totalPerFaculty[gene.facultyId] = (totalPerFaculty[gene.facultyId] || 0) + 1;
  }
  const counts = Object.values(totalPerFaculty);
  if (counts.length > 1) {
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((s, c) => s + (c - avg) ** 2, 0) / counts.length;
    // Lower variance = better balance = higher score
    score += w.workloadBalance * Math.max(0, 10 - variance);
  }

  // ── Reward: Room type matching ──
  const roomMap = {};
  for (const r of rooms) roomMap[r.id] = r;
  for (const gene of chromosome) {
    if (!gene.roomId) continue;
    const room = roomMap[gene.roomId];
    if (room && room.room_type === 'lecture') {
      score += w.roomEfficiency;
    }
  }

  // ── Penalty: Gaps in student schedule ──
  const groupDaySlots = {};
  for (const gene of chromosome) {
    const key = `${gene.department}_${gene.semester || 'Unassigned'}_${gene.day}`;
    if (!groupDaySlots[key]) groupDaySlots[key] = [];
    groupDaySlots[key].push(gene.slotIdx);
  }
  for (const slots of Object.values(groupDaySlots)) {
    if (slots.length < 2) continue;
    slots.sort((a, b) => a - b);
    for (let i = 1; i < slots.length; i++) {
      const gap = slots[i] - slots[i - 1] - 1;
      if (gap > 0) score += w.gapPenalty * gap;
    }
  }

  return { score, hardConflicts };
}

// ═══════════════════════════════════════════
// SELECTION — Tournament
// ═══════════════════════════════════════════
function tournamentSelect(population, fitnesses, tournamentSize) {
  let bestIdx = -1;
  let bestFit = -Infinity;
  for (let i = 0; i < tournamentSize; i++) {
    const idx = Math.floor(Math.random() * population.length);
    if (fitnesses[idx].score > bestFit) {
      bestFit = fitnesses[idx].score;
      bestIdx = idx;
    }
  }
  return population[bestIdx];
}

// ═══════════════════════════════════════════
// CROSSOVER — Uniform crossover
// ═══════════════════════════════════════════
function crossover(parent1, parent2, rate) {
  if (Math.random() > rate) return [cloneChromosome(parent1), cloneChromosome(parent2)];

  const child1 = [];
  const child2 = [];
  for (let i = 0; i < parent1.length; i++) {
    if (Math.random() < 0.5) {
      child1.push({ ...parent1[i] });
      child2.push({ ...parent2[i] });
    } else {
      child1.push({ ...parent2[i] });
      child2.push({ ...parent1[i] });
    }
  }
  return [child1, child2];
}

// ═══════════════════════════════════════════
// MUTATION — Swap, reassign day/slot/room
// ═══════════════════════════════════════════
function mutate(chromosome, timeSlots, rooms, days, rate) {
  for (let i = 0; i < chromosome.length; i++) {
    if (Math.random() < rate) {
      const mutationType = Math.random();
      if (mutationType < 0.33) {
        // Swap with another gene
        const j = Math.floor(Math.random() * chromosome.length);
        const tmpDay = chromosome[i].day;
        const tmpSlot = chromosome[i].slotIdx;
        const tmpRoom = chromosome[i].roomId;
        chromosome[i].day = chromosome[j].day;
        chromosome[i].slotIdx = chromosome[j].slotIdx;
        chromosome[i].roomId = chromosome[j].roomId;
        chromosome[j].day = tmpDay;
        chromosome[j].slotIdx = tmpSlot;
        chromosome[j].roomId = tmpRoom;
      } else if (mutationType < 0.66) {
        // Reassign day + slot
        chromosome[i].day = days[Math.floor(Math.random() * days.length)];
        chromosome[i].slotIdx = Math.floor(Math.random() * timeSlots.length);
      } else {
        // Reassign room
        if (rooms.length > 0) {
          chromosome[i].roomId = rooms[Math.floor(Math.random() * rooms.length)].id;
        }
      }
    }
  }
  return chromosome;
}

// ═══════════════════════════════════════════
// CSP REPAIR — Fix hard constraint violations
// ═══════════════════════════════════════════
function cspRepair(chromosome, timeSlots, rooms, days) {
  const maxAttempts = 50;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let repaired = true;

    // Build conflict map
    const daySlotMap = {};
    for (let i = 0; i < chromosome.length; i++) {
      const key = `${chromosome[i].day}_${chromosome[i].slotIdx}`;
      if (!daySlotMap[key]) daySlotMap[key] = [];
      daySlotMap[key].push(i);
    }

    for (const [, indices] of Object.entries(daySlotMap)) {
      // Check faculty conflicts
      const facultySeen = {};
      for (const idx of indices) {
        const g = chromosome[idx];
        if (!g.facultyId) continue;
        if (facultySeen[g.facultyId]) {
          // Move this gene to a random different slot
          chromosome[idx].day = days[Math.floor(Math.random() * days.length)];
          chromosome[idx].slotIdx = Math.floor(Math.random() * timeSlots.length);
          repaired = false;
        }
        facultySeen[g.facultyId] = true;
      }

      // Check room conflicts
      const roomSeen = {};
      for (const idx of indices) {
        const g = chromosome[idx];
        if (!g.roomId) continue;
        if (roomSeen[g.roomId]) {
          if (rooms.length > 0) {
            chromosome[idx].roomId = rooms[Math.floor(Math.random() * rooms.length)].id;
          }
          repaired = false;
        }
        roomSeen[g.roomId] = true;
      }

      // Check student-group conflicts
      const groupSeen = {};
      for (const idx of indices) {
        const g = chromosome[idx];
        const groupKey = `${g.department}_${g.semester || 'Unassigned'}`;
        if (groupSeen[groupKey]) {
          chromosome[idx].day = days[Math.floor(Math.random() * days.length)];
          chromosome[idx].slotIdx = Math.floor(Math.random() * timeSlots.length);
          repaired = false;
        }
        groupSeen[groupKey] = true;
      }
    }

    if (repaired) break;
  }

  return chromosome;
}

// ═══════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════
function cloneChromosome(c) {
  return c.map(g => ({ ...g }));
}

// ═══════════════════════════════════════════
// MAIN GA LOOP
// ═══════════════════════════════════════════
async function runGeneticAlgorithm(data, config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config, weights: { ...DEFAULT_CONFIG.weights, ...(config.weights || {}) } };
  const { faculty, subjects, assignments, rooms, timeSlots, availability } = data;
  const log = [...data.log];

  // 1. Build class list
  const classes = buildClassList(subjects, assignments, faculty, cfg);
  if (classes.length === 0) {
    return { success: false, message: 'No classes to schedule. Ensure subjects exist and are assigned to faculty.', log };
  }

  const unassignedClasses = classes.filter((cls) => !cls.facultyId).length;
  if (unassignedClasses > 0) {
    log.push({ t: Date.now(), msg: `⚠️ ${unassignedClasses} classes have no available faculty assignment.` });
  }

  log.push({
    t: Date.now(),
    msg: `🧬 Starting GA: ${classes.length} classes, pop=${cfg.populationSize}, maxGen=${cfg.maxGenerations}, creditRule=${cfg.creditBasedClassCount ? 'on' : 'off'}`,
  });

  // 2. Generate initial population
  let population = createPopulation(cfg.populationSize, classes, timeSlots, rooms, DAYS);

  // Apply CSP repair to initial population
  population = population.map(c => cspRepair(c, timeSlots, rooms, DAYS));

  let bestScore = -Infinity;
  let bestChromosome = null;
  let bestConflicts = Infinity;
  let noImprovementCount = 0;
  let generation = 0;

  // 3. Evolution loop
  for (generation = 0; generation < cfg.maxGenerations; generation++) {
    // Evaluate fitness
    const fitnesses = population.map(c => evaluateFitness(c, timeSlots, rooms, availability, cfg));

    // Track best
    for (let i = 0; i < fitnesses.length; i++) {
      if (fitnesses[i].score > bestScore) {
        bestScore = fitnesses[i].score;
        bestChromosome = cloneChromosome(population[i]);
        bestConflicts = fitnesses[i].hardConflicts;
        noImprovementCount = 0;
      }
    }

    // Log progress every 50 generations
    if (generation % 50 === 0 || generation === cfg.maxGenerations - 1) {
      log.push({
        t: Date.now(),
        msg: `🔄 Gen ${generation}: best=${bestScore.toFixed(1)}, conflicts=${bestConflicts}`,
      });
    }

    // Early termination: perfect solution found
    if (bestConflicts === 0 && bestScore > 0) {
      log.push({ t: Date.now(), msg: `🎯 Perfect solution at generation ${generation}!` });
      break;
    }

    // Convergence check
    noImprovementCount++;
    if (noImprovementCount >= cfg.convergenceThreshold) {
      log.push({ t: Date.now(), msg: `📉 Converged at gen ${generation} (no improvement for ${cfg.convergenceThreshold} gens)` });
      break;
    }

    // ── Breed next generation ──
    // Sort by fitness (descending)
    const sorted = population
      .map((c, i) => ({ c, f: fitnesses[i] }))
      .sort((a, b) => b.f.score - a.f.score);

    const nextPop = [];

    // Elitism: keep top N
    for (let i = 0; i < cfg.eliteCount && i < sorted.length; i++) {
      nextPop.push(cloneChromosome(sorted[i].c));
    }

    // Fill rest with offspring
    while (nextPop.length < cfg.populationSize) {
      const p1 = tournamentSelect(population, fitnesses, cfg.tournamentSize);
      const p2 = tournamentSelect(population, fitnesses, cfg.tournamentSize);
      let [c1, c2] = crossover(p1, p2, cfg.crossoverRate);
      c1 = mutate(c1, timeSlots, rooms, DAYS, cfg.mutationRate);
      c2 = mutate(c2, timeSlots, rooms, DAYS, cfg.mutationRate);

      // CSP repair after mutation
      c1 = cspRepair(c1, timeSlots, rooms, DAYS);
      c2 = cspRepair(c2, timeSlots, rooms, DAYS);

      nextPop.push(c1);
      if (nextPop.length < cfg.populationSize) nextPop.push(c2);
    }

    population = nextPop;
  }

  log.push({
    t: Date.now(),
    msg: `✅ GA complete: ${generation + 1} generations, fitness=${bestScore.toFixed(1)}, conflicts=${bestConflicts}`,
  });

  return {
    success: true,
    bestChromosome,
    bestScore,
    bestConflicts,
    generationsRun: generation + 1,
    totalSlots: classes.length,
    log,
  };
}

// ═══════════════════════════════════════════
// CONVERT CHROMOSOME → TIMETABLE SLOTS
// ═══════════════════════════════════════════
function chromosomeToSlots(chromosome, timeSlots, department, year, faculty = [], rooms = []) {
  const facultyMap = Object.fromEntries(faculty.map((member) => [member.id, member.full_name]));
  const roomMap = Object.fromEntries(rooms.map((room) => [room.id, room.name]));
  return chromosome.map(gene => {
    const slot = timeSlots[gene.slotIdx];
    return {
      subject_id: gene.subjectId,
      subject_name: gene.subjectName,
      subject_code: gene.subjectCode,
      semester: normalizeSemester(gene.semester),
      faculty_id: gene.facultyId,
      faculty_name: gene.facultyId ? (facultyMap[gene.facultyId] || null) : null,
      department,
      year: year || gene.academicYear || null,
      day: gene.day,
      start_time: slot ? slot.start_time : '09:00',
      end_time: slot ? slot.end_time : '10:00',
      room: gene.roomId,
      room_name: gene.roomId ? (roomMap[gene.roomId] || null) : null,
      slot_type: 'lecture',
    };
  });
}

function cleanCandidateSlots(slots) {
  return slots.map((slot) => ({
    ...slot,
    room: typeof slot.room === 'string' && slot.room.startsWith('virtual') ? null : slot.room,
  }));
}

function summarizeCandidate(slots) {
  const dayCounts = {};
  const roomSet = new Set();
  const sectionCounts = {};
  for (const slot of slots) {
    dayCounts[slot.day] = (dayCounts[slot.day] || 0) + 1;
    if (slot.room) roomSet.add(slot.room);
    const sectionKey = `${slot.year || 'All Years'}|${slot.semester || 'Unassigned'}`;
    sectionCounts[sectionKey] = (sectionCounts[sectionKey] || 0) + 1;
  }

  return {
    slotsPerDay: DAYS.map((day) => ({ day, count: dayCounts[day] || 0 })),
    sections: Object.entries(sectionCounts).map(([key, count]) => {
      const [year, semester] = key.split('|');
      return { year, semester, count };
    }),
    roomsUsed: roomSet.size,
  };
}

async function persistFixedTimetable(department, year, slots) {
  const dbSlots = slots.map((slot) => ({
    subject_id: slot.subject_id,
    faculty_id: slot.faculty_id,
    department: slot.department,
    year: slot.year,
    day: slot.day,
    start_time: slot.start_time,
    end_time: slot.end_time,
    room: slot.room,
    slot_type: slot.slot_type || 'lecture',
  }));

  let deleteQuery = supabase.from('timetable_slots').delete().eq('department', department);
  if (year) deleteQuery = deleteQuery.eq('year', year);
  await deleteQuery;

  const { error: insertErr } = await supabase
    .from('timetable_slots')
    .insert(dbSlots);

  if (insertErr) throw insertErr;
}

// ═══════════════════════════════════════════
// PUBLIC API: Generate timetable
// ═══════════════════════════════════════════
async function generateTimetable(department, year, config = {}) {
  // Create a generation record
  const { data: genRecord, error: genErr } = await supabase
    .from('timetable_generations')
    .insert({
      department,
      year,
      status: 'running',
      config,
    })
    .select()
    .single();

  const genId = genRecord?.id;

  try {
    // 1. Load data
    const data = await loadSchedulingData(department, year);

    // Validate inputs
    if (data.faculty.length === 0) throw new Error('No active faculty found for this department.');
    if (data.subjects.length === 0) throw new Error('No subjects found for this department.');
    if (data.timeSlots.length === 0) throw new Error('No time slots defined. Please add time slot templates.');

    // If no rooms exist, create virtual default
    if (data.rooms.length === 0) {
      data.rooms = [
        { id: 'virtual_1', name: 'Room A', room_type: 'lecture', capacity: 60 },
        { id: 'virtual_2', name: 'Room B', room_type: 'lecture', capacity: 60 },
        { id: 'virtual_3', name: 'Lab 1', room_type: 'lab', capacity: 40 },
      ];
      data.log.push({ t: Date.now(), msg: '⚠️ No classrooms in DB — using virtual rooms' });
    }

    // 2. Run GA three times to produce 3 candidate timetables
    const candidateRuns = [];
    const aggregateLog = [...data.log];
    for (let i = 0; i < 3; i++) {
      aggregateLog.push({ t: Date.now(), msg: `🧪 Generating candidate ${i + 1} of 3...` });
      const runResult = await runGeneticAlgorithm(data, config);
      if (!runResult.success) {
        if (genId) {
          await supabase.from('timetable_generations').update({
            status: 'failed', log: runResult.log, completed_at: new Date().toISOString(),
          }).eq('id', genId);
        }
        return runResult;
      }

      const candidateSlots = cleanCandidateSlots(
        chromosomeToSlots(runResult.bestChromosome, data.timeSlots, department, year, data.faculty, data.rooms)
      );
      candidateRuns.push({
        id: `candidate_${i + 1}`,
        name: `Option ${String.fromCharCode(65 + i)}`,
        fitness: runResult.bestScore,
        conflicts: runResult.bestConflicts,
        generationsRun: runResult.generationsRun,
        totalSlots: runResult.totalSlots,
        slots: candidateSlots,
        summary: summarizeCandidate(candidateSlots),
        log: runResult.log,
      });
      aggregateLog.push(...runResult.log);
    }

    const candidates = candidateRuns
      .sort((a, b) => {
        if (a.conflicts !== b.conflicts) return a.conflicts - b.conflicts;
        return b.fitness - a.fitness;
      })
      .map((candidate, index) => ({
        ...candidate,
        id: `candidate_${index + 1}`,
        name: `Option ${String.fromCharCode(65 + index)}`,
      }));

    const bestCandidate = candidates[0];

    if (!bestCandidate) {
      if (genId) {
        await supabase.from('timetable_generations').update({
          status: 'failed', log: aggregateLog, completed_at: new Date().toISOString(),
        }).eq('id', genId);
      }
      return { success: false, message: 'Failed to generate timetable candidates.', log: aggregateLog };
    }

    aggregateLog.push({ t: Date.now(), msg: '🗂️ Generated 3 timetable candidates. Waiting for admin selection.' });

    // 3. Update generation record with candidates, but do not fix any timetable yet
    if (genId) {
      await supabase.from('timetable_generations').update({
        status: 'completed',
        fitness_score: bestCandidate.fitness,
        generations_run: bestCandidate.generationsRun,
        conflicts_remaining: bestCandidate.conflicts,
        total_slots_placed: bestCandidate.totalSlots,
        config: {
          requestConfig: config,
          candidates,
          finalizedCandidateId: null,
          finalizedAt: null,
        },
        log: aggregateLog,
        completed_at: new Date().toISOString(),
      }).eq('id', genId);
    }

    return {
      success: true,
      generationId: genId,
      fitness: bestCandidate.fitness,
      conflicts: bestCandidate.conflicts,
      generationsRun: bestCandidate.generationsRun,
      totalSlots: bestCandidate.totalSlots,
      candidates,
      message: `Generated 3 timetable options. Review them and fix the best one into the database.`,
      log: aggregateLog,
    };
  } catch (err) {
    const errorLog = [{ t: Date.now(), msg: `❌ Error: ${err.message}` }];
    if (genId) {
      await supabase.from('timetable_generations').update({
        status: 'failed', log: errorLog, completed_at: new Date().toISOString(),
      }).eq('id', genId);
    }
    throw err;
  }
}

async function finalizeTimetableCandidate(generationId, candidateId) {
  const { data: generation, error } = await supabase
    .from('timetable_generations')
    .select('*')
    .eq('id', generationId)
    .single();

  if (error || !generation) {
    throw new Error('Generation run not found.');
  }

  const candidates = generation.config?.candidates || [];
  const candidate = candidates.find((item) => item.id === candidateId);
  if (!candidate) {
    throw new Error('Selected timetable candidate was not found.');
  }

  await persistFixedTimetable(generation.department, generation.year, candidate.slots || []);

  const nextConfig = {
    ...(generation.config || {}),
    finalizedCandidateId: candidateId,
    finalizedAt: new Date().toISOString(),
  };
  const nextLog = [
    ...(generation.log || []),
    { t: Date.now(), msg: `💾 Fixed ${candidate.name || candidateId} into the live timetable database.` },
  ];

  await supabase
    .from('timetable_generations')
    .update({
      config: nextConfig,
      log: nextLog,
      fitness_score: candidate.fitness,
      conflicts_remaining: candidate.conflicts,
      total_slots_placed: candidate.totalSlots,
      completed_at: new Date().toISOString(),
    })
    .eq('id', generationId);

  return {
    success: true,
    generationId,
    candidateId,
    candidate,
    message: `${candidate.name || 'Selected timetable'} has been fixed into the database.`,
    log: nextLog,
  };
}

// ═══════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════
module.exports = {
  generateTimetable,
  finalizeTimetableCandidate,
  loadSchedulingData,
  evaluateFitness,
  DEFAULT_CONFIG,
};
