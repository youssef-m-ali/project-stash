import { addDays, format } from 'date-fns';
import { getDb } from './client';

export const FIXED_EXPENSES_BUCKET_ID = '__fixed_expenses__';

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export async function regeneratePeriods(
  firstPaycheckDate: string,
  netPerPaycheck: number,
  windowMonths = 24,
): Promise<void> {
  const db = await getDb();

  const start = parseLocalDate(firstPaycheckDate);
  const end = new Date(start.getFullYear(), start.getMonth() + windowMonths, start.getDate());

  const periods: [string, string, string, number][] = [];
  let cur = new Date(start);
  while (cur < end) {
    const startDate = format(cur, 'yyyy-MM-dd');
    const endDate = format(addDays(cur, 13), 'yyyy-MM-dd');
    periods.push([startDate, startDate, endDate, netPerPaycheck]);
    cur = addDays(cur, 14);
  }

  await db.execute('BEGIN', []);
  try {
    await db.execute('DELETE FROM paycheck_periods', []);
    for (const [id, startDate, endDate, amount] of periods) {
      await db.execute(
        `INSERT OR REPLACE INTO paycheck_periods (id, start_date, end_date, paycheck_amount)
         VALUES (?, ?, ?, ?)`,
        [id, startDate, endDate, amount],
      );
    }
    await db.execute('COMMIT', []);
  } catch (e) {
    await db.execute('ROLLBACK', []);
    throw e;
  }

  await assignPeriodsToTransactions();
}

export async function assignPeriodsToTransactions(): Promise<void> {
  const db = await getDb();
  await db.execute(`
    UPDATE transactions
    SET period_id = (
      SELECT id FROM paycheck_periods
      WHERE start_date <= transactions.date AND transactions.date <= end_date
      LIMIT 1
    )
    WHERE period_id IS NULL
  `, []);
}

export async function ensureFixedExpensesBucket(db: Awaited<ReturnType<typeof getDb>>): Promise<void> {
  await db.execute(
    `INSERT OR IGNORE INTO buckets (id, name, amount_per_paycheck, color, emoji, sort_order, is_special)
     VALUES (?, 'Fixed Expenses', 0, '#6b7280', '🔒', -1, 1)`,
    [FIXED_EXPENSES_BUCKET_ID],
  );
}
