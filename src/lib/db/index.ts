import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { addDays, format } from 'date-fns';

const DB_PATH = path.join(process.cwd(), 'data', 'budget.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Safe base tables (no period_id dependency) ────────────────────────────────
// These are safe to create before migration because they don't depend on any
// columns that might change between schema versions.

db.exec(`
  CREATE TABLE IF NOT EXISTS budget_config (
    id             INTEGER PRIMARY KEY CHECK (id = 1),
    currency       TEXT    NOT NULL DEFAULT '$',
    schema_version INTEGER NOT NULL DEFAULT 4
  );

  CREATE TABLE IF NOT EXISTS income (
    id                  INTEGER PRIMARY KEY CHECK (id = 1),
    net_per_paycheck    REAL    NOT NULL DEFAULT 0,
    frequency           TEXT    NOT NULL DEFAULT 'biweekly',
    first_paycheck_date TEXT    NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id              TEXT    PRIMARY KEY,
    label           TEXT    NOT NULL,
    kind            TEXT    NOT NULL DEFAULT 'chequing',
    is_pass_through INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS buckets (
    id                  TEXT    PRIMARY KEY,
    name                TEXT    NOT NULL,
    amount_per_paycheck REAL    NOT NULL DEFAULT 0,
    color               TEXT    NOT NULL DEFAULT '#6b7280',
    sort_order          INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS paycheck_periods (
    id              TEXT PRIMARY KEY,
    start_date      TEXT NOT NULL,
    end_date        TEXT NOT NULL,
    paycheck_amount REAL NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_periods_start ON paycheck_periods (start_date);

  CREATE TABLE IF NOT EXISTS merchant_memory (
    merchant_key TEXT PRIMARY KEY,
    bucket_id    TEXT NOT NULL REFERENCES buckets(id) ON DELETE CASCADE,
    last_seen    TEXT NOT NULL DEFAULT (date('now')),
    count        INTEGER NOT NULL DEFAULT 1
  );
`);

// ── Migration from v3 → v4 ────────────────────────────────────────────────────
// Must run BEFORE creating transactions table (which needs period_id column).

function migrateToV4() {
  const cfg = db
    .prepare('SELECT schema_version FROM budget_config WHERE id = 1')
    .get() as { schema_version: number } | undefined;

  if (cfg && cfg.schema_version >= 4) return; // already v4

  // Recreate transactions with new schema, preserving existing rows
  const txTableExists = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='transactions'`)
    .get();

  if (txTableExists) {
    const cols = (
      db.prepare('PRAGMA table_info(transactions)').all() as { name: string }[]
    ).map(r => r.name);

    if (cols.includes('month_key')) {
      // Old v3 schema — recreate without month_key/category_id/ignore_reason,
      // and add bucket_id/period_id. Map old 'active' status → 'pending'.
      db.prepare(`DROP TABLE IF EXISTS transactions_v4`).run();
      db.prepare(`
        CREATE TABLE transactions_v4 (
          id          TEXT PRIMARY KEY,
          account_id  TEXT NOT NULL,
          date        TEXT NOT NULL,
          description TEXT NOT NULL,
          amount      REAL NOT NULL,
          raw_amount  REAL NOT NULL,
          bucket_id   TEXT,
          period_id   TEXT,
          status      TEXT NOT NULL DEFAULT 'pending',
          imported_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `).run();
      db.prepare(`
        INSERT OR IGNORE INTO transactions_v4
          (id, account_id, date, description, amount, raw_amount, status, imported_at)
        SELECT id, account_id, date, description, amount, raw_amount,
               CASE status WHEN 'ignored' THEN 'ignored' ELSE 'pending' END,
               imported_at
        FROM transactions
      `).run();
      db.prepare(`DROP TABLE transactions`).run();
      db.prepare(`ALTER TABLE transactions_v4 RENAME TO transactions`).run();
    }
  }

  // Remove income.pay_day_of_week if present
  const incomeTableExists = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='income'`)
    .get();
  if (incomeTableExists) {
    const incomeCols = (
      db.prepare('PRAGMA table_info(income)').all() as { name: string }[]
    ).map(r => r.name);
    if (incomeCols.includes('pay_day_of_week')) {
      db.prepare(`CREATE TABLE income_v4 (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        net_per_paycheck REAL NOT NULL DEFAULT 0,
        frequency TEXT NOT NULL DEFAULT 'biweekly',
        first_paycheck_date TEXT NOT NULL DEFAULT ''
      )`).run();
      db.prepare(`
        INSERT OR IGNORE INTO income_v4 (id, net_per_paycheck, frequency, first_paycheck_date)
        SELECT id, net_per_paycheck, frequency, first_paycheck_date FROM income
      `).run();
      db.prepare(`DROP TABLE income`).run();
      db.prepare(`ALTER TABLE income_v4 RENAME TO income`).run();
    }
  }

  // Remove legacy budget_config columns
  const cfgCols = (
    db.prepare('PRAGMA table_info(budget_config)').all() as { name: string }[]
  ).map(r => r.name);
  if (cfgCols.includes('created_at')) {
    db.prepare(`CREATE TABLE budget_config_v4 (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      currency TEXT NOT NULL DEFAULT '$',
      schema_version INTEGER NOT NULL DEFAULT 4
    )`).run();
    db.prepare(`
      INSERT OR IGNORE INTO budget_config_v4 (id, currency, schema_version)
      SELECT id, currency, 4 FROM budget_config
    `).run();
    db.prepare(`DROP TABLE budget_config`).run();
    db.prepare(`ALTER TABLE budget_config_v4 RENAME TO budget_config`).run();
  } else if (cfg) {
    db.prepare('UPDATE budget_config SET schema_version = 4 WHERE id = 1').run();
  }

  // Drop obsolete v3 tables
  for (const tbl of [
    'fixed_expenses', 'variable_expenses', 'subscriptions',
    'savings_goal', 'savings_buckets', 'category_rules', 'actuals', 'paychecks',
    'budget_state',
  ]) {
    db.prepare(`DROP TABLE IF EXISTS ${tbl}`).run();
  }

  // Drop obsolete indexes
  for (const idx of ['idx_paychecks_month', 'idx_rules_priority', 'idx_tx_month']) {
    db.prepare(`DROP INDEX IF EXISTS ${idx}`).run();
  }
}

migrateToV4();

// ── Transactions table and indexes (AFTER migration) ──────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id          TEXT PRIMARY KEY,
    account_id  TEXT NOT NULL REFERENCES accounts(id),
    date        TEXT NOT NULL,
    description TEXT NOT NULL,
    amount      REAL NOT NULL,
    raw_amount  REAL NOT NULL,
    bucket_id   TEXT REFERENCES buckets(id) ON DELETE SET NULL,
    period_id   TEXT REFERENCES paycheck_periods(id) ON DELETE SET NULL,
    status      TEXT NOT NULL DEFAULT 'pending',
    imported_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_tx_date    ON transactions (date);
  CREATE INDEX IF NOT EXISTS idx_tx_account ON transactions (account_id);
  CREATE INDEX IF NOT EXISTS idx_tx_period  ON transactions (period_id);
  CREATE INDEX IF NOT EXISTS idx_tx_status  ON transactions (status);

  -- Each subtransaction belongs to exactly one parent transaction.
  -- amount follows the same sign convention as transactions:
  --   negative = credit back to you (the common case: reimbursements, splits)
  --   positive = rare additional charge against the same bucket
  -- No nesting: subtransactions cannot have subtransactions.
  CREATE TABLE IF NOT EXISTS subtransactions (
    id          TEXT PRIMARY KEY,
    tx_id       TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount      REAL NOT NULL,
    date        TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_subtx_tx ON subtransactions (tx_id);
`);

// ── Additive column migrations (safe to run every boot) ──────────────────────

(function addMissingColumns() {
  const bucketCols = (db.prepare('PRAGMA table_info(buckets)').all() as { name: string }[]).map(r => r.name);
  if (!bucketCols.includes('emoji')) {
    db.prepare('ALTER TABLE buckets ADD COLUMN emoji TEXT').run();
  }
})();

// ── Period generation ─────────────────────────────────────────────────────────

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function regeneratePeriods(
  firstPaycheckDate: string,
  netPerPaycheck: number,
  windowMonths = 24,
): void {
  const start = parseLocalDate(firstPaycheckDate);
  const end = new Date(start.getFullYear(), start.getMonth() + windowMonths, start.getDate());
  const insert = db.prepare(`
    INSERT OR REPLACE INTO paycheck_periods (id, start_date, end_date, paycheck_amount)
    VALUES (?, ?, ?, ?)
  `);
  db.transaction(() => {
    db.prepare('DELETE FROM paycheck_periods').run();
    let cur = new Date(start);
    while (cur < end) {
      const startDate = format(cur, 'yyyy-MM-dd');
      const endDate = format(addDays(cur, 13), 'yyyy-MM-dd');
      insert.run(startDate, startDate, endDate, netPerPaycheck);
      cur = addDays(cur, 14);
    }
  })();

  assignPeriodsToTransactions();
}

export function assignPeriodsToTransactions(): void {
  db.prepare(`
    UPDATE transactions
    SET period_id = (
      SELECT id FROM paycheck_periods
      WHERE start_date <= transactions.date AND transactions.date <= end_date
      LIMIT 1
    )
    WHERE period_id IS NULL
  `).run();
}

export default db;
