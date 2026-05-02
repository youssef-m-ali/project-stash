import { NextResponse } from 'next/server';
import db from '@/lib/db';
import type { DashboardData, BucketFill, PaycheckPeriod } from '@/lib/types';

type PeriodRow = { id: string; start_date: string; end_date: string; paycheck_amount: number };
type BucketRow = { id: string; name: string; amount_per_paycheck: number; color: string; emoji: string | null; sort_order: number };
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

  // Net spend per bucket = transaction amounts + subtransaction credits.
  // The CTE pre-aggregates subtransaction totals per parent so the join
  // doesn't multiply transaction.amount by the number of subtransactions.
  const spendRows = db.prepare(`
    WITH sub_totals AS (
      SELECT s.tx_id, SUM(s.amount) AS sub_sum
      FROM subtransactions s
      GROUP BY s.tx_id
    )
    SELECT t.bucket_id, SUM(t.amount + COALESCE(st.sub_sum, 0)) AS total
    FROM transactions t
    LEFT JOIN sub_totals st ON st.tx_id = t.id
    WHERE t.period_id = ? AND t.status = 'approved'
    GROUP BY t.bucket_id
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
      emoji: b.emoji ?? null,
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
