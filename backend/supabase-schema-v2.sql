-- =============================================
-- ChronoSync v2 — Additional tables
-- Run this AFTER the original supabase-schema.sql
-- =============================================

-- Subjects table
CREATE TABLE IF NOT EXISTS subjects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  department TEXT NOT NULL,
  credits INTEGER DEFAULT 3,
  semester TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Faculty-Subject assignments
CREATE TABLE IF NOT EXISTS faculty_subjects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  faculty_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(faculty_id, subject_id)
);

-- Timetable slots
CREATE TABLE IF NOT EXISTS timetable_slots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  faculty_id UUID REFERENCES users(id) ON DELETE SET NULL,
  department TEXT NOT NULL,
  year TEXT,
  day TEXT NOT NULL CHECK (day IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday')),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room TEXT,
  slot_type TEXT DEFAULT 'lecture' CHECK (slot_type IN ('lecture','lab','tutorial','seminar')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Faculty availability
CREATE TABLE IF NOT EXISTS faculty_availability (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  faculty_id UUID REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL CHECK (day IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday')),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT true,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(faculty_id, day, start_time)
);

-- Leave requests
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  faculty_id UUID REFERENCES users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Booking slots (student meetings/counseling)
CREATE TABLE IF NOT EXISTS booking_slots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES users(id) ON DELETE CASCADE,
  faculty_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('counseling','meeting','doubt_clearing','project_review','other')),
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','completed','cancelled')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Disable RLS for development (enable in production)
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_slots ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access" ON subjects FOR ALL USING (true);
CREATE POLICY "Service role full access" ON faculty_subjects FOR ALL USING (true);
CREATE POLICY "Service role full access" ON timetable_slots FOR ALL USING (true);
CREATE POLICY "Service role full access" ON faculty_availability FOR ALL USING (true);
CREATE POLICY "Service role full access" ON leave_requests FOR ALL USING (true);
CREATE POLICY "Service role full access" ON booking_slots FOR ALL USING (true);
