const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const ctrl = require('../controllers/studentController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('student'));

router.get('/timetable', ctrl.getMyTimetable);
router.get('/faculty', ctrl.getFacultyList);
router.get('/faculty-slots', ctrl.getFacultySlots);

// Bookings
router.get('/bookings', ctrl.getMyBookings);
router.post('/bookings', [
  body('faculty_id').notEmpty().withMessage('Faculty is required.'),
  body('date').notEmpty().withMessage('Date is required.'),
  body('start_time').notEmpty().withMessage('Start time is required.'),
  body('end_time').notEmpty().withMessage('End time is required.'),
  body('purpose').isIn(['counseling', 'meeting', 'doubt_clearing', 'project_review', 'other']),
], ctrl.bookSlot);
router.patch('/bookings/:id/cancel', ctrl.cancelBooking);

module.exports = router;
