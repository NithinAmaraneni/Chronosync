const fs = require('fs');
const path = require('path');

const PASSWORD_HASH = '$2a$12$Kdbz7FKpwS270u6MIVacQuPVlM5IgQRIdzm9zm6ITB0ex4yyo3iR6';
const OUTPUT_FILE = path.join(__dirname, '..', 'demo-campus-data.sql');

const BUILDINGS = ['Aryabhata Block', 'Raman Block', 'Kalam Block'];
const FLOORS_PER_BUILDING = 5;
const ROOMS_PER_FLOOR = 8;
const ROOM_CAPACITY = 50;
const TOTAL_ROOMS = BUILDINGS.length * FLOORS_PER_BUILDING * ROOMS_PER_FLOOR;
const TOTAL_STUDENTS = TOTAL_ROOMS * ROOM_CAPACITY;
const STUDENTS_PER_FACULTY = 30;
const TOTAL_FACULTY = Math.ceil(TOTAL_STUDENTS / STUDENTS_PER_FACULTY);
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

function sql(value) {
  if (value === null || value === undefined) return 'NULL';
  if (Array.isArray(value)) return `ARRAY[${value.map(sql).join(', ')}]`;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function uuid(prefix, index) {
  return `${prefix}${String(index).padStart(12, '0')}`;
}

function userRow({ id, userId, email, fullName, role, department = null, degree = null, year = null, phone = null, subjects = null }) {
  return `(${[
    sql(id),
    sql(userId),
    sql(email),
    sql(fullName),
    sql(PASSWORD_HASH),
    sql(role),
    sql(department),
    sql(degree),
    sql(year),
    sql(phone),
    subjects ? sql(subjects) : 'NULL',
    'false',
    'true',
    'true',
  ].join(', ')})`;
}

function chunked(values, size = 500) {
  const chunks = [];
  for (let i = 0; i < values.length; i += size) chunks.push(values.slice(i, i + size));
  return chunks;
}

const users = [];
const rooms = [];
const subjects = [];
const assignments = [];
const availability = [];
const bookings = [];
const messages = [];

users.push(userRow({
  id: uuid('00000000-0000-0000-0000-', 1),
  userId: 'ADM001',
  email: 'admin@chronosync.demo',
  fullName: 'Demo Admin',
  role: 'admin',
  phone: '9000000001',
}));

for (let buildingIndex = 0; buildingIndex < BUILDINGS.length; buildingIndex++) {
  for (let floor = 1; floor <= FLOORS_PER_BUILDING; floor++) {
    for (let room = 1; room <= ROOMS_PER_FLOOR; room++) {
      const roomNumber = `${String(buildingIndex + 1)}${floor}${String(room).padStart(2, '0')}`;
      const isLab = room === 7 || room === 8;
      rooms.push(`(${[
        sql(uuid('20000000-0000-0000-0000-', rooms.length + 1)),
        sql(`${BUILDINGS[buildingIndex].split(' ')[0]}-${roomNumber}`),
        sql(BUILDINGS[buildingIndex]),
        sql(floor),
        sql(ROOM_CAPACITY),
        sql(isLab ? 'lab' : 'lecture'),
        'true',
        buildingIndex !== 0 ? 'true' : 'false',
        'true',
      ].join(', ')})`);
    }
  }
}

for (const department of DEPARTMENTS) {
  for (let sem = 1; sem <= 8; sem++) {
    const templates = SUBJECT_TEMPLATES[department];
    for (let i = 0; i < templates.length; i++) {
      const [name, code, credits] = templates[i];
      const deptCode = department.split(' ').map(part => part[0]).join('').toUpperCase();
      const subjectIndex = subjects.length + 1;
      subjects.push({
        id: uuid('10000000-0000-0000-0000-', subjectIndex),
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
  const assigned = [
    deptSubjects[(i - 1) % deptSubjects.length],
    deptSubjects[(i + 12) % deptSubjects.length],
  ];
  const facultyId = uuid('00000000-0000-0000-0000-', 1000 + i);
  users.push(userRow({
    id: facultyId,
    userId: `FAC${String(i).padStart(3, '0')}`,
    email: `faculty${String(i).padStart(3, '0')}@chronosync.demo`,
    fullName: `Faculty ${String(i).padStart(3, '0')}`,
    role: 'faculty',
    department,
    phone: `91${String(7000000000 + i)}`,
    subjects: assigned.map(subject => subject.name),
  }));

  for (const subject of assigned) {
    assignments.push(`(${sql(facultyId)}, ${sql(subject.id)})`);
  }

  for (const day of DAYS) {
    availability.push(`(${[
      sql(facultyId),
      sql(day),
      sql('09:00'),
      sql('17:00'),
      i % 17 === 0 && day === 'Friday' ? 'false' : 'true',
      sql(i % 17 === 0 && day === 'Friday' ? 'Research block' : 'Available'),
    ].join(', ')})`);
  }
}

for (let i = 1; i <= TOTAL_STUDENTS; i++) {
  const department = DEPARTMENTS[(i - 1) % DEPARTMENTS.length];
  const year = YEARS[Math.floor((i - 1) / (TOTAL_STUDENTS / YEARS.length)) % YEARS.length];
  users.push(userRow({
    id: uuid('00000000-0000-0000-0000-', 100000 + i),
    userId: `STU${String(i).padStart(5, '0')}`,
    email: `student${String(i).padStart(5, '0')}@chronosync.demo`,
    fullName: `Student ${String(i).padStart(5, '0')}`,
    role: 'student',
    department,
    degree: `B.Tech ${department}`,
    year,
    phone: `98${String(60000000 + i).padStart(8, '0')}`,
  }));
}

for (let i = 1; i <= 60; i++) {
  const studentId = uuid('00000000-0000-0000-0000-', 100000 + i);
  const facultyId = uuid('00000000-0000-0000-0000-', 1000 + ((i - 1) % TOTAL_FACULTY) + 1);
  bookings.push(`(${[
    sql(uuid('30000000-0000-0000-0000-', i)),
    sql(studentId),
    sql(facultyId),
    `CURRENT_DATE + INTERVAL '${(i % 10) + 1} days'`,
    sql(i % 2 === 0 ? '14:00' : '15:00'),
    sql(i % 2 === 0 ? '14:30' : '15:30'),
    sql(i % 3 === 0 ? 'counseling' : 'doubt_clearing'),
    sql('Demo booking for faculty-student workflow.'),
    sql(i % 4 === 0 ? 'approved' : 'pending'),
  ].join(', ')})`);
}

for (let i = 1; i <= 80; i++) {
  const studentUser = `STU${String(i).padStart(5, '0')}`;
  const facultyUser = `FAC${String(((i - 1) % TOTAL_FACULTY) + 1).padStart(3, '0')}`;
  messages.push(`(${sql(studentUser)}, ${sql(facultyUser)}, ${sql("Hello, I need help with today's topic.")}, NOW() - INTERVAL '${i} minutes')`);
  messages.push(`(${sql(facultyUser)}, ${sql(studentUser)}, ${sql('Sure, send your question or book a slot.')}, NOW() - INTERVAL '${i - 0.5} minutes')`);
}

const lines = [];
lines.push('-- ChronoSync large demo campus data');
lines.push('-- Generated by backend/scripts/generate-demo-campus-data.js');
lines.push(`-- Buildings: ${BUILDINGS.length}, floors/building: ${FLOORS_PER_BUILDING}, rooms/floor: ${ROOMS_PER_FLOOR}`);
lines.push(`-- Rooms: ${TOTAL_ROOMS}, room capacity: ${ROOM_CAPACITY}, students: ${TOTAL_STUDENTS}, faculty: ${TOTAL_FACULTY}`);
lines.push('-- Login password for all demo users: Password@123');
lines.push('');
lines.push('BEGIN;');
lines.push('');

for (const group of chunked(users, 400)) {
  lines.push('INSERT INTO users (id, user_id, email, full_name, password_hash, role, department, degree_course, year, phone, subjects, is_first_login, is_active, email_verified) VALUES');
  lines.push(`${group.join(',\n')}`);
  lines.push('ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, password_hash = EXCLUDED.password_hash, role = EXCLUDED.role, department = EXCLUDED.department, degree_course = EXCLUDED.degree_course, year = EXCLUDED.year, phone = EXCLUDED.phone, subjects = EXCLUDED.subjects, is_first_login = EXCLUDED.is_first_login, is_active = EXCLUDED.is_active, email_verified = EXCLUDED.email_verified;');
  lines.push('');
}

lines.push('INSERT INTO classrooms (id, name, building, floor, capacity, room_type, has_projector, has_ac, is_active) VALUES');
lines.push(rooms.join(',\n'));
lines.push('ON CONFLICT (name) DO UPDATE SET building = EXCLUDED.building, floor = EXCLUDED.floor, capacity = EXCLUDED.capacity, room_type = EXCLUDED.room_type, has_projector = EXCLUDED.has_projector, has_ac = EXCLUDED.has_ac, is_active = EXCLUDED.is_active;');
lines.push('');

lines.push('INSERT INTO subjects (id, name, code, department, credits, semester) VALUES');
lines.push(subjects.map(subject => `(${[sql(subject.id), sql(subject.name), sql(subject.code), sql(subject.department), sql(subject.credits), sql(subject.semester)].join(', ')})`).join(',\n'));
lines.push('ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, department = EXCLUDED.department, credits = EXCLUDED.credits, semester = EXCLUDED.semester;');
lines.push('');

for (const group of chunked(assignments, 500)) {
  lines.push('INSERT INTO faculty_subjects (faculty_id, subject_id) VALUES');
  lines.push(group.join(',\n'));
  lines.push('ON CONFLICT (faculty_id, subject_id) DO NOTHING;');
  lines.push('');
}

for (const group of chunked(availability, 500)) {
  lines.push('INSERT INTO faculty_availability (faculty_id, day, start_time, end_time, is_available, note) VALUES');
  lines.push(group.join(',\n'));
  lines.push('ON CONFLICT (faculty_id, day, start_time) DO UPDATE SET end_time = EXCLUDED.end_time, is_available = EXCLUDED.is_available, note = EXCLUDED.note;');
  lines.push('');
}

lines.push('INSERT INTO booking_slots (id, student_id, faculty_id, date, start_time, end_time, purpose, description, status) VALUES');
lines.push(bookings.join(',\n'));
lines.push('ON CONFLICT (id) DO UPDATE SET date = EXCLUDED.date, start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time, purpose = EXCLUDED.purpose, description = EXCLUDED.description, status = EXCLUDED.status;');
lines.push('');

for (const group of chunked(messages, 500)) {
  lines.push('INSERT INTO messages (sender_id, receiver_id, text, timestamp) VALUES');
  lines.push(`${group.join(',\n')};`);
  lines.push('');
}

lines.push('COMMIT;');
lines.push('');

fs.writeFileSync(OUTPUT_FILE, `${lines.join('\n')}\n`);

console.log(`Created ${OUTPUT_FILE}`);
console.log(`Rooms: ${TOTAL_ROOMS}`);
console.log(`Students: ${TOTAL_STUDENTS}`);
console.log(`Faculty: ${TOTAL_FACULTY}`);
console.log(`Subjects: ${subjects.length}`);
