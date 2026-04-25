const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');
const { generateResetToken } = require('../utils/helpers');
const { sendResetEmail } = require('../services/emailService');

/**
 * Login handler for all roles
 */
const login = async (req, res) => {
  try {
    const { userId, password } = req.body;

    // Find user by user_id or email
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .or(`user_id.eq.${userId},email.eq.${userId}`)
      .maybeSingle();

    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.',
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Account has been deactivated. Contact admin.',
      });
    }

    // Check if first login — password field holds the hashed OTP
    if (user.is_first_login) {
      const otpMatch = await bcrypt.compare(password, user.otp);
      if (!otpMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid OTP. Please check your email for the correct one-time password.',
        });
      }

      // Return a special token for password reset
      const resetToken = jwt.sign(
        { id: user.id, user_id: user.user_id, role: user.role, purpose: 'otp_reset' },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );

      return res.status(200).json({
        success: true,
        isFirstLogin: true,
        message: 'OTP verified. Please set a new password.',
        resetToken,
        user: {
          id: user.id,
          userId: user.user_id,
          fullName: user.full_name,
          role: user.role,
        },
      });
    }

    // Normal login — compare password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.',
      });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        id: user.id,
        user_id: user.user_id,
        email: user.email,
        role: user.role,
        full_name: user.full_name,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return res.status(200).json({
      success: true,
      isFirstLogin: false,
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        userId: user.user_id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        department: user.department,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
};

/**
 * Set new password after first login OTP verification
 */
const setNewPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    // Verify the OTP reset token
    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired reset token. Please log in again with your OTP.',
      });
    }

    if (decoded.purpose !== 'otp_reset') {
      return res.status(400).json({
        success: false,
        message: 'Invalid token purpose.',
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Update user
    const { error } = await supabase
      .from('users')
      .update({
        password_hash: passwordHash,
        otp: null,
        is_first_login: false,
        email_verified: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', decoded.id);

    if (error) {
      console.error('Password update error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update password.',
      });
    }

    // Generate full JWT
    const token = jwt.sign(
      {
        id: decoded.id,
        user_id: decoded.user_id,
        role: decoded.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return res.status(200).json({
      success: true,
      message: 'Password set successfully. You are now logged in.',
      token,
    });
  } catch (error) {
    console.error('Set password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
};

/**
 * Request a forgot-password email
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, full_name')
      .eq('email', email)
      .single();

    // Don't reveal whether user exists
    if (error || !user) {
      return res.status(200).json({
        success: true,
        message: 'If an account with that email exists, a reset link has been sent.',
      });
    }

    const resetToken = generateResetToken();
    const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    await supabase
      .from('users')
      .update({
        reset_token: resetToken,
        reset_token_expiry: expiry,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    await sendResetEmail({
      email: user.email,
      fullName: user.full_name,
      resetToken,
    });

    return res.status(200).json({
      success: true,
      message: 'If an account with that email exists, a reset link has been sent.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
};

/**
 * Reset password using token from email
 */
const resetForgotPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const { data: user, error } = await supabase
      .from('users')
      .select('id, reset_token_expiry')
      .eq('reset_token', token)
      .single();

    if (error || !user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token.',
      });
    }

    if (new Date(user.reset_token_expiry) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Reset token has expired. Please request a new one.',
      });
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await supabase
      .from('users')
      .update({
        password_hash: passwordHash,
        reset_token: null,
        reset_token_expiry: null,
        is_first_login: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    return res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. You can now log in.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
};

/**
 * Get current user profile
 */
const getProfile = async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, user_id, email, full_name, role, department, degree_course, year, phone, subjects, is_active, email_verified, created_at')
      .eq('id', req.user.id)
      .single();

    if (error || !user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('Profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
};

module.exports = {
  login,
  setNewPassword,
  forgotPassword,
  resetForgotPassword,
  getProfile,
};
