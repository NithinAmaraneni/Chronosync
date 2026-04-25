require('dotenv').config();

const app = require('./app');
const bcrypt = require('bcryptjs');
const supabase = require('./config/supabase');
const { verifyEmailConfig } = require('./config/email');
const { setEmailReady } = require('./services/emailService');

const PORT = process.env.PORT || 5000;

/**
 * Seed the admin account if it doesn't exist
 */
const seedAdmin = async () => {
  try {
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'admin')
      .single();

    if (existing) {
      console.log('✅ Admin account already exists');
      return;
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(
      process.env.ADMIN_PASSWORD || 'Admin@12345',
      salt
    );

    const { error } = await supabase.from('users').insert({
      user_id: 'ADMIN001',
      email: process.env.ADMIN_EMAIL || 'admin@chronosync.com',
      full_name: 'System Administrator',
      password_hash: passwordHash,
      role: 'admin',
      is_first_login: false,
      is_active: true,
      email_verified: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error('❌ Failed to seed admin:', error.message);
    } else {
      console.log('✅ Admin account seeded successfully');
      console.log(`   Email: ${process.env.ADMIN_EMAIL || 'admin@chronosync.com'}`);
      console.log(`   Password: ${process.env.ADMIN_PASSWORD || 'Admin@12345'}`);
    }
  } catch (error) {
    console.error('❌ Admin seed error:', error.message);
  }
};

/**
 * Start server
 */
const start = async () => {
  console.log('\n🚀 Starting ChronoSync Backend...\n');

  // Verify email config
  const emailOk = await verifyEmailConfig();
  setEmailReady(emailOk);

  // Seed admin
  await seedAdmin();

  app.listen(PORT, () => {
    console.log(`\n✅ Server running on http://localhost:${PORT}`);
    console.log(`📡 API base: http://localhost:${PORT}/api`);
    console.log(`🏥 Health: http://localhost:${PORT}/api/health\n`);
  });
};

start();
