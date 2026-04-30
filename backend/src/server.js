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
 * Ensure chat-related tables exist in Supabase
 */
const setupChatTables = async () => {
  // Verify the conversation_clears table exists by running a simple query
  const { error } = await supabase
    .from('conversation_clears')
    .select('id')
    .limit(1);

  if (error) {
    console.warn('⚠️  conversation_clears table not found.');
    console.warn('   Please run this in your Supabase SQL Editor:');
    console.warn(`   CREATE TABLE IF NOT EXISTS conversation_clears (
     id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
     user_id text NOT NULL,
     other_user_id text NOT NULL,
     cleared_at timestamptz DEFAULT now(),
     UNIQUE(user_id, other_user_id)
   );`);
  } else {
    console.log('✅ conversation_clears table ready');
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

  // Ensure chat tables exist
  await setupChatTables();

  const http = require('http');
  const { Server } = require('socket.io');
  const server = http.createServer(app);
  
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
    }
  });

  // Track connected users (in-memory is fine — only for routing live messages)
  const connectedUsers = new Map();

  io.on('connection', (socket) => {

    // ── Register user & send chat history from DB ──
    socket.on('register', async (userId) => {
      console.log(`[Socket] User registered: ${userId}`);
      connectedUsers.set(userId, socket.id);
      socket.join(userId);

      // Fetch this user's clear records (one per conversation partner)
      let clearMap = {};
      try {
        const { data: clears, error: clearError } = await supabase
          .from('conversation_clears')
          .select('other_user_id, cleared_at')
          .eq('user_id', userId);

        if (!clearError) {
          for (const c of (clears || [])) {
            clearMap[c.other_user_id] = c.cleared_at;
          }
        } else {
          console.warn('[Socket] conversation_clears table not found — run the SQL migration to enable persistent chat clearing.');
        }
      } catch (e) {
        console.warn('[Socket] Could not fetch conversation clears:', e.message);
      }

      // Fetch all messages for this user
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('timestamp', { ascending: true });

      if (error) {
        console.error('[Socket] Failed to fetch history:', error.message);
        socket.emit('history', []);
      } else {
        const history = (data || [])
          .filter(m => {
            // Determine conversation partner
            const partner = m.sender_id === userId ? m.receiver_id : m.sender_id;
            const clearedAt = clearMap[partner];
            // If user cleared this conversation, only show messages after the clear time
            if (clearedAt && new Date(m.timestamp) <= new Date(clearedAt)) return false;
            return true;
          })
          .map(m => ({
            id:         m.id,
            senderId:   m.sender_id,
            receiverId: m.receiver_id,
            text:       m.text,
            timestamp:  m.timestamp,
          }));
        socket.emit('history', history);
      }
    });

    // ── Save message to DB then broadcast ──
    socket.on('send_message', async (data) => {
      console.log(`[Socket] Message from ${data.senderId} to ${data.receiverId}: ${data.text}`);

      // Persist to Supabase
      const { data: saved, error } = await supabase
        .from('messages')
        .insert({
          sender_id:   data.senderId,
          receiver_id: data.receiverId,
          text:        data.text,
        })
        .select()
        .single();

      if (error) {
        console.error('[Socket] Failed to save message:', error.message);
        return;
      }

      const message = {
        id:         saved.id,
        senderId:   saved.sender_id,
        receiverId: saved.receiver_id,
        text:       saved.text,
        timestamp:  saved.timestamp,
      };

      // Broadcast to both sender and receiver rooms
      io.to(data.receiverId).emit('new_message', message);
      io.to(data.senderId).emit('new_message', message);
    });

    // ── Clean up on disconnect ──
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
