const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authenticate } = require('../middleware/auth');

const resolveCurrentUserId = async (userId) => {
  const { data: me, error } = await supabase
    .from('users')
    .select('user_id')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return me?.user_id || userId;
};

router.get('/status', authenticate, async (req, res) => {
  res.json({ success: true, connected: true });
});

router.get('/messages', authenticate, async (req, res) => {
  try {
    const { other_user_id } = req.query;
    if (!other_user_id) {
      return res.status(400).json({ success: false, message: 'other_user_id is required.' });
    }

    const myUserId = await resolveCurrentUserId(req.user.id);

    const { data: clear } = await supabase
      .from('conversation_clears')
      .select('cleared_at')
      .eq('user_id', myUserId)
      .eq('other_user_id', other_user_id)
      .maybeSingle();

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${myUserId},receiver_id.eq.${other_user_id}),and(sender_id.eq.${other_user_id},receiver_id.eq.${myUserId})`)
      .order('timestamp', { ascending: true });

    if (error) throw error;

    const clearedAt = clear?.cleared_at ? new Date(clear.cleared_at) : null;
    const messages = (data || [])
      .filter(m => !clearedAt || new Date(m.timestamp) > clearedAt)
      .map(m => ({
        id: m.id,
        senderId: m.sender_id,
        receiverId: m.receiver_id,
        text: m.text,
        timestamp: m.timestamp,
      }));

    res.json({ success: true, messages });
  } catch (err) {
    console.error('Get chat messages error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/messages', authenticate, async (req, res) => {
  try {
    const { receiver_id, text } = req.body;
    if (!receiver_id || !text?.trim()) {
      return res.status(400).json({ success: false, message: 'receiver_id and text are required.' });
    }

    const senderId = await resolveCurrentUserId(req.user.id);
    const { data, error } = await supabase
      .from('messages')
      .insert({
        sender_id: senderId,
        receiver_id,
        text: text.trim(),
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: {
        id: data.id,
        senderId: data.sender_id,
        receiverId: data.receiver_id,
        text: data.text,
        timestamp: data.timestamp,
      },
    });
  } catch (err) {
    console.error('Send chat message error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/chat/clear  — clear a conversation for the current user only
router.post('/clear', authenticate, async (req, res) => {
  try {
    const { other_user_id } = req.body;
    if (!other_user_id) {
      return res.status(400).json({ success: false, message: 'other_user_id is required.' });
    }

    const myUserId = await resolveCurrentUserId(req.user.id);

    // Upsert a clear timestamp for this pair
    const { error } = await supabase
      .from('conversation_clears')
      .upsert(
        { user_id: myUserId, other_user_id, cleared_at: new Date().toISOString() },
        { onConflict: 'user_id,other_user_id' }
      );

    if (error) throw error;

    return res.json({ success: true, message: 'Conversation cleared.' });
  } catch (err) {
    console.error('Clear conversation error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
