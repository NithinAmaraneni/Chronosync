-- =============================================
-- ChronoSync v3 — AI Scheduling tables
-- =============================================

-- Classrooms / Rooms
CREATE TABLE IF NOT EXISTS classrooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  building TEXT,
  floor INTEGER,
  capacity INTEGER DEFAULT 60,
  room_type TEXT DEFAULT 'lecture' CHECK (room_type IN ('lecture','lab','seminar','auditorium')),
  has_projector BOOLEAN DEFAULT true,
  has_ac BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Standard time slots template
CREATE TABLE IF NOT EXISTS time_slot_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slot_number INTEGER NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  slot_label TEXT,
  is_break BOOLEAN DEFAULT false,
  UNIQUE(slot_number)
);

-- Scheduling constraints
CREATE TABLE IF NOT EXISTS scheduling_constraints (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  constraint_type TEXT NOT NULL CHECK (constraint_type IN (
    'max_hours_per_day', 'max_consecutive', 'no_slot',
    'preferred_slot', 'room_preference', 'break_after'
  )),
  target_type TEXT CHECK (target_type IN ('faculty','department','global')),
  target_id UUID,
  day TEXT,
  slot_number INTEGER,
  value TEXT,
  priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Generated timetable runs (history)
CREATE TABLE IF NOT EXISTS timetable_generations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  department TEXT NOT NULL,
  year TEXT,
  status TEXT DEFAULT 'running' CHECK (status IN ('running','completed','failed')),
  config JSONB DEFAULT '{}',
  fitness_score NUMERIC,
  generations_run INTEGER,
  conflicts_remaining INTEGER DEFAULT 0,
  total_slots_placed INTEGER DEFAULT 0,
  log JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- RLS
ALTER TABLE classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_slot_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduling_constraints ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON classrooms FOR ALL USING (true);
CREATE POLICY "Service role full access" ON time_slot_templates FOR ALL USING (true);
CREATE POLICY "Service role full access" ON scheduling_constraints FOR ALL USING (true);
CREATE POLICY "Service role full access" ON timetable_generations FOR ALL USING (true);

-- Seed default time slots (Indian academic standard)
INSERT INTO time_slot_templates (slot_number, start_time, end_time, slot_label, is_break) VALUES
  (1, '09:00', '10:00', 'Period 1', false),
  (2, '10:00', '11:00', 'Period 2', false),
  (3, '11:00', '11:15', 'Break', true),
  (4, '11:15', '12:15', 'Period 3', false),
  (5, '12:15', '13:15', 'Period 4', false),
  (6, '13:15', '14:00', 'Lunch', true),
  (7, '14:00', '15:00', 'Period 5', false),
  (8, '15:00', '16:00', 'Period 6', false),
  (9, '16:00', '17:00', 'Period 7', false)
ON CONFLICT (slot_number) DO NOTHING;
