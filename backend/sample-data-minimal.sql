-- ChronoSync minimal sample data
-- Run this after supabase-schema.sql, supabase-schema-v2.sql,
-- supabase-schema-v3-scheduling.sql, and supabase-schema-chat.sql.
--
-- Login password for every sample user: Password@123

INSERT INTO users (
  id, user_id, email, full_name, password_hash, role, department,
  degree_course, year, phone, subjects, is_first_login, is_active, email_verified
) VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'ADM001',
    'admin@chronosync.test',
    'Admin User',
    '$2a$12$Kdbz7FKpwS270u6MIVacQuPVlM5IgQRIdzm9zm6ITB0ex4yyo3iR6',
    'admin',
    NULL,
    NULL,
    NULL,
    '9000000001',
    NULL,
    false,
    true,
    true
  ),
  (
    '00000000-0000-0000-0000-000000000101',
    'FAC001',
    'ananya.rao@chronosync.test',
    'Dr. Ananya Rao',
    '$2a$12$Kdbz7FKpwS270u6MIVacQuPVlM5IgQRIdzm9zm6ITB0ex4yyo3iR6',
    'faculty',
    'Computer Science',
    NULL,
    NULL,
    '9000000101',
    ARRAY['Programming Fundamentals','Data Structures'],
    false,
    true,
    true
  ),
  (
    '00000000-0000-0000-0000-000000000102',
    'FAC002',
    'ravi.menon@chronosync.test',
    'Prof. Ravi Menon',
    '$2a$12$Kdbz7FKpwS270u6MIVacQuPVlM5IgQRIdzm9zm6ITB0ex4yyo3iR6',
    'faculty',
    'Computer Science',
    NULL,
    NULL,
    '9000000102',
    ARRAY['Engineering Mathematics I','Digital Logic'],
    false,
    true,
    true
  ),
  (
    '00000000-0000-0000-0000-000000000201',
    'STU001',
    'isha.sharma@chronosync.test',
    'Isha Sharma',
    '$2a$12$Kdbz7FKpwS270u6MIVacQuPVlM5IgQRIdzm9zm6ITB0ex4yyo3iR6',
    'student',
    'Computer Science',
    'B.Tech CSE',
    '1st Year',
    '9000000201',
    NULL,
    false,
    true,
    true
  ),
  (
    '00000000-0000-0000-0000-000000000202',
    'STU002',
    'arjun.patel@chronosync.test',
    'Arjun Patel',
    '$2a$12$Kdbz7FKpwS270u6MIVacQuPVlM5IgQRIdzm9zm6ITB0ex4yyo3iR6',
    'student',
    'Computer Science',
    'B.Tech CSE',
    '1st Year',
    '9000000202',
    NULL,
    false,
    true,
    true
  )
