const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const PASSWORD_HASH = '$2a$12$Kdbz7FKpwS270u6MIVacQuPVlM5IgQRIdzm9zm6ITB0ex4yyo3iR6';
const BUILDINGS = ['Aryabhata Block', 'Raman Block', 'Kalam Block'];
const FLOORS_PER_BUILDING = 5;
const ROOMS_PER_FLOOR = 8;
const ROOM_CAPACITY = 50;
const TOTAL_ROOMS = BUILDINGS.length * FLOORS_PER_BUILDING * ROOMS_PER_FLOOR;
const TOTAL_STUDENTS = TOTAL_ROOMS * ROOM_CAPACITY;
const TOTAL_FACULTY = Math.ceil(TOTAL_STUDENTS / 30);
const DEPARTMENTS = ['Computer Science', 'Electronics', 'Mechanical'];
const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const SUBJECT_TEMPLATES = {
  'Computer Science': [
    ['Programming Fundamentals', 'PF', 4],
    ['Engineering Mathematics', 'MATH', 3],
    ['Digital Logic', 'DL', 3],
    ['Data Structures', 'DS', 4],
    ['Database Systems', 'DBMS', 4],
  ],
  Electronics: [
    ['Basic Electronics', 'BE', 4],
    ['Circuit Theory', 'CT', 3],
    ['Signals and Systems', 'SS', 3],
    ['Analog Electronics', 'AE', 4],
    ['Microprocessors', 'MP', 4],
  ],
  Mechanical: [
    ['Engineering Mechanics', 'EM', 4],
    ['Thermodynamics', 'TD', 4],
    ['Fluid Mechanics', 'FM', 3],
    ['Machine Design', 'MD', 4],
    ['Manufacturing Processes', 'MFG', 3],
  ],
};

function uuid(prefix, index) {
  return `${prefix}${String(index).padStart(12, '0')}`;
}

function user({ id, user_id, email, full_name, role, department = null, degree_course = null, year = null, phone = null, subjects = null }) {
  return {
    id,
    user_id,
    email,
    full_name,
    password_hash: PASSWORD_HASH,
    role,
    department,
    degree_course,
    year,
    phone,
    subjects,
    is_first_login: false,
    is_active: true,
    email_verified: true,
  };
}

