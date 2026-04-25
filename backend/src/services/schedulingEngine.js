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

// ═══════════════════════════════════════════
// DATA LOADER — Fetch all inputs from Supabase
// ═══════════════════════════════════════════
async function loadSchedulingData(department, year) {
  const log = [];
  log.push({ t: Date.now(), msg: '📥 Loading scheduling data...' });

  // Faculty for this department
  const { data: facultyRaw } = await supabase
    .from('users')
    .select('id, user_id, full_name, department')
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
  const subjects = subjectsRaw || [];

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
function buildClassList(subjects, assignments) {
  const classes = [];
  for (const subject of subjects) {
    // Each credit = 1 class per week
    const sessionsPerWeek = Math.min(subject.credits || 3, 6);
    // Find assigned faculty
    const assigned = assignments.filter(a => a.subject_id === subject.id);
    const facultyId = assigned.length > 0 ? assigned[0].faculty_id : null;

    for (let i = 0; i < sessionsPerWeek; i++) {
      classes.push({
        classId: `${subject.id}_${i}`,
        subjectId: subject.id,
        subjectName: subject.name,
        subjectCode: subject.code,
        facultyId,
        department: subject.department,
        semester: subject.semester,
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
  // Same department students can't have 2 classes at once
  for (const genes of Object.values(daySlotMap)) {
    const deptSeen = {};
    for (const g of genes) {
      const deptKey = g.department;
      if (deptSeen[deptKey]) {
        score += w.studentConflict;
        hardConflicts++;
      }
      deptSeen[deptKey] = true;
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
  const deptDaySlots = {};
  for (const gene of chromosome) {
    const key = `${gene.department}_${gene.day}`;
    if (!deptDaySlots[key]) deptDaySlots[key] = [];
    deptDaySlots[key].push(gene.slotIdx);
  }
  for (const slots of Object.values(deptDaySlots)) {
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

      // Check department conflicts
      const deptSeen = {};
      for (const idx of indices) {
        const g = chromosome[idx];
        if (deptSeen[g.department]) {
          chromosome[idx].day = days[Math.floor(Math.random() * days.length)];
          chromosome[idx].slotIdx = Math.floor(Math.random() * timeSlots.length);
          repaired = false;
        }
        deptSeen[g.department] = true;
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
  const classes = buildClassList(subjects, assignments);
  if (classes.length === 0) {
    return { success: false, message: 'No classes to schedule. Ensure subjects exist and are assigned to faculty.', log };
  }

  log.push({ t: Date.now(), msg: `🧬 Starting GA: ${classes.length} classes, pop=${cfg.populationSize}, maxGen=${cfg.maxGenerations}` });

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
function chromosomeToSlots(chromosome, timeSlots, department, year) {
  return chromosome.map(gene => {
    const slot = timeSlots[gene.slotIdx];
    return {
      subject_id: gene.subjectId,
      faculty_id: gene.facultyId,
      department,
      year: year || null,
      day: gene.day,
      start_time: slot ? slot.start_time : '09:00',
      end_time: slot ? slot.end_time : '10:00',
      room: gene.roomId,
      slot_type: 'lecture',
    };
  });
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

    // 2. Run GA
    const result = await runGeneticAlgorithm(data, config);

    if (!result.success) {
      if (genId) {
        await supabase.from('timetable_generations').update({
          status: 'failed', log: result.log, completed_at: new Date().toISOString(),
        }).eq('id', genId);
      }
      return result;
    }

    // 3. Convert to timetable slots
    const slots = chromosomeToSlots(result.bestChromosome, data.timeSlots, department, year);

    // 4. Clear existing timetable for this department+year
    let deleteQuery = supabase.from('timetable_slots').delete().eq('department', department);
    if (year) deleteQuery = deleteQuery.eq('year', year);
    await deleteQuery;

    // 5. Insert new slots (handle virtual room IDs)
    const cleanedSlots = slots.map(s => ({
      ...s,
      room: typeof s.room === 'string' && s.room.startsWith('virtual') ? null : s.room,
    }));

    const { error: insertErr } = await supabase
      .from('timetable_slots')
      .insert(cleanedSlots);

    if (insertErr) {
      result.log.push({ t: Date.now(), msg: `❌ DB insert error: ${insertErr.message}` });
    } else {
      result.log.push({ t: Date.now(), msg: `💾 Saved ${cleanedSlots.length} slots to database` });
    }

    // 6. Update generation record
    if (genId) {
      await supabase.from('timetable_generations').update({
        status: 'completed',
        fitness_score: result.bestScore,
        generations_run: result.generationsRun,
        conflicts_remaining: result.bestConflicts,
        total_slots_placed: result.totalSlots,
        log: result.log,
        completed_at: new Date().toISOString(),
      }).eq('id', genId);
    }

    return {
      success: true,
      generationId: genId,
      fitness: result.bestScore,
      conflicts: result.bestConflicts,
      generationsRun: result.generationsRun,
      totalSlots: result.totalSlots,
      message: result.bestConflicts === 0
        ? `✅ Conflict-free timetable generated! (${result.totalSlots} slots, ${result.generationsRun} GA generations)`
        : `⚠️ Timetable generated with ${result.bestConflicts} remaining conflicts. Manual review recommended.`,
      log: result.log,
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

// ═══════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════
module.exports = {
  generateTimetable,
  loadSchedulingData,
  evaluateFitness,
  DEFAULT_CONFIG,
};
