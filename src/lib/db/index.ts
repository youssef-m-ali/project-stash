import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { addDays, format } from 'date-fns';

const DB_PATH = path.join(process.cwd(), 'data', 'budget.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ────────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS budget_config (
    id             INTEGER PRIMARY KEY CHECK (id = 1),
    currency       TEXT    NOT NULL DEFAULT '$',
    schema_version INTEGER NOT NULL DEFAULT 3,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS income (
    id                  INTEGER PRIMARY KEY CHECK (id = 1),
    net_per_paycheck    REAL    NOT NULL,
    frequency           TEXT    NOT NULL DEFAULT 'biweekly',
    first_paycheck_date TEXT    NOT NULL,
    pay_day_of_week     INTEGER NOT NULL
  );

  -- Pre-computed paycheck dates; regenerated whenever income changes.
  -- Each fixed expense is assigned to the latest paycheck whose date
  -- is <= the expense's due date in the same calendar month.
  CREATE TABLE IF NOT EXISTS paychecks (
    id        TEXT PRIMARY KEY,  -- YYYY-MM-DD (the date itself)
    date      TEXT NOT NULL,
    month_key TEXT NOT NULL,     -- YYYY-MM
    amount    REAL NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_paychecks_month ON paychecks (month_key);

  CREATE TABLE IF NOT EXISTS fixed_expenses (
    id               TEXT    PRIMARY KEY,
    name             TEXT    NOT NULL,
    amount           REAL    NOT NULL,
    due_day_of_month INTEGER NOT NULL,
    category         TEXT    NOT NULL DEFAULT 'other',
    sort_order       INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS variable_expenses (
    id             TEXT    PRIMARY KEY,
    name           TEXT    NOT NULL,
    monthly_budget REAL    NOT NULL,
    is_cap         INTEGER NOT NULL DEFAULT 0,
    sort_order     INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id                TEXT    PRIMARY KEY,
    name              TEXT    NOT NULL,
    monthly_amount    REAL    NOT NULL,
    due_day_of_month  INTEGER NOT NULL DEFAULT 1,
    used_recently     INTEGER NOT NULL DEFAULT 1,
    marked_for_cancel INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS savings_goal (
    id          INTEGER PRIMARY KEY CHECK (id = 1),
    target_rate REAL    NOT NULL DEFAULT 0.2
  );

  CREATE TABLE IF NOT EXISTS savings_buckets (
    id                    TEXT    PRIMARY KEY,
    name                  TEXT    NOT NULL,
    percentage_of_savings REAL    NOT NULL,
    notes                 TEXT,
    sort_order            INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id              TEXT    PRIMARY KEY,
    label           TEXT    NOT NULL,
    kind            TEXT    NOT NULL DEFAULT 'chequing',
    is_pass_through INTEGER NOT NULL DEFAULT 0
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
    id          TEXT    PRIMARY KEY,
    pattern     TEXT    NOT NULL,
    category_id TEXT    NOT NULL,
    priority    INTEGER NOT NULL DEFAULT 100,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_rules_priority ON category_rules (priority ASC);
`);

// ── Paycheck generation ───────────────────────────────────────────────────────

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function regeneratePaychecks(
  firstPaycheckDate: string,
  netPerPaycheck: number,
  windowMonths = 24,
): void {
  const start = parseLocalDate(firstPaycheckDate);
  const end = new Date(start.getFullYear(), start.getMonth() + windowMonths, start.getDate());
  const insert = db.prepare(`
    INSERT OR REPLACE INTO paychecks (id, date, month_key, amount) VALUES (?, ?, ?, ?)
  `);
  db.transaction(() => {
    db.prepare('DELETE FROM paychecks').run();
    let cur = new Date(start);
    while (cur < end) {
      const date = format(cur, 'yyyy-MM-dd');
      insert.run(date, date, format(cur, 'yyyy-MM'), netPerPaycheck);
      cur = addDays(cur, 14);
    }
  })();
}

// ── One-time migration from monolithic budget_state blob ──────────────────────

function migrateBudgetStateBlob() {
  const tableExists = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='budget_state'`)
    .get();
  if (!tableExists) return;

  const row = db
    .prepare('SELECT data FROM budget_state WHERE id = 1')
    .get() as { data: string } | undefined;

  if (!row) {
    db.prepare('DROP TABLE budget_state').run();
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s: any = JSON.parse(row.data);

  db.transaction(() => {
    db.prepare(`
      INSERT OR IGNORE INTO budget_config (id, currency, schema_version, created_at, updated_at)
      VALUES (1, ?, 3, ?, ?)
    `).run(s.currency ?? '$', s.createdAt ?? new Date().toISOString(), s.updatedAt ?? new Date().toISOString());

    if (s.income) {
      db.prepare(`
        INSERT OR IGNORE INTO income (id, net_per_paycheck, frequency, first_paycheck_date, pay_day_of_week)
        VALUES (1, ?, ?, ?, ?)
      `).run(s.income.netPerPaycheck, s.income.frequency, s.income.firstPaycheckDate, s.income.payDayOfWeek);
    }

    for (let i = 0; i < (s.fixedExpenses ?? []).length; i++) {
      const e = s.fixedExpenses[i];
      db.prepare(`
        INSERT OR IGNORE INTO fixed_expenses (id, name, amount, due_day_of_month, category, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(e.id, e.name, e.amount, e.dueDayOfMonth, e.category, i);
    }

    for (let i = 0; i < (s.variableExpenses ?? []).length; i++) {
      const e = s.variableExpenses[i];
      db.prepare(`
        INSERT OR IGNORE INTO variable_expenses (id, name, monthly_budget, is_cap, sort_order)
        VALUES (?, ?, ?, ?, ?)
      `).run(e.id, e.name, e.monthlyBudget, e.isCap ? 1 : 0, i);
    }

    for (const sub of s.subscriptions ?? []) {
      db.prepare(`
        INSERT OR IGNORE INTO subscriptions (id, name, monthly_amount, used_recently, marked_for_cancel)
        VALUES (?, ?, ?, ?, ?)
      `).run(sub.id, sub.name, sub.monthlyAmount, sub.usedRecently ? 1 : 0, sub.markedForCancel ? 1 : 0);
    }

    if (s.savingsGoal) {
      db.prepare(`INSERT OR IGNORE INTO savings_goal (id, target_rate) VALUES (1, ?)`)
        .run(s.savingsGoal.targetRate);
      for (let i = 0; i < (s.savingsGoal.buckets ?? []).length; i++) {
        const b = s.savingsGoal.buckets[i];
        db.prepare(`
          INSERT OR IGNORE INTO savings_buckets (id, name, percentage_of_savings, notes, sort_order)
          VALUES (?, ?, ?, ?, ?)
        `).run(b.id, b.name, b.percentageOfSavings, b.notes ?? null, i);
      }
    }

    for (const a of s.accounts ?? []) {
      db.prepare(`
        INSERT OR IGNORE INTO accounts (id, label, kind, is_pass_through)
        VALUES (?, ?, ?, ?)
      `).run(a.id, a.label, a.kind, a.isPassThrough ? 1 : 0);
    }

    db.prepare('DROP TABLE budget_state').run();
  })();

  if (s.income) {
    regeneratePaychecks(s.income.firstPaycheckDate, s.income.netPerPaycheck);
  }
}

migrateBudgetStateBlob();

// Add due_day_of_month to subscriptions if upgrading an existing DB
const subCols = (db.prepare(`PRAGMA table_info(subscriptions)`).all() as { name: string }[]).map(r => r.name);
if (!subCols.includes('due_day_of_month')) {
  db.prepare(`ALTER TABLE subscriptions ADD COLUMN due_day_of_month INTEGER NOT NULL DEFAULT 1`).run();
}

export default db;
