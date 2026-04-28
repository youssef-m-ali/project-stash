import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'budget.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

// Module-level singleton — safe for the single-process local dev server.
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS budget_state (
    id    INTEGER PRIMARY KEY CHECK (id = 1),
    data  TEXT    NOT NULL,
    saved TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS actuals (
    month_key TEXT PRIMARY KEY,
    data      TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id            TEXT PRIMARY KEY,
    account_id    TEXT NOT NULL,
    date          TEXT NOT NULL,
    month_key     TEXT NOT NULL,
    description   TEXT NOT NULL,
    amount        REAL NOT NULL,
    raw_amount    REAL NOT NULL,
    category_id   TEXT,
    status        TEXT NOT NULL DEFAULT 'active',
    ignore_reason TEXT,
    imported_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_tx_month   ON transactions (month_key);
  CREATE INDEX IF NOT EXISTS idx_tx_account ON transactions (account_id);

  CREATE TABLE IF NOT EXISTS category_rules (
    id          TEXT PRIMARY KEY,
    pattern     TEXT NOT NULL,
    category_id TEXT NOT NULL,
    priority    INTEGER NOT NULL DEFAULT 100,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_rules_priority ON category_rules (priority ASC);
`);

export default db;
