import { getDb } from '../client';
import { regeneratePeriods, FIXED_EXPENSES_BUCKET_ID } from '../helpers';
import type { BudgetState, Account, Bucket, FixedExpense } from '@/lib/types';

type ConfigRow   = { currency: string };
type IncomeRow   = { net_per_paycheck: number; first_paycheck_date: string };
type AccountRow  = { id: string; label: string; kind: string };
type BucketRow   = { id: string; name: string; amount_per_paycheck: number; color: string; emoji: string | null; sort_order: number; is_special: number };
type FixedExpRow = { id: string; name: string; amount: number; due_day_of_month: number; emoji: string | null; sort_order: number };

function rowToAccount(r: AccountRow): Account {
  return { id: r.id, label: r.label, kind: r.kind as Account['kind'] };
}

function rowToBucket(r: BucketRow): Bucket {
  return {
    id: r.id,
    name: r.name,
    amountPerPaycheck: r.amount_per_paycheck,
    color: r.color,
    emoji: r.emoji ?? null,
    sortOrder: r.sort_order,
    isSpecial: Boolean(r.is_special),
  };
}

function rowToFixedExpense(r: FixedExpRow): FixedExpense {
  return {
    id: r.id,
    name: r.name,
    amount: r.amount,
    dueDayOfMonth: r.due_day_of_month,
    emoji: r.emoji ?? null,
    sortOrder: r.sort_order,
  };
}

export async function getConfig(): Promise<BudgetState | null> {
  const db = await getDb();

  const cfgRows = await db.select<ConfigRow[]>('SELECT * FROM budget_config WHERE id = 1', []);
  if (cfgRows.length === 0) return null;

  const incomeRows = await db.select<IncomeRow[]>('SELECT * FROM income WHERE id = 1', []);
  if (incomeRows.length === 0) return null;

  const accounts = (await db.select<AccountRow[]>('SELECT * FROM accounts ORDER BY label', [])).map(rowToAccount);
  const buckets  = (await db.select<BucketRow[]>('SELECT * FROM buckets ORDER BY sort_order, name', [])).map(rowToBucket);
  const fixedExpenses = (await db.select<FixedExpRow[]>('SELECT * FROM fixed_expenses ORDER BY sort_order', [])).map(rowToFixedExpense);

  return {
    schemaVersion: 4,
    currency: cfgRows[0].currency,
    income: {
      netPerPaycheck:     incomeRows[0].net_per_paycheck,
      firstPaycheckDate:  incomeRows[0].first_paycheck_date,
      frequency: 'biweekly',
    },
    fixedExpenses,
    accounts,
    buckets,
  };
}

export async function saveConfig(body: BudgetState): Promise<void> {
  const db = await getDb();

  await db.execute('BEGIN', []);
  try {
    await db.execute(
      `INSERT INTO budget_config (id, currency, schema_version) VALUES (1, ?, 4)
       ON CONFLICT(id) DO UPDATE SET currency = excluded.currency`,
      [body.currency ?? '$'],
    );

    await db.execute(
      `INSERT INTO income (id, net_per_paycheck, frequency, first_paycheck_date)
       VALUES (1, ?, 'biweekly', ?)
       ON CONFLICT(id) DO UPDATE SET
         net_per_paycheck    = excluded.net_per_paycheck,
         first_paycheck_date = excluded.first_paycheck_date`,
      [body.income.netPerPaycheck, body.income.firstPaycheckDate],
    );

    const accountIds = body.accounts.map(a => a.id);
    if (accountIds.length > 0) {
      const ph = accountIds.map(() => '?').join(',');
      await db.execute(`DELETE FROM accounts WHERE id NOT IN (${ph})`, accountIds);
    }
    for (const a of body.accounts) {
      await db.execute(
        `INSERT INTO accounts (id, label, kind) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET label = excluded.label, kind = excluded.kind`,
        [a.id, a.label, a.kind],
      );
    }

    await db.execute('DELETE FROM fixed_expenses', []);
    for (let i = 0; i < (body.fixedExpenses ?? []).length; i++) {
      const e = body.fixedExpenses[i];
      await db.execute(
        `INSERT INTO fixed_expenses (id, name, amount, due_day_of_month, emoji, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [e.id, e.name, e.amount, e.dueDayOfMonth, e.emoji ?? null, i],
      );
    }

    const bucketIds = body.buckets.map(b => b.id);
    if (bucketIds.length > 0) {
      const ph = bucketIds.map(() => '?').join(',');
      await db.execute(`DELETE FROM buckets WHERE id NOT IN (${ph}) AND is_special = 0`, bucketIds);
    } else {
      await db.execute('DELETE FROM buckets WHERE is_special = 0', []);
    }
    for (let i = 0; i < body.buckets.length; i++) {
      const b = body.buckets[i];
      if (b.id === FIXED_EXPENSES_BUCKET_ID) continue;
      await db.execute(
        `INSERT INTO buckets (id, name, amount_per_paycheck, color, emoji, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name                = excluded.name,
           amount_per_paycheck = excluded.amount_per_paycheck,
           color               = excluded.color,
           emoji               = excluded.emoji,
           sort_order          = excluded.sort_order`,
        [b.id, b.name, b.amountPerPaycheck, b.color, b.emoji ?? null, i],
      );
    }

    await db.execute('COMMIT', []);
  } catch (e) {
    await db.execute('ROLLBACK', []);
    throw e;
  }

  await regeneratePeriods(body.income.firstPaycheckDate, body.income.netPerPaycheck);
}

export async function deleteAllData(): Promise<void> {
  const db = await getDb();
  await db.execute('BEGIN', []);
  try {
    for (const tbl of [
      'merchant_memory', 'transactions', 'paycheck_periods',
      'fixed_expenses', 'buckets', 'accounts', 'income', 'budget_config',
    ]) {
      await db.execute(`DELETE FROM ${tbl}`, []);
    }
    await db.execute('COMMIT', []);
  } catch (e) {
    await db.execute('ROLLBACK', []);
    throw e;
  }
}
