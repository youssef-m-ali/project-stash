import db from '@/lib/db';
import { randomUUID } from 'crypto';
import type { Subtransaction } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };
type SubRow = { id: string; tx_id: string; description: string; amount: number; date: string; created_at: string };

function rowToSub(r: SubRow): Subtransaction {
  return { id: r.id, txId: r.tx_id, description: r.description, amount: r.amount, date: r.date, createdAt: r.created_at };
}

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const rows = db
    .prepare('SELECT * FROM subtransactions WHERE tx_id = ? ORDER BY date, created_at')
    .all(id) as SubRow[];
  return Response.json({ subtransactions: rows.map(rowToSub) });
}

interface PostBody {
  description: string;
  amount: number; // positive value from UI; stored as negative (credit back)
  date: string;   // YYYY-MM-DD
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;

  const tx = db.prepare('SELECT id FROM transactions WHERE id = ?').get(id);
  if (!tx) return Response.json({ error: 'Transaction not found' }, { status: 404 });

  const body = (await request.json()) as PostBody;
  if (!body.description?.trim()) return Response.json({ error: 'description required' }, { status: 400 });
  if (typeof body.amount !== 'number' || body.amount <= 0)
    return Response.json({ error: 'amount must be a positive number' }, { status: 400 });

  const sub: Subtransaction = {
    id: randomUUID(),
    txId: id,
    description: body.description.trim(),
    amount: -Math.abs(body.amount), // always stored as credit back (negative)
    date: body.date,
    createdAt: new Date().toISOString(),
  };

  db.prepare(`
    INSERT INTO subtransactions (id, tx_id, description, amount, date, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(sub.id, sub.txId, sub.description, sub.amount, sub.date, sub.createdAt);

  return Response.json({ subtransaction: sub }, { status: 201 });
}
