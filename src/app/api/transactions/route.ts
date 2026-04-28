import db from '@/lib/db';
import type { Transaction } from '@/lib/types';

type TxRow = {
  id: string; account_id: string; date: string; month_key: string;
  description: string; amount: number; raw_amount: number;
  category_id: string | null; status: string; ignore_reason: string | null;
  imported_at: string;
};

function rowToTx(r: TxRow): Transaction {
  return {
    id: r.id, accountId: r.account_id, date: r.date, monthKey: r.month_key,
    description: r.description, amount: r.amount, rawAmount: r.raw_amount,
    categoryId: r.category_id, status: r.status as Transaction['status'],
    ignoreReason: r.ignore_reason, importedAt: r.imported_at,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month');
  const accountId = searchParams.get('accountId');

  let sql = 'SELECT * FROM transactions WHERE 1=1';
  const params: string[] = [];
  if (month)     { sql += ' AND month_key = ?'; params.push(month); }
  if (accountId) { sql += ' AND account_id = ?'; params.push(accountId); }
  sql += ' ORDER BY date DESC, imported_at DESC';

  const rows = db.prepare(sql).all(...params) as TxRow[];
  return Response.json({ transactions: rows.map(rowToTx) });
}
