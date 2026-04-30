import { NextResponse } from 'next/server';
import db from '@/lib/db';
import type { DashboardData, BucketFill, PaycheckPeriod } from '@/lib/types';

type PeriodRow = { id: string; start_date: string; end_date: string; paycheck_amount: number };
type BucketRow = { id: string; name: string; amount_per_paycheck: number; color: string; sort_order: number };
type SpendRow  = { bucket_id: string | null; total: number };

export function GET() {
  const today = new Date().toISOString().slice(0, 10);

  const periodRow = db.prepare(`
    SELECT * FROM paycheck_periods
    WHERE start_date <= ? AND ? <= end_date
    LIMIT 1
  `).get(today, today) as PeriodRow | undefined;

  if (!periodRow) {
    return NextResponse.json(null);
  }

  const period: PaycheckPeriod = {
    id: periodRow.id,
    startDate: periodRow.start_date,
    endDate: periodRow.end_date,
    paycheckAmount: periodRow.paycheck_amount,
  };

  const bucketRows = db
    .prepare('SELECT * FROM buckets ORDER BY sort_order, name')
    .all() as BucketRow[];

  // Sum approved spending per bucket for the current period
  const spendRows = db.prepare(`
    SELECT bucket_id, SUM(amount) as total
    FROM transactions
    WHERE period_id = ? AND status = 'approved' AND amount > 0
    GROUP BY bucket_id
  `).all(periodRow.id) as SpendRow[];

  const spendMap = new Map<string, number>(
    spendRows.map(r => [r.bucket_id ?? '__null__', r.total]),
  );

  const buckets: BucketFill[] = bucketRows.map(b => {
    const spent = spendMap.get(b.id) ?? 0;
    const planned = b.amount_per_paycheck;
    return {
      id: b.id,
      name: b.name,
      color: b.color,
      sortOrder: b.sort_order,
      planned,
      spent,
      pct: planned > 0 ? spent / planned : 0,
    };
  });

  const pendingCount = (
    db.prepare(`
      SELECT COUNT(*) as c FROM transactions
      WHERE period_id = ? AND status = 'pending'
    `).get(periodRow.id) as { c: number }
  ).c;

  // Also count pending with no period (unassigned but imported)
  const unassignedPending = (
    db.prepare(`SELECT COUNT(*) as c FROM transactions WHERE period_id IS NULL AND status = 'pending'`).get() as { c: number }
  ).c;

  const totalSpent = buckets.reduce((s, b) => s + b.spent, 0);
  const totalPlanned = buckets.reduce((s, b) => s + b.planned, 0);

  const data: DashboardData = {
    period,
    buckets,
    pendingCount: pendingCount + unassignedPending,
    totalSpent,
    totalPlanned,
  };

  return NextResponse.json(data);
}
