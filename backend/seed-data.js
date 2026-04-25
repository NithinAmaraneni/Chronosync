/**
 * ═══════════════════════════════════════════════════
 * ChronoSync — Comprehensive Database Seed Script
 * ═══════════════════════════════════════════════════
 * 
 * Run: node seed-data.js
 * 
 * Creates:
 * - 150 students per department (13 depts = 1,950 students)
 * - 15 faculty per department (13 depts = 195 faculty)
 * - Subjects per department (realistic curriculum)
 * - 15 blocks × 6 floors × 8 rooms = 720 classrooms
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

// ═══════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════
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

const SUBJECTS = {
  'Computer Science': [
    { name: 'Data Structures', code: 'CS101', credits: 4, semester: 'Sem 3' },
    { name: 'Algorithms', code: 'CS102', credits: 4, semester: 'Sem 4' },
    { name: 'Database Management Systems', code: 'CS201', credits: 3, semester: 'Sem 4' },
    { name: 'Operating Systems', code: 'CS202', credits: 4, semester: 'Sem 5' },
    { name: 'Computer Networks', code: 'CS301', credits: 3, semester: 'Sem 5' },
    { name: 'Software Engineering', code: 'CS302', credits: 3, semester: 'Sem 6' },
    { name: 'Machine Learning', code: 'CS401', credits: 4, semester: 'Sem 7' },
    { name: 'Artificial Intelligence', code: 'CS402', credits: 4, semester: 'Sem 7' },
    { name: 'Web Technologies', code: 'CS303', credits: 3, semester: 'Sem 6' },
    { name: 'Cloud Computing', code: 'CS403', credits: 3, semester: 'Sem 8' },
    { name: 'Compiler Design', code: 'CS304', credits: 4, semester: 'Sem 6' },
    { name: 'Computer Architecture', code: 'CS203', credits: 3, semester: 'Sem 3' },
    { name: 'Theory of Computation', code: 'CS305', credits: 3, semester: 'Sem 5' },
    { name: 'Cyber Security', code: 'CS404', credits: 3, semester: 'Sem 8' },
    { name: 'Data Mining', code: 'CS405', credits: 3, semester: 'Sem 7' },
  ],
  'Electronics': [
    { name: 'Digital Electronics', code: 'EC101', credits: 4, semester: 'Sem 3' },
    { name: 'Analog Electronics', code: 'EC102', credits: 4, semester: 'Sem 3' },
    { name: 'Signals and Systems', code: 'EC201', credits: 4, semester: 'Sem 4' },
    { name: 'Communication Systems', code: 'EC202', credits: 3, semester: 'Sem 5' },
    { name: 'VLSI Design', code: 'EC301', credits: 4, semester: 'Sem 6' },
    { name: 'Embedded Systems', code: 'EC302', credits: 3, semester: 'Sem 6' },
    { name: 'Microprocessors', code: 'EC203', credits: 4, semester: 'Sem 4' },
    { name: 'Control Systems', code: 'EC303', credits: 3, semester: 'Sem 5' },
    { name: 'Antenna Design', code: 'EC401', credits: 3, semester: 'Sem 7' },
    { name: 'DSP', code: 'EC402', credits: 4, semester: 'Sem 7' },
    { name: 'Electromagnetics', code: 'EC204', credits: 3, semester: 'Sem 4' },
    { name: 'Sensor Technology', code: 'EC403', credits: 3, semester: 'Sem 8' },
    { name: 'Robotics', code: 'EC404', credits: 3, semester: 'Sem 8' },
    { name: 'IoT Systems', code: 'EC405', credits: 3, semester: 'Sem 7' },
    { name: 'Power Electronics', code: 'EC304', credits: 3, semester: 'Sem 6' },
  ],
  'Mechanical': [
    { name: 'Engineering Mechanics', code: 'ME101', credits: 4, semester: 'Sem 3' },
    { name: 'Thermodynamics', code: 'ME102', credits: 4, semester: 'Sem 3' },
    { name: 'Fluid Mechanics', code: 'ME201', credits: 4, semester: 'Sem 4' },
    { name: 'Strength of Materials', code: 'ME202', credits: 3, semester: 'Sem 4' },
    { name: 'Manufacturing Processes', code: 'ME301', credits: 3, semester: 'Sem 5' },
    { name: 'Machine Design', code: 'ME302', credits: 4, semester: 'Sem 6' },
    { name: 'Heat Transfer', code: 'ME203', credits: 3, semester: 'Sem 5' },
    { name: 'CAD/CAM', code: 'ME303', credits: 3, semester: 'Sem 6' },
    { name: 'Automobile Engineering', code: 'ME401', credits: 3, semester: 'Sem 7' },
    { name: 'Robotics & Automation', code: 'ME402', credits: 3, semester: 'Sem 7' },
    { name: 'Finite Element Analysis', code: 'ME403', credits: 4, semester: 'Sem 8' },
    { name: 'Industrial Engineering', code: 'ME304', credits: 3, semester: 'Sem 6' },
    { name: 'Vibrations', code: 'ME305', credits: 3, semester: 'Sem 5' },
    { name: 'Refrigeration & AC', code: 'ME404', credits: 3, semester: 'Sem 8' },
    { name: 'Power Plant Engineering', code: 'ME405', credits: 3, semester: 'Sem 7' },
  ],
  'Civil': [
    { name: 'Surveying', code: 'CE101', credits: 3, semester: 'Sem 3' },
    { name: 'Structural Analysis', code: 'CE102', credits: 4, semester: 'Sem 4' },
    { name: 'Concrete Technology', code: 'CE201', credits: 3, semester: 'Sem 4' },
    { name: 'Geotechnical Engineering', code: 'CE202', credits: 4, semester: 'Sem 5' },
    { name: 'Transportation Engineering', code: 'CE301', credits: 3, semester: 'Sem 5' },
    { name: 'Environmental Engineering', code: 'CE302', credits: 3, semester: 'Sem 6' },
    { name: 'Water Resources', code: 'CE303', credits: 3, semester: 'Sem 6' },
    { name: 'Steel Structures', code: 'CE203', credits: 4, semester: 'Sem 5' },
    { name: 'Construction Management', code: 'CE401', credits: 3, semester: 'Sem 7' },
    { name: 'Earthquake Engineering', code: 'CE402', credits: 3, semester: 'Sem 7' },
    { name: 'Town Planning', code: 'CE403', credits: 3, semester: 'Sem 8' },
    { name: 'Bridge Engineering', code: 'CE404', credits: 3, semester: 'Sem 8' },
    { name: 'GIS & Remote Sensing', code: 'CE405', credits: 3, semester: 'Sem 7' },
    { name: 'Hydraulics', code: 'CE204', credits: 4, semester: 'Sem 4' },
    { name: 'Building Materials', code: 'CE103', credits: 3, semester: 'Sem 3' },
  ],
  'Electrical': [
    { name: 'Circuit Theory', code: 'EE101', credits: 4, semester: 'Sem 3' },
    { name: 'Electrical Machines', code: 'EE102', credits: 4, semester: 'Sem 4' },
    { name: 'Power Systems', code: 'EE201', credits: 4, semester: 'Sem 5' },
    { name: 'Control Engineering', code: 'EE202', credits: 3, semester: 'Sem 5' },
    { name: 'Switchgear & Protection', code: 'EE301', credits: 3, semester: 'Sem 6' },
    { name: 'Power Electronics', code: 'EE302', credits: 4, semester: 'Sem 6' },
    { name: 'Instrumentation', code: 'EE203', credits: 3, semester: 'Sem 4' },
    { name: 'Renewable Energy', code: 'EE401', credits: 3, semester: 'Sem 7' },
    { name: 'High Voltage Engineering', code: 'EE402', credits: 3, semester: 'Sem 7' },
    { name: 'Electrical Drives', code: 'EE303', credits: 3, semester: 'Sem 6' },
    { name: 'Smart Grid', code: 'EE403', credits: 3, semester: 'Sem 8' },
    { name: 'Signal Processing', code: 'EE204', credits: 3, semester: 'Sem 5' },
    { name: 'EMF Theory', code: 'EE103', credits: 3, semester: 'Sem 3' },
    { name: 'Energy Auditing', code: 'EE404', credits: 3, semester: 'Sem 8' },
    { name: 'Microcontrollers', code: 'EE304', credits: 3, semester: 'Sem 7' },
  ],
  'Information Technology': [
    { name: 'Programming in Java', code: 'IT101', credits: 4, semester: 'Sem 3' },
    { name: 'Data Structures', code: 'IT102', credits: 4, semester: 'Sem 3' },
    { name: 'Web Development', code: 'IT201', credits: 3, semester: 'Sem 4' },
    { name: 'Computer Networks', code: 'IT202', credits: 3, semester: 'Sem 4' },
    { name: 'Information Security', code: 'IT301', credits: 4, semester: 'Sem 5' },
    { name: 'Mobile App Development', code: 'IT302', credits: 3, semester: 'Sem 6' },
    { name: 'Big Data Analytics', code: 'IT401', credits: 3, semester: 'Sem 7' },
    { name: 'DevOps', code: 'IT402', credits: 3, semester: 'Sem 7' },
    { name: 'Blockchain Technology', code: 'IT403', credits: 3, semester: 'Sem 8' },
    { name: 'UI/UX Design', code: 'IT303', credits: 3, semester: 'Sem 6' },
    { name: 'Software Testing', code: 'IT304', credits: 3, semester: 'Sem 5' },
    { name: 'Cloud Infrastructure', code: 'IT404', credits: 3, semester: 'Sem 8' },
    { name: 'Python Programming', code: 'IT103', credits: 3, semester: 'Sem 3' },
    { name: 'API Design', code: 'IT203', credits: 3, semester: 'Sem 5' },
    { name: 'NoSQL Databases', code: 'IT204', credits: 3, semester: 'Sem 6' },
  ],
  'Chemical': [
    { name: 'Chemical Engineering Thermo', code: 'CH101', credits: 4, semester: 'Sem 3' },
    { name: 'Mass Transfer', code: 'CH102', credits: 4, semester: 'Sem 4' },
    { name: 'Heat Transfer Ops', code: 'CH201', credits: 3, semester: 'Sem 4' },
    { name: 'Chemical Reaction Eng', code: 'CH202', credits: 4, semester: 'Sem 5' },
    { name: 'Process Control', code: 'CH301', credits: 3, semester: 'Sem 6' },
    { name: 'Plant Design', code: 'CH302', credits: 3, semester: 'Sem 6' },
    { name: 'Petroleum Refining', code: 'CH401', credits: 3, semester: 'Sem 7' },
    { name: 'Polymer Engineering', code: 'CH402', credits: 3, semester: 'Sem 7' },
    { name: 'Corrosion Engineering', code: 'CH403', credits: 3, semester: 'Sem 8' },
    { name: 'Fluid Mechanics', code: 'CH203', credits: 4, semester: 'Sem 5' },
    { name: 'Process Dynamics', code: 'CH303', credits: 3, semester: 'Sem 6' },
    { name: 'Biochemical Engineering', code: 'CH404', credits: 3, semester: 'Sem 8' },
    { name: 'Environmental Eng', code: 'CH304', credits: 3, semester: 'Sem 5' },
    { name: 'Process Safety', code: 'CH405', credits: 3, semester: 'Sem 7' },
    { name: 'Separation Processes', code: 'CH204', credits: 3, semester: 'Sem 4' },
  ],
  'Biotechnology': [
    { name: 'Cell Biology', code: 'BT101', credits: 4, semester: 'Sem 3' },
    { name: 'Biochemistry', code: 'BT102', credits: 4, semester: 'Sem 3' },
    { name: 'Molecular Biology', code: 'BT201', credits: 4, semester: 'Sem 4' },
    { name: 'Genetics', code: 'BT202', credits: 3, semester: 'Sem 4' },
    { name: 'Immunology', code: 'BT301', credits: 3, semester: 'Sem 5' },
    { name: 'Bioprocess Engineering', code: 'BT302', credits: 4, semester: 'Sem 6' },
    { name: 'Genetic Engineering', code: 'BT401', credits: 4, semester: 'Sem 7' },
    { name: 'Bioinformatics', code: 'BT402', credits: 3, semester: 'Sem 7' },
    { name: 'Pharmaceutical Biotech', code: 'BT403', credits: 3, semester: 'Sem 8' },
    { name: 'Microbiology', code: 'BT203', credits: 3, semester: 'Sem 5' },
    { name: 'Enzymology', code: 'BT303', credits: 3, semester: 'Sem 6' },
    { name: 'Plant Biotechnology', code: 'BT404', credits: 3, semester: 'Sem 8' },
    { name: 'Proteomics', code: 'BT405', credits: 3, semester: 'Sem 7' },
    { name: 'Biostatistics', code: 'BT204', credits: 3, semester: 'Sem 4' },
    { name: 'Tissue Engineering', code: 'BT304', credits: 3, semester: 'Sem 6' },
  ],
  'Mathematics': [
    { name: 'Real Analysis', code: 'MA101', credits: 4, semester: 'Sem 1' },
    { name: 'Linear Algebra', code: 'MA102', credits: 4, semester: 'Sem 1' },
    { name: 'Abstract Algebra', code: 'MA201', credits: 4, semester: 'Sem 3' },
    { name: 'Differential Equations', code: 'MA202', credits: 3, semester: 'Sem 3' },
    { name: 'Complex Analysis', code: 'MA301', credits: 3, semester: 'Sem 4' },
    { name: 'Numerical Methods', code: 'MA302', credits: 3, semester: 'Sem 4' },
    { name: 'Probability Theory', code: 'MA401', credits: 4, semester: 'Sem 5' },
    { name: 'Topology', code: 'MA402', credits: 3, semester: 'Sem 5' },
    { name: 'Functional Analysis', code: 'MA403', credits: 3, semester: 'Sem 6' },
    { name: 'Number Theory', code: 'MA404', credits: 3, semester: 'Sem 6' },
    { name: 'Optimization', code: 'MA405', credits: 3, semester: 'Sem 5' },
    { name: 'Graph Theory', code: 'MA203', credits: 3, semester: 'Sem 3' },
    { name: 'Discrete Mathematics', code: 'MA204', credits: 3, semester: 'Sem 2' },
    { name: 'Statistics', code: 'MA303', credits: 3, semester: 'Sem 4' },
    { name: 'Mathematical Modeling', code: 'MA304', credits: 3, semester: 'Sem 6' },
  ],
  'Physics': [
    { name: 'Classical Mechanics', code: 'PH101', credits: 4, semester: 'Sem 1' },
    { name: 'Electrodynamics', code: 'PH102', credits: 4, semester: 'Sem 2' },
    { name: 'Quantum Mechanics', code: 'PH201', credits: 4, semester: 'Sem 3' },
    { name: 'Thermodynamics', code: 'PH202', credits: 3, semester: 'Sem 3' },
    { name: 'Statistical Mechanics', code: 'PH301', credits: 3, semester: 'Sem 4' },
    { name: 'Solid State Physics', code: 'PH302', credits: 4, semester: 'Sem 5' },
    { name: 'Nuclear Physics', code: 'PH401', credits: 3, semester: 'Sem 5' },
    { name: 'Optics', code: 'PH402', credits: 3, semester: 'Sem 4' },
    { name: 'Astrophysics', code: 'PH403', credits: 3, semester: 'Sem 6' },
    { name: 'Plasma Physics', code: 'PH404', credits: 3, semester: 'Sem 6' },
    { name: 'Particle Physics', code: 'PH405', credits: 3, semester: 'Sem 5' },
    { name: 'Mathematical Physics', code: 'PH203', credits: 3, semester: 'Sem 2' },
    { name: 'Electronics for Physics', code: 'PH204', credits: 3, semester: 'Sem 3' },
    { name: 'Spectroscopy', code: 'PH303', credits: 3, semester: 'Sem 4' },
    { name: 'Laser Physics', code: 'PH304', credits: 3, semester: 'Sem 6' },
  ],
  'Chemistry': [
    { name: 'Organic Chemistry I', code: 'CY101', credits: 4, semester: 'Sem 1' },
    { name: 'Inorganic Chemistry I', code: 'CY102', credits: 4, semester: 'Sem 1' },
    { name: 'Physical Chemistry', code: 'CY201', credits: 4, semester: 'Sem 3' },
    { name: 'Analytical Chemistry', code: 'CY202', credits: 3, semester: 'Sem 3' },
    { name: 'Organic Chemistry II', code: 'CY301', credits: 3, semester: 'Sem 4' },
    { name: 'Coordination Chemistry', code: 'CY302', credits: 3, semester: 'Sem 4' },
    { name: 'Polymer Chemistry', code: 'CY401', credits: 3, semester: 'Sem 5' },
    { name: 'Biochemistry', code: 'CY402', credits: 3, semester: 'Sem 5' },
    { name: 'Environmental Chemistry', code: 'CY403', credits: 3, semester: 'Sem 6' },
    { name: 'Industrial Chemistry', code: 'CY404', credits: 3, semester: 'Sem 6' },
    { name: 'Spectroscopic Methods', code: 'CY203', credits: 3, semester: 'Sem 3' },
    { name: 'Quantum Chemistry', code: 'CY204', credits: 3, semester: 'Sem 4' },
    { name: 'Nuclear Chemistry', code: 'CY405', credits: 3, semester: 'Sem 5' },
    { name: 'Medicinal Chemistry', code: 'CY303', credits: 3, semester: 'Sem 6' },
    { name: 'Surface Chemistry', code: 'CY304', credits: 3, semester: 'Sem 5' },
  ],
  'Commerce': [
    { name: 'Financial Accounting', code: 'CO101', credits: 4, semester: 'Sem 1' },
    { name: 'Business Economics', code: 'CO102', credits: 3, semester: 'Sem 1' },
    { name: 'Corporate Accounting', code: 'CO201', credits: 4, semester: 'Sem 3' },
    { name: 'Cost Accounting', code: 'CO202', credits: 3, semester: 'Sem 3' },
    { name: 'Business Law', code: 'CO301', credits: 3, semester: 'Sem 4' },
    { name: 'Taxation', code: 'CO302', credits: 3, semester: 'Sem 4' },
    { name: 'Auditing', code: 'CO401', credits: 3, semester: 'Sem 5' },
    { name: 'Financial Management', code: 'CO402', credits: 4, semester: 'Sem 5' },
    { name: 'Marketing Management', code: 'CO403', credits: 3, semester: 'Sem 6' },
    { name: 'Human Resource Mgmt', code: 'CO404', credits: 3, semester: 'Sem 6' },
    { name: 'Banking & Insurance', code: 'CO203', credits: 3, semester: 'Sem 3' },
    { name: 'E-Commerce', code: 'CO204', credits: 3, semester: 'Sem 4' },
    { name: 'International Business', code: 'CO405', credits: 3, semester: 'Sem 5' },
    { name: 'Entrepreneurship', code: 'CO303', credits: 3, semester: 'Sem 6' },
    { name: 'Business Statistics', code: 'CO304', credits: 3, semester: 'Sem 2' },
  ],
  'Arts': [
    { name: 'English Literature', code: 'AR101', credits: 3, semester: 'Sem 1' },
    { name: 'Political Science', code: 'AR102', credits: 3, semester: 'Sem 1' },
    { name: 'History of India', code: 'AR201', credits: 4, semester: 'Sem 3' },
    { name: 'Sociology', code: 'AR202', credits: 3, semester: 'Sem 3' },
    { name: 'Psychology', code: 'AR301', credits: 3, semester: 'Sem 4' },
    { name: 'Philosophy', code: 'AR302', credits: 3, semester: 'Sem 4' },
    { name: 'Public Administration', code: 'AR401', credits: 3, semester: 'Sem 5' },
    { name: 'Economics', code: 'AR402', credits: 4, semester: 'Sem 5' },
    { name: 'Journalism', code: 'AR403', credits: 3, semester: 'Sem 6' },
    { name: 'Cultural Studies', code: 'AR404', credits: 3, semester: 'Sem 6' },
    { name: 'Geography', code: 'AR203', credits: 3, semester: 'Sem 3' },
    { name: 'Anthropology', code: 'AR204', credits: 3, semester: 'Sem 4' },
    { name: 'Social Work', code: 'AR405', credits: 3, semester: 'Sem 5' },
    { name: 'Mass Communication', code: 'AR303', credits: 3, semester: 'Sem 6' },
    { name: 'Women Studies', code: 'AR304', credits: 3, semester: 'Sem 5' },
  ],
};

// ─── Name pools ───
const FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Reyansh', 'Mohammed', 'Sai', 'Arnav', 'Dhruv',
  'Kabir', 'Ritvik', 'Aadhya', 'Ananya', 'Avni', 'Diya', 'Ishita', 'Kiara', 'Myra', 'Prisha',
  'Saanvi', 'Aanya', 'Advait', 'Agastya', 'Ahaan', 'Ayaan', 'Darsh', 'Dev', 'Eshaan', 'Gaurav',
  'Harsh', 'Ishan', 'Jay', 'Karthik', 'Laksh', 'Manav', 'Neel', 'Om', 'Pranav', 'Rahul',
  'Rohan', 'Shaurya', 'Tanish', 'Utkarsh', 'Vedant', 'Yash', 'Zain', 'Aishwarya', 'Bhavya', 'Charvi',
  'Divya', 'Eva', 'Fatima', 'Gauri', 'Hansa', 'Isha', 'Jiya', 'Kavya', 'Lavanya', 'Meera',
  'Navya', 'Oviya', 'Pooja', 'Rhea', 'Sara', 'Tanvi', 'Uma', 'Vaani', 'Wafa', 'Yamini',
  'Zara', 'Abhinav', 'Bharat', 'Chirag', 'Deepak', 'Eshan', 'Faisal', 'Girish', 'Hemant', 'Indra',
  'Jai', 'Kunal', 'Lokesh', 'Mohit', 'Nikhil', 'Ojas', 'Parth', 'Qasim', 'Raj', 'Siddharth',
  'Tarun', 'Uday', 'Vikram', 'Waseem', 'Xavier', 'Yogesh', 'Zeeshan', 'Akash', 'Brijesh', 'Chandan',
];

const LAST_NAMES = [
  'Sharma', 'Verma', 'Patel', 'Singh', 'Kumar', 'Gupta', 'Reddy', 'Nair', 'Iyer', 'Choudhary',
  'Joshi', 'Mishra', 'Pandey', 'Saxena', 'Agarwal', 'Mehta', 'Shah', 'Desai', 'Rathore', 'Kapoor',
  'Malhotra', 'Khanna', 'Bhat', 'Hegde', 'Menon', 'Pillai', 'Rao', 'Murthy', 'Prasad', 'Das',
  'Sen', 'Bose', 'Roy', 'Dutta', 'Chatterjee', 'Banerjee', 'Mukherjee', 'Ghosh', 'Basu', 'Saha',
  'Thakur', 'Chauhan', 'Yadav', 'Tiwari', 'Dubey', 'Shukla', 'Tripathi', 'Srivastava', 'Bajaj', 'Arora',
];

const FACULTY_TITLES = ['Dr.', 'Prof.', 'Dr.', 'Prof.', 'Dr.']; // Weighted toward Dr.

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function genPhone() { return `+91${rand(7000000000, 9999999999)}`; }

// ═══════════════════════════════════════
// MAIN SEED FUNCTION
// ═══════════════════════════════════════
async function seed() {
  console.log('═══════════════════════════════════════════');
  console.log('  ChronoSync Database Seed Script');
  console.log('═══════════════════════════════════════════\n');

  const defaultPass = await bcrypt.hash('Test@1234', 12);

  // ────────────────────────────────────
  // 1. SEED CLASSROOMS (720 rooms)
  // ────────────────────────────────────
  console.log('🏫 Seeding classrooms...');
  const blockNames = Array.from({ length: 15 }, (_, i) => String.fromCharCode(65 + i)); // A-O
  const classroomRows = [];

  for (const block of blockNames) {
    let specialCount = { seminar: 0, auditorium: 0, lab: 0 };
    for (let floor = 0; floor < 6; floor++) {
      for (let room = 1; room <= 8; room++) {
        const roomNum = `${block}-${floor}${String(room).padStart(2, '0')}`;
        const capacity = rand(50, 70);
        let roomType = 'lecture';

        // Assign special types: 2 seminar, 1 auditorium, 7 labs per block
        if (specialCount.lab < 7 && floor < 2 && room <= 4) {
          roomType = 'lab';
          specialCount.lab++;
        } else if (specialCount.seminar < 2 && floor === 2 && room <= 2) {
          roomType = 'seminar';
          specialCount.seminar++;
        } else if (specialCount.auditorium < 1 && floor === 3 && room === 1) {
          roomType = 'auditorium';
          specialCount.auditorium++;
        }

        classroomRows.push({
          name: roomNum,
          building: `Block ${block}`,
          floor,
          capacity,
          room_type: roomType,
          has_projector: true,
          has_ac: roomType !== 'lecture' || Math.random() > 0.5,
          is_active: true,
        });
      }
    }
  }

  // Insert classrooms in batches of 100
  for (let i = 0; i < classroomRows.length; i += 100) {
    const batch = classroomRows.slice(i, i + 100);
    const { error } = await supabase.from('classrooms').insert(batch);
    if (error) console.error(`  ❌ Classroom batch ${i}: ${error.message}`);
  }
  console.log(`  ✅ ${classroomRows.length} classrooms created (15 blocks × 6 floors × 8 rooms)`);

  // ────────────────────────────────────
  // 2. SEED SUBJECTS
  // ────────────────────────────────────
  console.log('\n📚 Seeding subjects...');
  let totalSubjects = 0;
  const subjectIdMap = {}; // dept -> [subject_ids]

  for (const dept of DEPARTMENTS) {
    const deptSubjects = SUBJECTS[dept.name] || [];
    if (deptSubjects.length === 0) continue;

    const { data, error } = await supabase
      .from('subjects')
      .insert(deptSubjects.map(s => ({
        name: s.name,
        code: s.code,
        department: dept.name,
        credits: s.credits,
        semester: s.semester,
      })))
      .select('id');

    if (error) {
      console.error(`  ❌ ${dept.name} subjects: ${error.message}`);
    } else {
      subjectIdMap[dept.name] = (data || []).map(s => s.id);
      totalSubjects += deptSubjects.length;
    }
  }
  console.log(`  ✅ ${totalSubjects} subjects created across ${DEPARTMENTS.length} departments`);

  // ────────────────────────────────────
  // 3. SEED FACULTY (15 per dept = 195)
  // ────────────────────────────────────
  console.log('\n👩‍🏫 Seeding faculty...');
  let totalFaculty = 0;
  const usedEmails = new Set();
  const facultyIdMap = {}; // dept -> [faculty uuids]

  for (const dept of DEPARTMENTS) {
    const facultyRows = [];
    for (let f = 0; f < 15; f++) {
      const title = pick(FACULTY_TITLES);
      const first = pick(FIRST_NAMES);
      const last = pick(LAST_NAMES);
      const fullName = `${title} ${first} ${last}`;
      let email = `${first.toLowerCase()}.${last.toLowerCase()}.${dept.abbrev.toLowerCase()}@university.edu`;
      let counter = 1;
      while (usedEmails.has(email)) {
        email = `${first.toLowerCase()}.${last.toLowerCase()}${counter}.${dept.abbrev.toLowerCase()}@university.edu`;
        counter++;
      }
      usedEmails.add(email);

      const deptSubjects = SUBJECTS[dept.name] || [];
      const assignedSubjects = deptSubjects.slice(f, f + 3).map(s => s.name);
      if (assignedSubjects.length === 0 && deptSubjects.length > 0) {
        assignedSubjects.push(deptSubjects[f % deptSubjects.length].name);
      }

      facultyRows.push({
        user_id: `FAC2026${String(totalFaculty + f + 1).padStart(4, '0')}`,
        full_name: fullName,
        email,
        password_hash: defaultPass,
        role: 'faculty',
        department: dept.name,
        phone: genPhone(),
        subjects: assignedSubjects,
        is_first_login: false,
        is_active: true,
      });
    }

    const { data, error } = await supabase.from('users').insert(facultyRows).select('id');
    if (error) {
      console.error(`  ❌ ${dept.name} faculty: ${error.message}`);
    } else {
      facultyIdMap[dept.name] = (data || []).map(f => f.id);
      totalFaculty += 15;

      // Assign faculty_subjects
      const deptSubjectIds = subjectIdMap[dept.name] || [];
      if (deptSubjectIds.length > 0 && data) {
        const assignments = [];
        for (let fi = 0; fi < data.length; fi++) {
          // Each faculty gets 2-3 subjects
          const startIdx = fi % deptSubjectIds.length;
          for (let si = 0; si < Math.min(3, deptSubjectIds.length); si++) {
            const subjIdx = (startIdx + si) % deptSubjectIds.length;
            assignments.push({
              faculty_id: data[fi].id,
              subject_id: deptSubjectIds[subjIdx],
            });
          }
        }
        // Deduplicate
        const unique = [...new Map(assignments.map(a => [`${a.faculty_id}-${a.subject_id}`, a])).values()];
        const { error: aErr } = await supabase.from('faculty_subjects').insert(unique);
        if (aErr) console.error(`  ⚠️ ${dept.name} faculty_subjects: ${aErr.message}`);
      }
    }
  }
  console.log(`  ✅ ${totalFaculty} faculty created (15 per department)`);

  // ────────────────────────────────────
  // 4. SEED STUDENTS (150 per dept = 1950)
  // ────────────────────────────────────
  console.log('\n🎓 Seeding students...');
  let totalStudents = 0;

  for (const dept of DEPARTMENTS) {
    const studentRows = [];
    for (let s = 0; s < 150; s++) {
      const first = pick(FIRST_NAMES);
      const last = pick(LAST_NAMES);
      const fullName = `${first} ${last}`;
      let email = `${first.toLowerCase()}.${last.toLowerCase()}.${s + 1}@student.university.edu`;
      // Ensure unique per dept
      email = `${first.toLowerCase()}.${last.toLowerCase()}.${dept.abbrev.toLowerCase()}${s + 1}@student.university.edu`;

      const degree = dept.degrees[s % dept.degrees.length];
      const year = YEARS[s % YEARS.length];

      studentRows.push({
        user_id: `STU2026${String(totalStudents + s + 1).padStart(4, '0')}`,
        full_name: fullName,
        email,
        password_hash: defaultPass,
        role: 'student',
        department: dept.name,
        degree_course: degree,
        year,
        phone: genPhone(),
        is_first_login: false,
        is_active: true,
      });
    }

    // Insert in batches of 50
    for (let i = 0; i < studentRows.length; i += 50) {
      const batch = studentRows.slice(i, i + 50);
      const { error } = await supabase.from('users').insert(batch);
      if (error) {
        console.error(`  ❌ ${dept.name} students batch ${i}: ${error.message}`);
        break;
      }
    }
    totalStudents += 150;
    process.stdout.write(`  🎓 ${dept.name}: 150 students ✓\n`);
  }
  console.log(`  ✅ ${totalStudents} students created (150 per department)`);

  // ────────────────────────────────────
  // SUMMARY
  // ────────────────────────────────────
  console.log('\n═══════════════════════════════════════════');
  console.log('  ✅ SEED COMPLETE');
  console.log('═══════════════════════════════════════════');
  console.log(`  🎓 Students:   ${totalStudents}`);
  console.log(`  👩‍🏫 Faculty:    ${totalFaculty}`);
  console.log(`  📚 Subjects:   ${totalSubjects}`);
  console.log(`  🏫 Classrooms: ${classroomRows.length}`);
  console.log(`  🏢 Departments: ${DEPARTMENTS.length}`);
  console.log('');
  console.log('  Default password for all users: Test@1234');
  console.log('═══════════════════════════════════════════');
}

seed().catch(err => {
  console.error('Fatal seed error:', err);
  process.exit(1);
});
