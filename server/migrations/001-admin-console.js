export function migrateAdminConsole(db) {
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)");
  if (db.prepare("SELECT 1 FROM schema_migrations WHERE version = 1").get()) return;
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(`
      ALTER TABLE agent_accounts ADD COLUMN role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin'));
      ALTER TABLE agent_accounts ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'disabled'));
      ALTER TABLE agent_accounts ADD COLUMN last_login_at TEXT;
      CREATE TABLE service_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        occurred_at TEXT NOT NULL,
        route TEXT NOT NULL,
        method TEXT NOT NULL,
        task TEXT NOT NULL DEFAULT '',
        status INTEGER NOT NULL,
        duration_ms REAL NOT NULL,
        user_id TEXT REFERENCES agent_accounts(user_id) ON DELETE SET NULL,
        provider TEXT,
        model TEXT,
        input_tokens INTEGER,
        output_tokens INTEGER
      );
      CREATE INDEX idx_service_requests_time ON service_requests(occurred_at DESC);
      CREATE INDEX idx_service_requests_user_time ON service_requests(user_id, occurred_at DESC);
      CREATE TABLE admin_audit_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        occurred_at TEXT NOT NULL,
        actor_id TEXT REFERENCES agent_accounts(user_id) ON DELETE SET NULL,
        action TEXT NOT NULL,
        target_id TEXT REFERENCES agent_accounts(user_id) ON DELETE SET NULL,
        detail TEXT NOT NULL DEFAULT ''
      );
      CREATE INDEX idx_admin_audit_time ON admin_audit_events(occurred_at DESC);
    `);
    db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (1, ?)").run(new Date().toISOString());
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
