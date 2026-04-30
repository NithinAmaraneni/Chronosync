CREATE TABLE IF NOT EXISTS messages (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id   text NOT NULL,
  receiver_id text NOT NULL,
  text        text NOT NULL,
  timestamp   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_sender   ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
