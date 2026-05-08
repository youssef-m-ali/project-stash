import type Database from '@tauri-apps/plugin-sql';

export async function createBaseSchema(db: Database): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS budget_config (
      id             INTEGER PRIMARY KEY CHECK (id = 1),
      currency       TEXT    NOT NULL DEFAULT '$',
      schema_version INTEGER NOT NULL DEFAULT 4
    )
  `, []);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS income (
      id                  INTEGER PRIMARY KEY CHECK (id = 1),
      net_per_paycheck    REAL    NOT NULL DEFAULT 0,
      frequency           TEXT    NOT NULL DEFAULT 'biweekly',
      first_paycheck_date TEXT    NOT NULL DEFAULT ''
    )
  `, []);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS accounts (
      id    TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      kind  TEXT NOT NULL DEFAULT 'chequing'
    )
  `, []);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS buckets (
      id                  TEXT    PRIMARY KEY,
      name                TEXT    NOT NULL,
      amount_per_paycheck REAL    NOT NULL DEFAULT 0,
      color               TEXT    NOT NULL DEFAULT '#6b7280',
      sort_order          INTEGER NOT NULL DEFAULT 0
    )
  `, []);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS paycheck_periods (
      id              TEXT PRIMARY KEY,
      start_date      TEXT NOT NULL,
      end_date        TEXT NOT NULL,
      paycheck_amount REAL NOT NULL
    )
  `, []);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_periods_start ON paycheck_periods (start_date)
  `, []);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS merchant_memory (
      merchant_key TEXT PRIMARY KEY,
      bucket_id    TEXT NOT NULL REFERENCES buckets(id) ON DELETE CASCADE,
      last_seen    TEXT NOT NULL DEFAULT (date('now')),
      count        INTEGER NOT NULL DEFAULT 1
    )
  `, []);
}

export async function createTransactionSchema(db: Database): Promise<void> {
  await db.execute(`
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
    )
  `, []);

  await db.execute(`CREATE INDEX IF NOT EXISTS idx_tx_date    ON transactions (date)`, []);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_tx_account ON transactions (account_id)`, []);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_tx_period  ON transactions (period_id)`, []);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_tx_status  ON transactions (status)`, []);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS subtransactions (
      id          TEXT PRIMARY KEY,
      tx_id       TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      amount      REAL NOT NULL,
      date        TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `, []);

  await db.execute(`CREATE INDEX IF NOT EXISTS idx_subtx_tx ON subtransactions (tx_id)`, []);
}

export async function createSupportingSchema(db: Database): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS account_csv_mappings (
      account_id  TEXT    PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
      date_col    INTEGER NOT NULL,
      desc_col    INTEGER NOT NULL,
      amount_col  INTEGER NOT NULL,
      flip_sign   INTEGER NOT NULL DEFAULT 0
    )
  `, []);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS merchant_exemptions (
      merchant_key TEXT PRIMARY KEY,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `, []);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS fixed_expenses (
      id               TEXT    PRIMARY KEY,
      name             TEXT    NOT NULL,
      amount           REAL    NOT NULL,
      due_day_of_month INTEGER NOT NULL CHECK (due_day_of_month BETWEEN 1 AND 31),
      emoji            TEXT,
      sort_order       INTEGER NOT NULL DEFAULT 0
    )
  `, []);
}
