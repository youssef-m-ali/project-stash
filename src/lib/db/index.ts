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
`);

export default db;
