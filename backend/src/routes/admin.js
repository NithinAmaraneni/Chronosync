const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');

// All admin routes require auth + admin role
router.use(authenticate, authorize('admin'));

// Validation error handler
const validate = (req, res, next) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed.',
      errors: errors.array().map((e) => e.msg),
    });
  }
  next();
};

// Create student validation
const createStudentValidation = [
  body('fullName').trim().notEmpty().withMessage('Full name is required.'),
  body('email').isEmail().withMessage('Valid email is required.'),
  body('degreeCourse').trim().notEmpty().withMessage('Degree/Course is required.'),
  body('department').trim().notEmpty().withMessage('Department is required.'),
  body('year').trim().notEmpty().withMessage('Year is required.'),
  body('phone').optional({ checkFalsy: true }).isMobilePhone('any').withMessage('Valid phone number is required.'),
];

// Create faculty validation
const createFacultyValidation = [
  body('fullName').trim().notEmpty().withMessage('Full name is required.'),
  body('email').isEmail().withMessage('Valid email is required.'),
  body('department').trim().notEmpty().withMessage('Department is required.'),
  body('subjects').notEmpty().withMessage('At least one subject is required.'),
];

// Routes
router.get('/analytics', adminController.getAnalytics);
router.post('/students', createStudentValidation, validate, adminController.createStudent);
router.post('/faculty', createFacultyValidation, validate, adminController.createFaculty);
router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUserById);
router.delete('/users/:id', adminController.deactivateUser);
router.get('/activity-logs', adminController.getActivityLogs);

// Subjects
router.get('/subjects', adminController.getSubjects);
router.post('/subjects', [
  body('name').trim().notEmpty().withMessage('Subject name is required.'),
  body('code').trim().notEmpty().withMessage('Subject code is required.'),
  body('department').trim().notEmpty().withMessage('Department is required.'),
], validate, adminController.createSubject);
router.post('/assign-subject', [
  body('faculty_id').notEmpty(),
  body('subject_id').notEmpty(),
], validate, adminController.assignSubject);

// Timetable
router.get('/timetable', adminController.getTimetableSlots);
router.post('/timetable', [
  body('subject_id').notEmpty(),
  body('faculty_id').notEmpty(),
  body('department').notEmpty(),
  body('day').notEmpty(),
  body('start_time').notEmpty(),
  body('end_time').notEmpty(),
], validate, adminController.createTimetableSlot);

// Leave management
router.get('/leaves', adminController.getLeaveRequests);
router.patch('/leaves/:id', [
  body('status').isIn(['approved', 'rejected']),
], validate, adminController.updateLeaveStatus);

// ── CSV Bulk Import ──
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const csvCtrl = require('../controllers/csvImportController');

router.post('/import/students', upload.single('file'), csvCtrl.bulkImportStudents);
router.post('/import/faculty', upload.single('file'), csvCtrl.bulkImportFaculty);
router.post('/import/subjects', upload.single('file'), csvCtrl.bulkImportSubjects);
router.post('/import/classrooms', upload.single('file'), csvCtrl.bulkImportClassrooms);

module.exports = router;