function buildDemoData() {
  const users = [];
  const classrooms = [];
  const subjects = [];
  const facultySubjects = [];
  const availability = [];
  const bookings = [];
  const messages = [];

  users.push(user({
    id: uuid('00000000-0000-0000-0000-', 1),
    user_id: 'ADM001',
    email: 'admin@chronosync.demo',
    full_name: 'Demo Admin',
    role: 'admin',
    phone: '9000000001',
  }));

  for (let buildingIndex = 0; buildingIndex < BUILDINGS.length; buildingIndex++) {
    for (let floor = 1; floor <= FLOORS_PER_BUILDING; floor++) {
      for (let room = 1; room <= ROOMS_PER_FLOOR; room++) {
        const roomNumber = `${buildingIndex + 1}${floor}${String(room).padStart(2, '0')}`;
        const isLab = room === 7 || room === 8;
        classrooms.push({
          id: uuid('20000000-0000-0000-0000-', classrooms.length + 1),
          name: `${BUILDINGS[buildingIndex].split(' ')[0]}-${roomNumber}`,
          building: BUILDINGS[buildingIndex],
          floor,
          capacity: ROOM_CAPACITY,
          room_type: isLab ? 'lab' : 'lecture',
          has_projector: true,
          has_ac: buildingIndex !== 0,
          is_active: true,
        });
      }
    }
  }

  for (const department of DEPARTMENTS) {
    for (let sem = 1; sem <= 8; sem++) {
      const templates = SUBJECT_TEMPLATES[department];
      for (let i = 0; i < templates.length; i++) {
        const [name, code, credits] = templates[i];
        const deptCode = department.split(' ').map(part => part[0]).join('').toUpperCase();
        subjects.push({
          id: uuid('10000000-0000-0000-0000-', subjects.length + 1),
          name: `${name} ${sem}`,
          code: `${deptCode}${sem}${code}${i + 1}`,
          department,
          credits,
          semester: `Sem ${sem}`,
        });
      }
    }
  }

  for (let i = 1; i <= TOTAL_FACULTY; i++) {
    const department = DEPARTMENTS[(i - 1) % DEPARTMENTS.length];
    const deptSubjects = subjects.filter(subject => subject.department === department);
    const assigned = [deptSubjects[(i - 1) % deptSubjects.length], deptSubjects[(i + 12) % deptSubjects.length]];
    const facultyId = uuid('00000000-0000-0000-0000-', 1000 + i);

    users.push(user({
      id: facultyId,
      user_id: `FAC${String(i).padStart(3, '0')}`,
      email: `faculty${String(i).padStart(3, '0')}@chronosync.demo`,
      full_name: `Faculty ${String(i).padStart(3, '0')}`,
      role: 'faculty',
      department,
      phone: `91${String(7000000000 + i)}`,
      subjects: assigned.map(subject => subject.name),
    }));

    assigned.forEach(subject => facultySubjects.push({ faculty_id: facultyId, subject_id: subject.id }));
    DAYS.forEach(day => availability.push({
      faculty_id: facultyId,
      day,
      start_time: '09:00',
      end_time: '17:00',
      is_available: !(i % 17 === 0 && day === 'Friday'),
      note: i % 17 === 0 && day === 'Friday' ? 'Research block' : 'Available',
    }));
  }

  for (let i = 1; i <= TOTAL_STUDENTS; i++) {
    const department = DEPARTMENTS[(i - 1) % DEPARTMENTS.length];
    const year = YEARS[Math.floor((i - 1) / (TOTAL_STUDENTS / YEARS.length)) % YEARS.length];
    users.push(user({
      id: uuid('00000000-0000-0000-0000-', 100000 + i),
      user_id: `STU${String(i).padStart(5, '0')}`,
      email: `student${String(i).padStart(5, '0')}@chronosync.demo`,
      full_name: `Student ${String(i).padStart(5, '0')}`,
      role: 'student',
      department,
      degree_course: `B.Tech ${department}`,
      year,
      phone: `98${String(60000000 + i).padStart(8, '0')}`,
    }));
  }

  for (let i = 1; i <= 60; i++) {
    bookings.push({
      id: uuid('30000000-0000-0000-0000-', i),
      student_id: uuid('00000000-0000-0000-0000-', 100000 + i),
      faculty_id: uuid('00000000-0000-0000-0000-', 1000 + ((i - 1) % TOTAL_FACULTY) + 1),
      date: new Date(Date.now() + ((i % 10) + 1) * 86400000).toISOString().slice(0, 10),
      start_time: i % 2 === 0 ? '14:00' : '15:00',
      end_time: i % 2 === 0 ? '14:30' : '15:30',
      purpose: i % 3 === 0 ? 'counseling' : 'doubt_clearing',
      description: 'Demo booking for faculty-student workflow.',
      status: i % 4 === 0 ? 'approved' : 'pending',
    });
  }

  for (let i = 1; i <= 80; i++) {
    const studentUser = `STU${String(i).padStart(5, '0')}`;
    const facultyUser = `FAC${String(((i - 1) % TOTAL_FACULTY) + 1).padStart(3, '0')}`;
    messages.push({
      id: uuid('50000000-0000-0000-0000-', i * 2 - 1),
      sender_id: studentUser,
      receiver_id: facultyUser,
      text: "Hello, I need help with today's topic.",
      timestamp: new Date(Date.now() - i * 60000).toISOString(),
    });
    messages.push({
      id: uuid('50000000-0000-0000-0000-', i * 2),
      sender_id: facultyUser,
      receiver_id: studentUser,
      text: 'Sure, send your question or book a slot.',
      timestamp: new Date(Date.now() - (i - 0.5) * 60000).toISOString(),
    });
  }

  return { users, classrooms, subjects, facultySubjects, availability, bookings, messages };
}

async function upsertBatches(supabase, table, rows, options = {}, size = 500) {
  for (let i = 0; i < rows.length; i += size) {
    const batch = rows.slice(i, i + size);
    const { error } = await supabase.from(table).upsert(batch, options);
    if (error) throw new Error(`${table} batch ${Math.floor(i / size) + 1}: ${error.message}`);
    console.log(`  ${table}: ${Math.min(i + size, rows.length)}/${rows.length}`);
  }
}

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env');
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const data = buildDemoData();

  console.log('Seeding ChronoSync demo campus data...');
  console.log(`Rooms=${data.classrooms.length}, Students=${TOTAL_STUDENTS}, Faculty=${TOTAL_FACULTY}, Subjects=${data.subjects.length}`);

  await upsertBatches(supabase, 'users', data.users, { onConflict: 'user_id' });
  await upsertBatches(supabase, 'classrooms', data.classrooms, { onConflict: 'name' });
  await upsertBatches(supabase, 'subjects', data.subjects, { onConflict: 'code' });
  await upsertBatches(supabase, 'faculty_subjects', data.facultySubjects, { onConflict: 'faculty_id,subject_id', ignoreDuplicates: true });
  await upsertBatches(supabase, 'faculty_availability', data.availability, { onConflict: 'faculty_id,day,start_time' });
  await upsertBatches(supabase, 'booking_slots', data.bookings, { onConflict: 'id' });
  await upsertBatches(supabase, 'messages', data.messages, { onConflict: 'id' });

  console.log('Done. Login with ADM001 / Password@123, FAC001 / Password@123, or STU00001 / Password@123.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
