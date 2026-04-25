/**
 * Seed ONLY users (faculty + students)
 * Run: node seed-users-only.js
 * 
 * Classrooms + subjects already seeded by seed-data.js
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

const DEPARTMENTS = [
  { name: 'Computer Science', degrees: ['B.Tech', 'M.Tech'], abbrev: 'CS' },
  { name: 'Electronics', degrees: ['B.Tech', 'M.Tech'], abbrev: 'ECE' },
  { name: 'Mechanical', degrees: ['B.Tech', 'M.Tech'], abbrev: 'ME' },
  { name: 'Civil', degrees: ['B.Tech', 'M.Tech'], abbrev: 'CE' },
  { name: 'Electrical', degrees: ['B.Tech', 'M.Tech'], abbrev: 'EE' },
  { name: 'Information Technology', degrees: ['B.Tech', 'M.Tech'], abbrev: 'IT' },
  { name: 'Chemical', degrees: ['B.Tech', 'M.Tech'], abbrev: 'CH' },
  { name: 'Biotechnology', degrees: ['B.Tech', 'M.Tech'], abbrev: 'BT' },
  { name: 'Mathematics', degrees: ['B.Sc', 'M.Sc'], abbrev: 'MA' },
  { name: 'Physics', degrees: ['B.Sc', 'M.Sc'], abbrev: 'PH' },
  { name: 'Chemistry', degrees: ['B.Sc', 'M.Sc'], abbrev: 'CY' },
  { name: 'Commerce', degrees: ['B.Com', 'M.Com'], abbrev: 'CO' },
  { name: 'Arts', degrees: ['BA', 'MA'], abbrev: 'AR' },
];

const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
const FIRST = ['Aarav','Vivaan','Aditya','Vihaan','Arjun','Reyansh','Mohammed','Sai','Arnav','Dhruv','Kabir','Ritvik','Aadhya','Ananya','Avni','Diya','Ishita','Kiara','Myra','Prisha','Saanvi','Aanya','Advait','Agastya','Ahaan','Ayaan','Darsh','Dev','Eshaan','Gaurav','Harsh','Ishan','Jay','Karthik','Laksh','Manav','Neel','Om','Pranav','Rahul','Rohan','Shaurya','Tanish','Utkarsh','Vedant','Yash','Zain','Aishwarya','Bhavya','Charvi','Divya','Eva','Fatima','Gauri','Hansa','Isha','Jiya','Kavya','Lavanya','Meera','Navya','Oviya','Pooja','Rhea','Sara','Tanvi','Uma','Vaani','Wafa','Yamini','Zara','Abhinav','Bharat','Chirag','Deepak','Eshan','Faisal','Girish','Hemant','Indra','Jai','Kunal','Lokesh','Mohit','Nikhil','Ojas','Parth','Qasim','Raj','Siddharth','Tarun','Uday','Vikram','Waseem','Xavier','Yogesh','Zeeshan','Akash','Brijesh','Chandan'];
const LAST = ['Sharma','Verma','Patel','Singh','Kumar','Gupta','Reddy','Nair','Iyer','Choudhary','Joshi','Mishra','Pandey','Saxena','Agarwal','Mehta','Shah','Desai','Rathore','Kapoor','Malhotra','Khanna','Bhat','Hegde','Menon','Pillai','Rao','Murthy','Prasad','Das','Sen','Bose','Roy','Dutta','Chatterjee','Banerjee','Mukherjee','Ghosh','Basu','Saha','Thakur','Chauhan','Yadav','Tiwari','Dubey','Shukla','Tripathi','Srivastava','Bajaj','Arora'];
const TITLES = ['Dr.', 'Prof.', 'Dr.', 'Prof.', 'Dr.'];

function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function main() {
  console.log('🚀 Seeding faculty + students...\n');
  const passHash = await bcrypt.hash('Test@1234', 12);

  // Get existing subjects for faculty_subjects linkage
  const { data: allSubjects } = await supabase.from('subjects').select('id, department');
  const subjectsByDept = {};
  for (const s of (allSubjects || [])) {
    if (!subjectsByDept[s.department]) subjectsByDept[s.department] = [];
    subjectsByDept[s.department].push(s.id);
  }

  let facCount = 0, stuCount = 0;

  for (const dept of DEPARTMENTS) {
    // ── FACULTY (15) ──
    const facRows = [];
    for (let f = 0; f < 15; f++) {
      facCount++;
      const first = pick(FIRST), last = pick(LAST);
      facRows.push({
        user_id: `FAC2026${String(facCount).padStart(4, '0')}`,
        full_name: `${pick(TITLES)} ${first} ${last}`,
        email: `${first.toLowerCase()}.${last.toLowerCase()}.f${facCount}@university.edu`,
        password_hash: passHash,
        role: 'faculty',
        department: dept.name,
        phone: `+91${rand(7000000000, 9999999999)}`,
        is_first_login: false,
        is_active: true,
      });
    }

    const { data: facData, error: facErr } = await supabase.from('users').insert(facRows).select('id');
    if (facErr) {
      console.error(`  ❌ ${dept.name} faculty: ${facErr.message}`);
      continue;
    }

    // Link faculty → subjects
    const deptSubIds = subjectsByDept[dept.name] || [];
    if (deptSubIds.length > 0 && facData) {
      const links = [];
      for (let fi = 0; fi < facData.length; fi++) {
        for (let si = 0; si < Math.min(3, deptSubIds.length); si++) {
          links.push({ faculty_id: facData[fi].id, subject_id: deptSubIds[(fi + si) % deptSubIds.length] });
        }
      }
      const unique = [...new Map(links.map(l => [`${l.faculty_id}-${l.subject_id}`, l])).values()];
      await supabase.from('faculty_subjects').insert(unique);
    }
    console.log(`  👩‍🏫 ${dept.name}: 15 faculty ✓`);

    // ── STUDENTS (150) ──
    const stuRows = [];
    for (let s = 0; s < 150; s++) {
      stuCount++;
      const first = pick(FIRST), last = pick(LAST);
      stuRows.push({
        user_id: `STU2026${String(stuCount).padStart(4, '0')}`,
        full_name: `${first} ${last}`,
        email: `${first.toLowerCase()}.${last.toLowerCase()}.s${stuCount}@student.university.edu`,
        password_hash: passHash,
        role: 'student',
        department: dept.name,
        degree_course: dept.degrees[s % dept.degrees.length],
        year: YEARS[s % YEARS.length],
        phone: `+91${rand(7000000000, 9999999999)}`,
        is_first_login: false,
        is_active: true,
      });
    }

    for (let i = 0; i < stuRows.length; i += 50) {
      const { error } = await supabase.from('users').insert(stuRows.slice(i, i + 50));
      if (error) { console.error(`  ❌ ${dept.name} students batch ${i}: ${error.message}`); break; }
    }
    console.log(`  🎓 ${dept.name}: 150 students ✓`);
  }

  console.log(`\n✅ Done! Created ${facCount} faculty + ${stuCount} students`);
  console.log('   All passwords: Test@1234');
}

main().catch(e => { console.error(e); process.exit(1); });
