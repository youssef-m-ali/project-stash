import Database from '@tauri-apps/plugin-sql';
import { runMigrations } from './migrations';
import { createBaseSchema, createTransactionSchema, createSupportingSchema } from './schema';
import { ensureFixedExpensesBucket } from './helpers';

let _db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!_db) throw new Error('DB not initialised — call initDb() first');
  return _db;
}

export async function initDb(): Promise<void> {
  const db = await Database.load('sqlite:budget.db');

  // WAL mode and foreign keys must be set before any table access
  await db.execute('PRAGMA journal_mode = WAL', []);
  await db.execute('PRAGMA foreign_keys = ON', []);

  await createBaseSchema(db);
  await runMigrations(db);
  await createTransactionSchema(db);
  await createSupportingSchema(db);
  await ensureFixedExpensesBucket(db);

  _db = db;
}
