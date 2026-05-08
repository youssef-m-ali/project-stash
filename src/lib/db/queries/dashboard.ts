import { addDays, differenceInDays, format, parseISO } from 'date-fns';
import { getDb } from '../client';
import { FIXED_EXPENSES_BUCKET_ID } from '../helpers';
import type { DashboardData, BucketFill, PaycheckPeriod } from '@/lib/types';

type PeriodRow   = { id: string; start_date: string; end_date: string; paycheck_amount: number };
type BucketRow   = { id: string; name: string; amount_per_paycheck: number; color: string; emoji: string | null; sort_order: number };
type SpendRow    = { bucket_id: string | null; total: number };
type IncomeRow   = { net_per_paycheck: number; first_paycheck_date: string };
type FixedExpRow = { amount: number; due_day_of_month: number };
type CountRow    = { c: number };

function parseLocalIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function isoToDate(iso: string): Date { return parseISO(iso); }
function dateToIso(d: Date): string   { return format(d, 'yyyy-MM-dd'); }

function computeFixedExpensesPlanned(startDate: string, endDate: string, rows: FixedExpRow[]): number {
  let total = 0;
  let cur = parseLocalIso(startDate);
  const end = parseLocalIso(endDate);
  while (cur <= end) {
    const dom = cur.getDate();
    for (const r of rows) {
      if (r.due_day_of_month === dom) total += r.amount;
    }
    cur = addDays(cur, 1);
  }
  return total;
}

function synthPeriod(startIso: string, netPerPaycheck: number): PaycheckPeriod {
  return {
    id: startIso,
    startDate: startIso,
    endDate: dateToIso(addDays(isoToDate(startIso), 13)),
    paycheckAmount: netPerPaycheck,
  };
}

async function buildDashboard(
  period: PaycheckPeriod,
  isInDb: boolean,
  currentPeriodStart: string,
): Promise<DashboardData> {
  const db = await getDb();
  const { startDate, endDate } = period;

  const bucketRows  = await db.select<BucketRow[]>('SELECT * FROM buckets ORDER BY sort_order, name', []);
  const fixedExpRows = await db.select<FixedExpRow[]>('SELECT amount, due_day_of_month FROM fixed_expenses', []);

  const spendSql = isInDb
    ? `WITH sub_totals AS (
         SELECT s.tx_id, SUM(s.amount) AS sub_sum FROM subtransactions s GROUP BY s.tx_id
       )
       SELECT t.bucket_id, SUM(t.amount + COALESCE(st.sub_sum, 0)) AS total
       FROM transactions t LEFT JOIN sub_totals st ON st.tx_id = t.id
       WHERE (t.period_id = ? OR (t.period_id IS NULL AND t.date BETWEEN ? AND ?))
         AND t.status = 'approved'
       GROUP BY t.bucket_id`
    : `WITH sub_totals AS (
         SELECT s.tx_id, SUM(s.amount) AS sub_sum FROM subtransactions s GROUP BY s.tx_id
       )
       SELECT t.bucket_id, SUM(t.amount + COALESCE(st.sub_sum, 0)) AS total
       FROM transactions t LEFT JOIN sub_totals st ON st.tx_id = t.id
       WHERE t.date BETWEEN ? AND ? AND t.status = 'approved'
       GROUP BY t.bucket_id`;

  const spendParams = isInDb ? [period.id, startDate, endDate] : [startDate, endDate];
  const spendRows = await db.select<SpendRow[]>(spendSql, spendParams);
  const spendMap = new Map<string, number>(spendRows.map(r => [r.bucket_id ?? '__null__', r.total]));

  const buckets: BucketFill[] = bucketRows.map(b => {
    const spent   = spendMap.get(b.id) ?? 0;
    const planned = b.id === FIXED_EXPENSES_BUCKET_ID
      ? computeFixedExpensesPlanned(startDate, endDate, fixedExpRows)
      : b.amount_per_paycheck;
    return { id: b.id, name: b.name, color: b.color, emoji: b.emoji ?? null, sortOrder: b.sort_order, planned, spent, pct: planned > 0 ? spent / planned : 0 };
  });

  const pendingRows = isInDb
    ? await db.select<CountRow[]>(
        `SELECT COUNT(*) as c FROM transactions
         WHERE (period_id = ? OR (period_id IS NULL AND date BETWEEN ? AND ?)) AND status = 'pending'`,
        [period.id, startDate, endDate],
      )
    : await db.select<CountRow[]>(
        `SELECT COUNT(*) as c FROM transactions WHERE date BETWEEN ? AND ? AND status = 'pending'`,
        [startDate, endDate],
      );

  const pendingCount = pendingRows[0]?.c ?? 0;
  const totalSpent   = buckets.reduce((s, b) => s + b.spent, 0);
  const totalPlanned = buckets.reduce((s, b) => s + b.planned, 0);

  return {
    period,
    buckets,
    pendingCount,
    totalSpent,
    totalPlanned,
    prevPeriodStart: dateToIso(addDays(isoToDate(startDate), -14)),
    nextPeriodStart: dateToIso(addDays(isoToDate(startDate), 14)),
    currentPeriodStart,
  };
}

export async function getDashboard(periodId?: string): Promise<DashboardData | null> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);

  const incomeRows = await db.select<IncomeRow[]>(
    'SELECT net_per_paycheck, first_paycheck_date FROM income WHERE id = 1', [],
  );
  const incomeRow = incomeRows[0] as IncomeRow | undefined;

  const todayPeriodRows = await db.select<PeriodRow[]>(
    'SELECT * FROM paycheck_periods WHERE start_date <= ? AND ? <= end_date LIMIT 1',
    [today, today],
  );
  const todayPeriodRow = todayPeriodRows[0] as PeriodRow | undefined;

  let currentPeriodStart: string;
  if (todayPeriodRow) {
    currentPeriodStart = todayPeriodRow.start_date;
  } else if (incomeRow?.first_paycheck_date) {
    const firstDate = isoToDate(incomeRow.first_paycheck_date);
    const diff = differenceInDays(isoToDate(today), firstDate);
    currentPeriodStart = dateToIso(addDays(firstDate, Math.floor(diff / 14) * 14));
  } else {
    currentPeriodStart = today;
  }

  if (!periodId) {
    if (todayPeriodRow) {
      const period: PaycheckPeriod = {
        id: todayPeriodRow.id,
        startDate: todayPeriodRow.start_date,
        endDate: todayPeriodRow.end_date,
        paycheckAmount: todayPeriodRow.paycheck_amount,
      };
      return buildDashboard(period, true, currentPeriodStart);
    }
    if (!incomeRow?.first_paycheck_date) return null;
    return buildDashboard(synthPeriod(currentPeriodStart, incomeRow.net_per_paycheck), false, currentPeriodStart);
  }

  const existingRows = await db.select<PeriodRow[]>(
    'SELECT * FROM paycheck_periods WHERE id = ?', [periodId],
  );
  if (existingRows.length > 0) {
    const r = existingRows[0];
    const period: PaycheckPeriod = { id: r.id, startDate: r.start_date, endDate: r.end_date, paycheckAmount: r.paycheck_amount };
    return buildDashboard(period, true, currentPeriodStart);
  }

  if (!incomeRow?.first_paycheck_date) return null;

  const diff = differenceInDays(isoToDate(periodId), isoToDate(incomeRow.first_paycheck_date));
  if (diff % 14 !== 0) return null;

  return buildDashboard(synthPeriod(periodId, incomeRow.net_per_paycheck), false, currentPeriodStart);
}
