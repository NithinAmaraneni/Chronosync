const csvParser = require('csv-parser');
const { Readable } = require('stream');
const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');
const { generateUserId, generateOTP } = require('../utils/helpers');

// ─── Helper: Parse CSV buffer into rows ───
const parseCSV = (buffer) => {
  return new Promise((resolve, reject) => {
    const rows = [];
    const stream = Readable.from(buffer);
    stream
      .pipe(csvParser({ mapHeaders: ({ header }) => header.trim().toLowerCase().replace(/\s+/g, '_') }))
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', (err) => reject(err));
  });
};

// ═══════════════════════════════════════════
// BULK IMPORT STUDENTS via CSV
// Expected columns: full_name, email, degree_course, department, year, phone (optional)
// ═══════════════════════════════════════════
const bulkImportStudents = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No CSV file uploaded.' });

    const rows = await parseCSV(req.file.buffer);
    if (rows.length === 0) return res.status(400).json({ success: false, message: 'CSV file is empty.' });

    const results = { created: [], failed: [], total: rows.length };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const fullName = row.full_name || row.fullname || row.name || '';
      const email = row.email || '';
      const degreeCourse = row.degree_course || row.degree || row.course || '';
      const department = row.department || row.dept || '';
      const year = row.year || '';
      const phone = row.phone || row.phone_number || '';

      if (!fullName || !email) {
        results.failed.push({ row: i + 2, reason: 'Missing full_name or email', data: { fullName, email } });
        continue;
      }

      try {
        // Check duplicate email
        const { data: existing } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
        if (existing) {
          results.failed.push({ row: i + 2, reason: `Email already exists: ${email}`, data: { fullName, email } });
          continue;
        }

        // Generate ID + password
        let userId;
        let idExists = true;
        let attempts = 0;
        while (idExists && attempts < 10) {
          userId = generateUserId('student');
          const { data: check } = await supabase.from('users').select('id').eq('user_id', userId).maybeSingle();
          idExists = !!check;
          attempts++;
        }

        const otp = generateOTP();
        const hashedPassword = await bcrypt.hash(otp, 12);

        const { error } = await supabase.from('users').insert({
          user_id: userId,
          full_name: fullName,
          email,
          password: hashedPassword,
          role: 'student',
          degree_course: degreeCourse,
          department,
          year,
          phone: phone || null,
          is_first_login: true,
          is_active: true,
        });

        if (error) throw error;
        results.created.push({ row: i + 2, userId, fullName, email });
      } catch (err) {
        results.failed.push({ row: i + 2, reason: err.message, data: { fullName, email } });
      }
    }

    res.json({
      success: true,
      message: `Imported ${results.created.length} of ${results.total} students.`,
      results,
    });
  } catch (err) {
    console.error('Bulk import students error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════
// BULK IMPORT FACULTY via CSV
// Expected columns: full_name, email, department, subjects (comma-separated)
// ═══════════════════════════════════════════
const bulkImportFaculty = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No CSV file uploaded.' });

    const rows = await parseCSV(req.file.buffer);
    if (rows.length === 0) return res.status(400).json({ success: false, message: 'CSV file is empty.' });

    const results = { created: [], failed: [], total: rows.length };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const fullName = row.full_name || row.fullname || row.name || '';
      const email = row.email || '';
      const department = row.department || row.dept || '';
      const subjects = (row.subjects || '').split(',').map(s => s.trim()).filter(Boolean);

      if (!fullName || !email || !department) {
        results.failed.push({ row: i + 2, reason: 'Missing full_name, email, or department', data: { fullName, email } });
        continue;
      }

      try {
        const { data: existing } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
        if (existing) {
          results.failed.push({ row: i + 2, reason: `Email already exists: ${email}`, data: { fullName, email } });
          continue;
        }

        let userId;
        let idExists = true;
        let attempts = 0;
        while (idExists && attempts < 10) {
          userId = generateUserId('faculty');
          const { data: check } = await supabase.from('users').select('id').eq('user_id', userId).maybeSingle();
          idExists = !!check;
          attempts++;
        }

        const otp = generateOTP();
        const hashedPassword = await bcrypt.hash(otp, 12);

        const { error } = await supabase.from('users').insert({
          user_id: userId,
          full_name: fullName,
          email,
          password: hashedPassword,
          role: 'faculty',
          department,
          subjects: subjects.length > 0 ? subjects : null,
          is_first_login: true,
          is_active: true,
        });

        if (error) throw error;
        results.created.push({ row: i + 2, userId, fullName, email, subjects });
      } catch (err) {
        results.failed.push({ row: i + 2, reason: err.message, data: { fullName, email } });
      }
    }

    res.json({
      success: true,
      message: `Imported ${results.created.length} of ${results.total} faculty.`,
      results,
    });
  } catch (err) {
    console.error('Bulk import faculty error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════
// BULK IMPORT SUBJECTS via CSV
// Expected columns: name, code, department, credits (optional), semester (optional)
// ═══════════════════════════════════════════
const bulkImportSubjects = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No CSV file uploaded.' });

    const rows = await parseCSV(req.file.buffer);
    if (rows.length === 0) return res.status(400).json({ success: false, message: 'CSV file is empty.' });

    const results = { created: [], failed: [], total: rows.length };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name = row.name || row.subject_name || row.subject || '';
      const code = row.code || row.subject_code || '';
      const department = row.department || row.dept || '';
      const credits = parseInt(row.credits) || 3;
      const semester = row.semester || row.sem || null;

      if (!name || !code || !department) {
        results.failed.push({ row: i + 2, reason: 'Missing name, code, or department', data: { name, code } });
        continue;
      }

      try {
        const { data: existing } = await supabase.from('subjects').select('id').eq('code', code).maybeSingle();
        if (existing) {
          results.failed.push({ row: i + 2, reason: `Subject code already exists: ${code}`, data: { name, code } });
          continue;
        }

        const { error } = await supabase.from('subjects').insert({
          name,
          code,
          department,
          credits,
          semester,
        });

        if (error) throw error;
        results.created.push({ row: i + 2, name, code, department });
      } catch (err) {
        results.failed.push({ row: i + 2, reason: err.message, data: { name, code } });
      }
    }

    res.json({
      success: true,
      message: `Imported ${results.created.length} of ${results.total} subjects.`,
      results,
    });
  } catch (err) {
    console.error('Bulk import subjects error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════
// BULK IMPORT CLASSROOMS via CSV
// Expected columns: name, building (optional), floor (optional), capacity (optional), room_type (optional)
// ═══════════════════════════════════════════
const bulkImportClassrooms = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No CSV file uploaded.' });

    const rows = await parseCSV(req.file.buffer);
    if (rows.length === 0) return res.status(400).json({ success: false, message: 'CSV file is empty.' });

    const results = { created: [], failed: [], total: rows.length };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name = row.name || row.room_name || row.room || '';
      const building = row.building || null;
      const floor = parseInt(row.floor) || null;
      const capacity = parseInt(row.capacity) || 60;
      const room_type = row.room_type || row.type || 'lecture';
      const has_projector = ['true', 'yes', '1'].includes((row.has_projector || 'true').toLowerCase());
      const has_ac = ['true', 'yes', '1'].includes((row.has_ac || 'false').toLowerCase());

      if (!name) {
        results.failed.push({ row: i + 2, reason: 'Missing room name', data: { name } });
        continue;
      }

      try {
        const { data: existing } = await supabase.from('classrooms').select('id').eq('name', name).maybeSingle();
        if (existing) {
          results.failed.push({ row: i + 2, reason: `Classroom already exists: ${name}`, data: { name } });
          continue;
        }

        const { error } = await supabase.from('classrooms').insert({
          name,
          building,
          floor,
          capacity,
          room_type,
          has_projector,
          has_ac,
        });

        if (error) throw error;
        results.created.push({ row: i + 2, name, building, capacity });
      } catch (err) {
        results.failed.push({ row: i + 2, reason: err.message, data: { name } });
      }
    }

    res.json({
      success: true,
      message: `Imported ${results.created.length} of ${results.total} classrooms.`,
      results,
    });
  } catch (err) {
    console.error('Bulk import classrooms error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  bulkImportStudents,
  bulkImportFaculty,
  bulkImportSubjects,
  bulkImportClassrooms,
};
