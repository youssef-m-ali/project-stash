import db from '@/lib/db';
import type { Transaction } from '@/lib/types';

type TxRow = {
  id: string; account_id: string; date: string;
  description: string; amount: number; raw_amount: number;
  bucket_id: string | null; period_id: string | null;
  status: string; imported_at: string;
};

function rowToTx(r: TxRow): Transaction {
  return {
    id: r.id,
    accountId: r.account_id,
    date: r.date,
    description: r.description,
    amount: r.amount,
    rawAmount: r.raw_amount,
    bucketId: r.bucket_id,
    periodId: r.period_id,
    status: r.status as Transaction['status'],
    importedAt: r.imported_at,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const periodId  = searchParams.get('periodId');
  const status    = searchParams.get('status');
  const bucketId  = searchParams.get('bucketId');
  const accountId = searchParams.get('accountId');

  let sql = 'SELECT * FROM transactions WHERE 1=1';
  const params: (string | null)[] = [];

  if (periodId)  { sql += ' AND period_id = ?';  params.push(periodId); }
  if (status)    { sql += ' AND status = ?';      params.push(status); }
  if (bucketId)  { sql += ' AND bucket_id = ?';   params.push(bucketId); }
  if (accountId) { sql += ' AND account_id = ?';  params.push(accountId); }

  sql += ' ORDER BY date DESC, imported_at DESC';

  const rows = db.prepare(sql).all(...params) as TxRow[];
  return Response.json({ transactions: rows.map(rowToTx) });
}
