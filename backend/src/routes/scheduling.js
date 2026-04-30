const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const ctrl = require('../controllers/schedulingController');
const { authenticate, authorize } = require('../middleware/auth');

// All scheduling routes are admin-only
router.use(authenticate, authorize('admin'));

// ── Classrooms ──
router.get('/classrooms', ctrl.getClassrooms);
router.post('/classrooms', [
  body('name').trim().notEmpty().withMessage('Room name is required.'),
], ctrl.createClassroom);
router.patch('/classrooms/:id', [
  body('name').trim().notEmpty().withMessage('Room name is required.'),
], ctrl.updateClassroom);
router.delete('/classrooms/:id', ctrl.deleteClassroom);

// ── Time slot templates ──
router.get('/time-slots', ctrl.getTimeSlots);
router.post('/time-slots', [
  body('slot_number').isInt({ min: 1 }).withMessage('Slot number is required.'),
  body('start_time').notEmpty().withMessage('Start time is required.'),
  body('end_time').notEmpty().withMessage('End time is required.'),
], ctrl.upsertTimeSlot);
router.delete('/time-slots/:id', ctrl.deleteTimeSlot);

// ── Constraints ──
router.get('/constraints', ctrl.getConstraints);
router.post('/constraints', [
  body('constraint_type').notEmpty().withMessage('Constraint type is required.'),
], ctrl.createConstraint);
router.patch('/constraints/:id', [
  body('constraint_type').notEmpty().withMessage('Constraint type is required.'),
], ctrl.updateConstraint);
router.delete('/constraints/:id', ctrl.deleteConstraint);

// ── AI Generation ──
router.post('/generate', [
  body('department').trim().notEmpty().withMessage('Department is required.'),
], ctrl.triggerGeneration);
router.post('/finalize', [
  body('generationId').notEmpty().withMessage('generationId is required.'),
  body('candidateId').notEmpty().withMessage('candidateId is required.'),
], ctrl.finalizeGenerationCandidate);
router.get('/history', ctrl.getGenerationHistory);
router.get('/history/:id', ctrl.getGenerationDetail);
router.get('/config', ctrl.getAlgorithmConfig);

// ── Conflict Detection & Rescheduling ──
router.get('/conflicts', ctrl.getConflicts);
router.post('/auto-fix', ctrl.triggerAutoFix);
router.post('/reschedule', ctrl.triggerSmartReschedule);

// ── Event Triggers ──
router.post('/event/leave', ctrl.triggerLeaveEvent);
router.post('/event/room', ctrl.triggerRoomEvent);
router.post('/event/subject', ctrl.triggerSubjectEvent);

module.exports = router;
