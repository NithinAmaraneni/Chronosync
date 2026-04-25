const crypto = require('crypto');

/**
 * Generate a unique user ID
 * Format: PREFIX + YEAR + 4-digit random number
 * e.g., STU20260001, FAC20261234
 */
const generateUserId = (role) => {
  const prefix = role === 'student' ? 'STU' : 'FAC';
  const year = new Date().getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000); // 4-digit random
  return `${prefix}${year}${random}`;
};

/**
 * Generate a random OTP (8 characters, alphanumeric)
 */
const generateOTP = () => {
  return crypto.randomBytes(4).toString('hex').toUpperCase(); // 8-character hex
};

/**
 * Generate a secure random token for password resets
 */
const generateResetToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

module.exports = {
  generateUserId,
  generateOTP,
  generateResetToken,
};
