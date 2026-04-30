require('dotenv').config();

const app = require('./app');
const bcrypt = require('bcryptjs');
const supabase = require('./config/supabase');
const { verifyEmailConfig } = require('./config/email');
const { setEmailReady } = require('./services/emailService');

const PORT = process.env.PORT || 5001;

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

  const http = require('http');
  const { Server } = require('socket.io');
  const server = http.createServer(app);
  
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
    }
  });

  // Simple in-memory chat
  const connectedUsers = new Map();
  const messageHistory = [];

  io.on('connection', (socket) => {
    socket.on('register', (userId) => {
      console.log(`[Socket] User registered: ${userId}`);
      connectedUsers.set(userId, socket.id);
      socket.join(userId); 
      socket.emit('history', messageHistory.filter(m => m.senderId === userId || m.receiverId === userId));
    });

    socket.on('send_message', (data) => {
      console.log(`[Socket] Message from ${data.senderId} to ${data.receiverId}: ${data.text}`);
      const message = {
        id: Date.now().toString(),
        ...data,
        timestamp: new Date().toISOString()
      };
      messageHistory.push(message);
      
      io.to(data.receiverId).emit('new_message', message);
      io.to(data.senderId).emit('new_message', message);
    });

    socket.on('disconnect', () => {
      for (const [userId, socketId] of connectedUsers.entries()) {
        if (socketId === socket.id) {
          connectedUsers.delete(userId);
          break;
        }
      }
    });
  });

  server.listen(PORT, () => {
    console.log(`\n✅ Server running on http://localhost:${PORT}`);
    console.log(`📡 API base: http://localhost:${PORT}/api`);
    console.log(`💬 Chat active via Socket.IO`);
    console.log(`🏥 Health: http://localhost:${PORT}/api/health\n`);
  });
};

start();
