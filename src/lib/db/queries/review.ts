import { getDb } from '../client';
import { normalizeMerchant } from '@/lib/import/normalizeMerchant';
import type { ReviewTransaction } from '@/lib/types';

type TxRow = {
  id: string; account_id: string; date: string; description: string;
  amount: number; raw_amount: number; bucket_id: string | null;
  period_id: string | null; status: string; imported_at: string;
};

interface ReviewParams {
  periodId?: string | null;
  all?: boolean;
}

export async function getReviewTransactions(params: ReviewParams = {}): Promise<ReviewTransaction[]> {
  const db = await getDb();
  const { periodId, all } = params;

  let sql: string;
  const sqlParams: unknown[] = [];

  if (all) {
    sql = `SELECT * FROM transactions WHERE status = 'pending' ORDER BY date DESC, imported_at DESC`;
  } else if (periodId) {
    sql = `SELECT * FROM transactions WHERE status = 'pending' AND period_id = ? ORDER BY date DESC, imported_at DESC`;
    sqlParams.push(periodId);
  } else {
    const today = new Date().toISOString().slice(0, 10);
    const periodRows = await db.select<{ id: string }[]>(
      `SELECT id FROM paycheck_periods WHERE start_date <= ? AND ? <= end_date LIMIT 1`,
      [today, today],
    );
    if (periodRows.length > 0) {
      sql = `SELECT * FROM transactions WHERE status = 'pending' AND (period_id = ? OR period_id IS NULL) ORDER BY date DESC, imported_at DESC`;
      sqlParams.push(periodRows[0].id);
    } else {
      sql = `SELECT * FROM transactions WHERE status = 'pending' ORDER BY date DESC, imported_at DESC`;
    }
  }

  const rows = await db.select<TxRow[]>(sql, sqlParams);

  const memoryRows = await db.select<{ merchant_key: string; bucket_id: string }[]>(
    'SELECT merchant_key, bucket_id FROM merchant_memory', [],
  );
  const memoryMap = new Map(memoryRows.map(r => [r.merchant_key, r.bucket_id]));

  const exemptRows = await db.select<{ merchant_key: string }[]>(
    'SELECT merchant_key FROM merchant_exemptions', [],
  );
  const exemptKeys = new Set(exemptRows.map(r => r.merchant_key));

  return rows.map(r => {
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
      suggestedBucketId: exemptKeys.has(key) ? null : (memoryMap.get(key) ?? null),
    };
  });
}
