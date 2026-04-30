const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authenticate } = require('../middleware/auth');

// POST /api/chat/clear  — clear a conversation for the current user only
router.post('/clear', authenticate, async (req, res) => {
  try {
    const { other_user_id } = req.body;
    if (!other_user_id) {
      return res.status(400).json({ success: false, message: 'other_user_id is required.' });
    }

    // Resolve the current user's text ID (user_id column) from the users table
    const { data: me } = await supabase
      .from('users')
      .select('user_id')
      .eq('id', req.user.id)
      .single();

    const myUserId = me?.user_id || req.user.id;

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
