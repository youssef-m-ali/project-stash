import type Database from '@tauri-apps/plugin-sql';

export async function runMigrations(db: Database): Promise<void> {
  await migrateToV4(db);
  await addMissingColumns(db);
}

async function migrateToV4(db: Database): Promise<void> {
  const cfgRows = await db.select<{ schema_version: number }[]>(
    'SELECT schema_version FROM budget_config WHERE id = 1',
    [],
  );
  if (cfgRows.length > 0 && cfgRows[0].schema_version >= 4) return;

  // ── Transactions table: v3 → v4 ────────────────────────────────────────────
  const txExists = await db.select<{ name: string }[]>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='transactions'`,
    [],
  );

  if (txExists.length > 0) {
    const cols = await db.select<{ name: string }[]>('PRAGMA table_info(transactions)', []);
    const colNames = cols.map(r => r.name);

    if (colNames.includes('month_key')) {
      await db.execute(`DROP TABLE IF EXISTS transactions_v4`, []);
      await db.execute(`
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
      `, []);
      await db.execute(`
        INSERT OR IGNORE INTO transactions_v4
          (id, account_id, date, description, amount, raw_amount, status, imported_at)
        SELECT id, account_id, date, description, amount, raw_amount,
               CASE status WHEN 'ignored' THEN 'ignored' ELSE 'pending' END,
               imported_at
        FROM transactions
      `, []);
      await db.execute(`DROP TABLE transactions`, []);
      await db.execute(`ALTER TABLE transactions_v4 RENAME TO transactions`, []);
    }
  }

  // ── Income table: remove pay_day_of_week ───────────────────────────────────
  const incomeExists = await db.select<{ name: string }[]>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='income'`,
    [],
  );

  if (incomeExists.length > 0) {
    const incomeCols = await db.select<{ name: string }[]>('PRAGMA table_info(income)', []);
    const incomeColNames = incomeCols.map(r => r.name);

    if (incomeColNames.includes('pay_day_of_week')) {
      await db.execute(`
        CREATE TABLE income_v4 (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          net_per_paycheck REAL NOT NULL DEFAULT 0,
          frequency TEXT NOT NULL DEFAULT 'biweekly',
          first_paycheck_date TEXT NOT NULL DEFAULT ''
        )
      `, []);
      await db.execute(`
        INSERT OR IGNORE INTO income_v4 (id, net_per_paycheck, frequency, first_paycheck_date)
        SELECT id, net_per_paycheck, frequency, first_paycheck_date FROM income
      `, []);
      await db.execute(`DROP TABLE income`, []);
      await db.execute(`ALTER TABLE income_v4 RENAME TO income`, []);
    }
  }

  // ── Budget config: remove legacy columns ───────────────────────────────────
  const cfgCols = await db.select<{ name: string }[]>('PRAGMA table_info(budget_config)', []);
  const cfgColNames = cfgCols.map(r => r.name);

  if (cfgColNames.includes('created_at')) {
    await db.execute(`
      CREATE TABLE budget_config_v4 (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        currency TEXT NOT NULL DEFAULT '$',
        schema_version INTEGER NOT NULL DEFAULT 4
      )
    `, []);
    await db.execute(`
      INSERT OR IGNORE INTO budget_config_v4 (id, currency, schema_version)
      SELECT id, currency, 4 FROM budget_config
    `, []);
    await db.execute(`DROP TABLE budget_config`, []);
    await db.execute(`ALTER TABLE budget_config_v4 RENAME TO budget_config`, []);
  } else if (cfgRows.length > 0) {
    await db.execute('UPDATE budget_config SET schema_version = 4 WHERE id = 1', []);
  }

  // ── Drop obsolete v3 tables ────────────────────────────────────────────────
  for (const tbl of [
    'fixed_expenses', 'variable_expenses', 'subscriptions',
    'savings_goal', 'savings_buckets', 'category_rules', 'actuals', 'paychecks',
    'budget_state',
  ]) {
    await db.execute(`DROP TABLE IF EXISTS ${tbl}`, []);
  }

  for (const idx of ['idx_paychecks_month', 'idx_rules_priority', 'idx_tx_month']) {
    await db.execute(`DROP INDEX IF EXISTS ${idx}`, []);
  }
}

async function addMissingColumns(db: Database): Promise<void> {
  const bucketCols = await db.select<{ name: string }[]>('PRAGMA table_info(buckets)', []);
  const bucketColNames = bucketCols.map(r => r.name);

  if (!bucketColNames.includes('emoji')) {
    await db.execute('ALTER TABLE buckets ADD COLUMN emoji TEXT', []);
  }
  if (!bucketColNames.includes('is_special')) {
    await db.execute(
      'ALTER TABLE buckets ADD COLUMN is_special INTEGER NOT NULL DEFAULT 0',
      [],
    );
  }
}
