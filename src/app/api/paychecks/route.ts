import db from '@/lib/db';
import type { Paycheck } from '@/lib/types';

type PaycheckRow = { id: string; date: string; month_key: string; amount: number };

// Returns all pre-computed paychecks, optionally filtered by ?month=YYYY-MM.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month');

  const rows = month
    ? (db.prepare('SELECT id, date, month_key, amount FROM paychecks WHERE month_key = ? ORDER BY date').all(month) as PaycheckRow[])
    : (db.prepare('SELECT id, date, month_key, amount FROM paychecks ORDER BY date').all() as PaycheckRow[]);

  const paychecks: (Paycheck & { id: string })[] = rows.map((r, i) => ({
    id: r.id,
    index: i,
    date: r.date,
    monthKey: r.month_key,
    amount: r.amount,
  }));

  return Response.json(paychecks);
}