ON CONFLICT (user_id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  department = EXCLUDED.department,
  degree_course = EXCLUDED.degree_course,
  year = EXCLUDED.year,
  phone = EXCLUDED.phone,
  subjects = EXCLUDED.subjects,
  is_first_login = EXCLUDED.is_first_login,
  is_active = EXCLUDED.is_active,
  email_verified = EXCLUDED.email_verified;

INSERT INTO subjects (id, name, code, department, credits, semester) VALUES
  ('10000000-0000-0000-0000-000000000001', 'Programming Fundamentals', 'CS101', 'Computer Science', 4, 'Sem 1'),
  ('10000000-0000-0000-0000-000000000002', 'Engineering Mathematics I', 'MA101', 'Computer Science', 3, 'Sem 1'),
  ('10000000-0000-0000-0000-000000000003', 'Data Structures', 'CS201', 'Computer Science', 4, 'Sem 2'),
  ('10000000-0000-0000-0000-000000000004', 'Digital Logic', 'CS202', 'Computer Science', 3, 'Sem 2'),
  ('10000000-0000-0000-0000-000000000005', 'Communication Skills', 'HS101', 'Computer Science', 2, 'Sem 1')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  department = EXCLUDED.department,
  credits = EXCLUDED.credits,
  semester = EXCLUDED.semester;

INSERT INTO faculty_subjects (faculty_id, subject_id) VALUES
  ('00000000-0000-0000-0000-000000000101', '10000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000101', '10000000-0000-0000-0000-000000000003'),
  ('00000000-0000-0000-0000-000000000102', '10000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000102', '10000000-0000-0000-0000-000000000004'),
  ('00000000-0000-0000-0000-000000000102', '10000000-0000-0000-0000-000000000005')
ON CONFLICT (faculty_id, subject_id) DO NOTHING;

INSERT INTO classrooms (id, name, building, floor, capacity, room_type, has_projector, has_ac, is_active) VALUES
  ('20000000-0000-0000-0000-000000000001', 'A-201', 'Block A', 2, 60, 'lecture', true, false, true),
  ('20000000-0000-0000-0000-000000000002', 'A-202', 'Block A', 2, 60, 'lecture', true, true, true),
  ('20000000-0000-0000-0000-000000000003', 'CS-Lab-1', 'Block C', 3, 40, 'lab', true, true, true)
ON CONFLICT (name) DO UPDATE SET
  building = EXCLUDED.building,
  floor = EXCLUDED.floor,
  capacity = EXCLUDED.capacity,
  room_type = EXCLUDED.room_type,
  has_projector = EXCLUDED.has_projector,
  has_ac = EXCLUDED.has_ac,
  is_active = EXCLUDED.is_active;

INSERT INTO faculty_availability (faculty_id, day, start_time, end_time, is_available, note) VALUES
  ('00000000-0000-0000-0000-000000000101', 'Monday', '09:00', '17:00', true, 'Available'),
  ('00000000-0000-0000-0000-000000000101', 'Wednesday', '14:00', '17:00', false, 'Department meeting'),
  ('00000000-0000-0000-0000-000000000102', 'Tuesday', '09:00', '17:00', true, 'Available'),
  ('00000000-0000-0000-0000-000000000102', 'Friday', '09:00', '12:15', false, 'Research block')
ON CONFLICT (faculty_id, day, start_time) DO UPDATE SET
  end_time = EXCLUDED.end_time,
  is_available = EXCLUDED.is_available,
  note = EXCLUDED.note;

INSERT INTO booking_slots (
  id, student_id, faculty_id, date, start_time, end_time, purpose, description, status
) VALUES (
  '30000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000101',
  CURRENT_DATE + INTERVAL '1 day',
  '15:00',
  '15:30',
  'doubt_clearing',
  'Need help with loops and arrays.',
  'pending'
)
ON CONFLICT (id) DO UPDATE SET
  date = EXCLUDED.date,
  start_time = EXCLUDED.start_time,
  end_time = EXCLUDED.end_time,
  purpose = EXCLUDED.purpose,
  description = EXCLUDED.description,
  status = EXCLUDED.status;

INSERT INTO leave_requests (
  id, faculty_id, start_date, end_date, reason, status, admin_note
) VALUES (
  '40000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000102',
  CURRENT_DATE + INTERVAL '7 days',
  CURRENT_DATE + INTERVAL '7 days',
  'Conference visit',
  'pending',
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  reason = EXCLUDED.reason,
  status = EXCLUDED.status,
  admin_note = EXCLUDED.admin_note;

INSERT INTO messages (sender_id, receiver_id, text, timestamp) VALUES
  ('STU001', 'FAC001', 'Good morning maam, I have a doubt in programming.', NOW() - INTERVAL '30 minutes'),
  ('FAC001', 'STU001', 'Sure, book a slot or send the topic here.', NOW() - INTERVAL '20 minutes'),
  ('STU002', 'FAC002', 'Sir, can you review my digital logic notes?', NOW() - INTERVAL '10 minutes');
