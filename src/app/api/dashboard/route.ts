import { NextRequest, NextResponse } from 'next/server';
import { addDays, differenceInDays, format, parseISO } from 'date-fns';
import db, { FIXED_EXPENSES_BUCKET_ID } from '@/lib/db';
import type { DashboardData, BucketFill, PaycheckPeriod } from '@/lib/types';

type PeriodRow   = { id: string; start_date: string; end_date: string; paycheck_amount: number };
type BucketRow   = { id: string; name: string; amount_per_paycheck: number; color: string; emoji: string | null; sort_order: number };
type SpendRow    = { bucket_id: string | null; total: number };
type IncomeRow   = { net_per_paycheck: number; first_paycheck_date: string };
type FixedExpRow = { amount: number; due_day_of_month: number };

function parseLocalIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

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

function isoToDate(iso: string): Date {
  return parseISO(iso);
}

function dateToIso(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

function findPeriodForDate(iso: string): PeriodRow | undefined {
  return db.prepare(`
    SELECT * FROM paycheck_periods
    WHERE start_date <= ? AND ? <= end_date
    LIMIT 1
  `).get(iso, iso) as PeriodRow | undefined;
}

function synthPeriod(startIso: string, netPerPaycheck: number): PaycheckPeriod {
  return {
    id: startIso,
    startDate: startIso,
    endDate: dateToIso(addDays(isoToDate(startIso), 13)),
    paycheckAmount: netPerPaycheck,
  };
}

function buildDashboard(
  period: PaycheckPeriod,
  isInDb: boolean,
  currentPeriodStart: string,
): NextResponse {
  const { startDate, endDate } = period;

  const bucketRows = db
    .prepare('SELECT * FROM buckets ORDER BY sort_order, name')
    .all() as BucketRow[];

  const fixedExpRows = db
    .prepare('SELECT amount, due_day_of_month FROM fixed_expenses')
    .all() as FixedExpRow[];

  // For periods in the DB we match by period_id (covers uploaded transactions),
  // but also include NULL-period transactions whose date falls in range (pre-setup uploads).
  // For synthesised/extrapolated periods (not in DB) we can only query by date range.
  const spendRows: SpendRow[] = isInDb
    ? db.prepare(`
        WITH sub_totals AS (
          SELECT s.tx_id, SUM(s.amount) AS sub_sum
          FROM subtransactions s
          GROUP BY s.tx_id
        )
        SELECT t.bucket_id, SUM(t.amount + COALESCE(st.sub_sum, 0)) AS total
        FROM transactions t
        LEFT JOIN sub_totals st ON st.tx_id = t.id
        WHERE (t.period_id = ? OR (t.period_id IS NULL AND t.date BETWEEN ? AND ?))
          AND t.status = 'approved'
        GROUP BY t.bucket_id
      `).all(period.id, startDate, endDate) as SpendRow[]
    : db.prepare(`
        WITH sub_totals AS (
          SELECT s.tx_id, SUM(s.amount) AS sub_sum
          FROM subtransactions s
          GROUP BY s.tx_id
        )
        SELECT t.bucket_id, SUM(t.amount + COALESCE(st.sub_sum, 0)) AS total
        FROM transactions t
        LEFT JOIN sub_totals st ON st.tx_id = t.id
        WHERE t.date BETWEEN ? AND ? AND t.status = 'approved'
        GROUP BY t.bucket_id
      `).all(startDate, endDate) as SpendRow[];

  const spendMap = new Map<string, number>(
    spendRows.map(r => [r.bucket_id ?? '__null__', r.total]),
  );

  const buckets: BucketFill[] = bucketRows.map(b => {
    const spent = spendMap.get(b.id) ?? 0;
    const planned = b.id === FIXED_EXPENSES_BUCKET_ID
      ? computeFixedExpensesPlanned(startDate, endDate, fixedExpRows)
      : b.amount_per_paycheck;
    return {
      id: b.id,
      name: b.name,
      color: b.color,
      emoji: b.emoji ?? null,
      sortOrder: b.sort_order,
      planned,
      spent,
      pct: planned > 0 ? spent / planned : 0,
    };
  });

  const pendingCount: number = isInDb
    ? (
        (db.prepare(`
          SELECT COUNT(*) as c FROM transactions
          WHERE (period_id = ? OR (period_id IS NULL AND date BETWEEN ? AND ?))
            AND status = 'pending'
        `).get(period.id, startDate, endDate) as { c: number }).c
      )
    : (
        (db.prepare(`
          SELECT COUNT(*) as c FROM transactions
          WHERE date BETWEEN ? AND ? AND status = 'pending'
        `).get(startDate, endDate) as { c: number }).c
      );

  const totalSpent   = buckets.reduce((s, b) => s + b.spent, 0);
  const totalPlanned = buckets.reduce((s, b) => s + b.planned, 0);

  const prevPeriodStart = dateToIso(addDays(isoToDate(startDate), -14));
  const nextPeriodStart = dateToIso(addDays(isoToDate(startDate), 14));

  const data: DashboardData = {
    period,
    buckets,
    pendingCount,
    totalSpent,
    totalPlanned,
    prevPeriodStart,
    nextPeriodStart,
    currentPeriodStart,
  };

  return NextResponse.json(data);
}

export function GET(request: NextRequest) {
  const today = new Date().toISOString().slice(0, 10);

  const incomeRow = db.prepare(
    'SELECT net_per_paycheck, first_paycheck_date FROM income WHERE id = 1',
  ).get() as IncomeRow | undefined;

  // Determine currentPeriodStart (today's period, DB or synthesised).
  let currentPeriodStart: string;
  const todayPeriodRow = findPeriodForDate(today);
  if (todayPeriodRow) {
    currentPeriodStart = todayPeriodRow.start_date;
  } else if (incomeRow?.first_paycheck_date) {
    const firstDate = isoToDate(incomeRow.first_paycheck_date);
    const todayDate = isoToDate(today);
    const diff = differenceInDays(todayDate, firstDate);
    const offset = Math.floor(diff / 14) * 14;
    currentPeriodStart = dateToIso(addDays(firstDate, offset));
  } else {
    currentPeriodStart = today;
  }

  const periodIdParam = request.nextUrl.searchParams.get('periodId');

  if (!periodIdParam) {
    // Default: use today's period.
    if (todayPeriodRow) {
      const period: PaycheckPeriod = {
        id: todayPeriodRow.id,
        startDate: todayPeriodRow.start_date,
        endDate: todayPeriodRow.end_date,
        paycheckAmount: todayPeriodRow.paycheck_amount,
      };
      return buildDashboard(period, true, currentPeriodStart);
    }

    if (!incomeRow?.first_paycheck_date) {
      return NextResponse.json(null);
    }

    // Today is outside generated range — synthesise.
    const period = synthPeriod(currentPeriodStart, incomeRow.net_per_paycheck);
    return buildDashboard(period, false, currentPeriodStart);
  }

  // A specific periodId was requested.
  const existingRow = db.prepare(
    'SELECT * FROM paycheck_periods WHERE id = ?',
  ).get(periodIdParam) as PeriodRow | undefined;

  if (existingRow) {
    const period: PaycheckPeriod = {
      id: existingRow.id,
      startDate: existingRow.start_date,
      endDate: existingRow.end_date,
      paycheckAmount: existingRow.paycheck_amount,
    };
    return buildDashboard(period, true, currentPeriodStart);
  }

  // Not in DB — validate that it is a biweekly offset from first_paycheck_date.
  if (!incomeRow?.first_paycheck_date) {
    return NextResponse.json({ error: 'Income not configured' }, { status: 400 });
  }

  const firstDate     = isoToDate(incomeRow.first_paycheck_date);
  const requestedDate = isoToDate(periodIdParam);
  const diff = differenceInDays(requestedDate, firstDate);

  if (diff % 14 !== 0) {
    return NextResponse.json({ error: 'Invalid period offset' }, { status: 400 });
  }

  const period = synthPeriod(periodIdParam, incomeRow.net_per_paycheck);
  return buildDashboard(period, false, currentPeriodStart);
}
