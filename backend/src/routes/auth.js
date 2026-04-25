const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

// Validation middleware
const loginValidation = [
  body('userId').notEmpty().withMessage('User ID or email is required.'),
  body('password').notEmpty().withMessage('Password is required.'),
];

const setPasswordValidation = [
  body('resetToken').notEmpty().withMessage('Reset token is required.'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters.')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])/)
    .withMessage('Password must contain uppercase, lowercase, number, and special character.'),
];

const forgotPasswordValidation = [
  body('email').isEmail().withMessage('Valid email is required.'),
];

const resetForgotPasswordValidation = [
  body('token').notEmpty().withMessage('Reset token is required.'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters.')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])/)
    .withMessage('Password must contain uppercase, lowercase, number, and special character.'),
];

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

// Routes
router.post('/login', loginValidation, validate, authController.login);
router.post('/set-password', setPasswordValidation, validate, authController.setNewPassword);
router.post('/forgot-password', forgotPasswordValidation, validate, authController.forgotPassword);
router.post('/reset-forgot-password', resetForgotPasswordValidation, validate, authController.resetForgotPassword);
router.get('/profile', authenticate, authController.getProfile);

module.exports = router;
