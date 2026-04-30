const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const ctrl = require('../controllers/facultyController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('faculty'));

router.get('/subjects', ctrl.getMySubjects);
router.get('/timetable', ctrl.getMyTimetable);

// Availability
router.get('/availability', ctrl.getAvailability);
router.post('/availability', [
  body('day').notEmpty().withMessage('Day is required.'),
  body('start_time').notEmpty().withMessage('Start time is required.'),
  body('end_time').notEmpty().withMessage('End time is required.'),
], ctrl.setAvailability);
router.delete('/availability/:id', ctrl.deleteAvailability);

// Leave
router.get('/leaves', ctrl.getLeaveRequests);
router.get('/leave-impact', ctrl.getLeaveImpact);
router.post('/leaves', [
  body('start_date').notEmpty().withMessage('Start date is required.'),
  body('end_date').notEmpty().withMessage('End date is required.'),
  body('reason').trim().notEmpty().withMessage('Reason is required.'),
], ctrl.applyLeave);

// Bookings
router.get('/bookings', ctrl.getMyBookings);
router.patch('/bookings/:id', [
] , ctrl.updateBookingStatus);

router.get('/students', ctrl.getStudents);

module.exports = router;
