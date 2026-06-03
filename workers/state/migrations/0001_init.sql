CREATE TABLE IF NOT EXISTS user_state (
  wallet TEXT PRIMARY KEY,
  state_json TEXT NOT NULL,
  version INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_state_updated_at ON user_state (updated_at);
