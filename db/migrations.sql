CREATE TABLE IF NOT EXISTS global_settings (
  id INTEGER PRIMARY KEY NOT NULL,
  resend_api_key TEXT,
  gemini_api_key TEXT,
  default_sender TEXT
);

INSERT OR IGNORE INTO global_settings (id, resend_api_key, gemini_api_key, default_sender)
VALUES (1, '', '', '');

CREATE TABLE IF NOT EXISTS config_set (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  schedule_cron TEXT NOT NULL,
  prompt TEXT NOT NULL,
  sources_json TEXT NOT NULL,
  recipients_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_config_set_enabled ON config_set(enabled);

CREATE TABLE IF NOT EXISTS run_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  config_set_id INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  status TEXT NOT NULL,
  item_count INTEGER NOT NULL,
  error_message TEXT,
  email_id TEXT,
  FOREIGN KEY (config_set_id) REFERENCES config_set(id)
);

CREATE INDEX IF NOT EXISTS idx_run_log_config_set_id ON run_log(config_set_id);

CREATE TABLE IF NOT EXISTS source (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('rss', 'api')),
  url TEXT NOT NULL,
  items_path TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_tested_at TEXT,
  last_test_status TEXT,
  last_test_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_source_enabled ON source(enabled);
CREATE INDEX IF NOT EXISTS idx_source_type ON source(type);

-- To apply these migrations to your D1 database using Wrangler, run:
-- wrangler d1 execute newsbot --file db/migrations.sql --remote