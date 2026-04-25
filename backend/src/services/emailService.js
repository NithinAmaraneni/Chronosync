const { transporter } = require('../config/email');

let emailReady = false;

/**
 * Set email readiness status
 */
const setEmailReady = (status) => {
  emailReady = status;
};

/**
 * Send welcome email with credentials to newly created user
 */
const sendCredentialsEmail = async ({ email, fullName, userId, otp, role }) => {
  const loginUrl = `${process.env.FRONTEND_URL}/login`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
        .card { background: linear-gradient(135deg, #1e293b 0%, #334155 100%); border-radius: 16px; padding: 40px; border: 1px solid #475569; }
        .logo { text-align: center; margin-bottom: 30px; }
        .logo h1 { color: #818cf8; font-size: 28px; margin: 0; }
        .logo span { color: #06b6d4; }
        h2 { color: #f1f5f9; font-size: 22px; margin-bottom: 10px; }
        .credentials { background: #0f172a; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #818cf8; }
        .credentials p { margin: 8px 0; font-size: 15px; }
        .credentials strong { color: #818cf8; }
        .credentials code { background: #1e293b; padding: 4px 10px; border-radius: 6px; color: #06b6d4; font-size: 16px; letter-spacing: 1px; }
        .btn { display: inline-block; background: linear-gradient(135deg, #818cf8, #06b6d4); color: #0f172a !important; text-decoration: none; padding: 14px 36px; border-radius: 10px; font-weight: 700; font-size: 16px; margin-top: 20px; }
        .warning { background: #451a03; border: 1px solid #92400e; border-radius: 8px; padding: 16px; margin-top: 24px; color: #fbbf24; font-size: 14px; }
        .footer { text-align: center; margin-top: 32px; color: #64748b; font-size: 13px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="logo">
            <h1>Chrono<span>Sync</span></h1>
          </div>
          <h2>Welcome, ${fullName}! 🎉</h2>
          <p style="color: #94a3b8;">Your ${role} account has been created on ChronoSync. Use the credentials below to log in for the first time.</p>
          
          <div class="credentials">
            <p><strong>Login ID:</strong> <code>${userId}</code></p>
            <p><strong>One-Time Password:</strong> <code>${otp}</code></p>
            <p><strong>Role:</strong> ${role.charAt(0).toUpperCase() + role.slice(1)}</p>
          </div>
          
          <p style="color: #94a3b8;">On your first login, you will be prompted to set a new password.</p>
          
          <div style="text-align: center;">
            <a href="${loginUrl}" class="btn">Login to ChronoSync →</a>
          </div>
          
          <div class="warning">
            ⚠️ <strong>Important:</strong> This is a one-time password. It will become invalid after you set your new password. Do not share these credentials with anyone.
          </div>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} ChronoSync — Streamlining Academic Schedules</p>
        </div>
      </div>
    </body>
    </html>
  `;

  if (emailReady) {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: `Welcome to ChronoSync — Your ${role} Account Credentials`,
      html,
    });
    console.log(`📧 Credentials email sent to ${email}`);
  } else {
    console.log('\n' + '='.repeat(60));
    console.log('📧 EMAIL (console fallback — email service not configured)');
    console.log('='.repeat(60));
    console.log(`To: ${email}`);
    console.log(`Subject: Welcome to ChronoSync — Your ${role} Account`);
    console.log(`User ID: ${userId}`);
    console.log(`OTP: ${otp}`);
    console.log('='.repeat(60) + '\n');
  }
};

/**
 * Send password reset email
 */
const sendResetEmail = async ({ email, fullName, resetToken }) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
        .card { background: linear-gradient(135deg, #1e293b 0%, #334155 100%); border-radius: 16px; padding: 40px; border: 1px solid #475569; }
        .logo { text-align: center; margin-bottom: 30px; }
        .logo h1 { color: #818cf8; font-size: 28px; margin: 0; }
        .logo span { color: #06b6d4; }
        h2 { color: #f1f5f9; font-size: 22px; }
        .btn { display: inline-block; background: linear-gradient(135deg, #818cf8, #06b6d4); color: #0f172a !important; text-decoration: none; padding: 14px 36px; border-radius: 10px; font-weight: 700; font-size: 16px; margin-top: 20px; }
        .footer { text-align: center; margin-top: 32px; color: #64748b; font-size: 13px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="logo">
            <h1>Chrono<span>Sync</span></h1>
          </div>
          <h2>Password Reset Request</h2>
          <p style="color: #94a3b8;">Hi ${fullName}, we received a request to reset your password. Click the button below to set a new password.</p>
          <div style="text-align: center;">
            <a href="${resetUrl}" class="btn">Reset Password →</a>
          </div>
          <p style="color: #64748b; margin-top: 24px; font-size: 14px;">This link expires in 1 hour. If you didn't request this, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} ChronoSync — Streamlining Academic Schedules</p>
        </div>
      </div>
    </body>
    </html>
  `;

  if (emailReady) {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'ChronoSync — Password Reset Request',
      html,
    });
    console.log(`📧 Password reset email sent to ${email}`);
  } else {
    console.log('\n' + '='.repeat(60));
    console.log('📧 RESET EMAIL (console fallback)');
    console.log('='.repeat(60));
    console.log(`To: ${email}`);
    console.log(`Reset URL: ${resetUrl}`);
    console.log('='.repeat(60) + '\n');
  }
};

module.exports = {
  sendCredentialsEmail,
  sendResetEmail,
  setEmailReady,
};
