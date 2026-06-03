CREATE TABLE IF NOT EXISTS devices (
  push_token TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  pet_name TEXT,
  owner_name TEXT,
  hunger INTEGER,
  happiness INTEGER,
  energy INTEGER,
  level INTEGER,
  streak_days INTEGER,
  last_active_at INTEGER NOT NULL,
  last_push_at INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_last_active ON devices (last_active_at);
CREATE INDEX IF NOT EXISTS idx_wallet ON devices (wallet);
