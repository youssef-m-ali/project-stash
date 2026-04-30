import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { normalizeMerchant } from '@/lib/import/normalizeMerchant';
import type { ReviewTransaction } from '@/lib/types';

type TxRow = {
  id: string; account_id: string; date: string; description: string;
  amount: number; raw_amount: number; bucket_id: string | null;
  period_id: string | null; status: string; imported_at: string;
};

export function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const periodId = searchParams.get('periodId');
  const all = searchParams.get('all') === 'true';

  let sql: string;
  const params: (string | null)[] = [];

  if (all) {
    sql = `SELECT * FROM transactions WHERE status = 'pending' ORDER BY date DESC, imported_at DESC`;
  } else if (periodId) {
    sql = `SELECT * FROM transactions WHERE status = 'pending' AND period_id = ? ORDER BY date DESC, imported_at DESC`;
    params.push(periodId);
  } else {
    // Default: current period + unassigned
    const today = new Date().toISOString().slice(0, 10);
    const period = db.prepare(
      `SELECT id FROM paycheck_periods WHERE start_date <= ? AND ? <= end_date LIMIT 1`
    ).get(today, today) as { id: string } | undefined;

    if (period) {
      sql = `SELECT * FROM transactions WHERE status = 'pending' AND (period_id = ? OR period_id IS NULL) ORDER BY date DESC, imported_at DESC`;
      params.push(period.id);
    } else {
      sql = `SELECT * FROM transactions WHERE status = 'pending' ORDER BY date DESC, imported_at DESC`;
    }
  }

  const rows = db.prepare(sql).all(...params) as TxRow[];

  // Build merchant memory map for suggestions
  const memoryMap = new Map<string, string>(
    (db.prepare('SELECT merchant_key, bucket_id FROM merchant_memory').all() as { merchant_key: string; bucket_id: string }[]).map(
      r => [r.merchant_key, r.bucket_id],
    ),
  );

  const transactions: ReviewTransaction[] = rows.map(r => {
    const key = normalizeMerchant(r.description);
    return {
      id: r.id,
      accountId: r.account_id,
      date: r.date,
      description: r.description,
      amount: r.amount,
      rawAmount: r.raw_amount,
      bucketId: r.bucket_id,
      periodId: r.period_id,
      status: r.status as ReviewTransaction['status'],
      importedAt: r.imported_at,
      suggestedBucketId: memoryMap.get(key) ?? null,
    };
  });

  return NextResponse.json({ transactions });
}
