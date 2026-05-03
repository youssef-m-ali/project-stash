import db from '@/lib/db';

type Row = { account_id: string; last_tx_date: string };

export function GET() {
  const rows = db
    .prepare('SELECT account_id, MAX(date) as last_tx_date FROM transactions GROUP BY account_id')
    .all() as Row[];

  const lastTxDate: Record<string, string> = {};
  for (const r of rows) lastTxDate[r.account_id] = r.last_tx_date;

  return Response.json({ lastTxDate });
}
