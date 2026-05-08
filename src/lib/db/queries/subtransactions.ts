import { getDb } from '../client';
import type { Subtransaction } from '@/lib/types';

type SubRow = { id: string; tx_id: string; description: string; amount: number; date: string; created_at: string };

function rowToSub(r: SubRow): Subtransaction {
  return { id: r.id, txId: r.tx_id, description: r.description, amount: r.amount, date: r.date, createdAt: r.created_at };
}

export async function getSubtransactions(txId: string): Promise<Subtransaction[]> {
  const db = await getDb();
  const rows = await db.select<SubRow[]>(
    'SELECT * FROM subtransactions WHERE tx_id = ? ORDER BY date, created_at',
    [txId],
  );
  return rows.map(rowToSub);
}

export async function createSubtransaction(
  txId: string,
  body: { description: string; amount: number; date: string },
): Promise<Subtransaction> {
  const db = await getDb();

  const txRows = await db.select<{ id: string }[]>('SELECT id FROM transactions WHERE id = ?', [txId]);
  if (txRows.length === 0) throw new Error('Transaction not found');

  const sub: Subtransaction = {
    id: crypto.randomUUID(),
    txId,
    description: body.description.trim(),
    amount: -Math.abs(body.amount),
    date: body.date,
    createdAt: new Date().toISOString(),
  };

  await db.execute(
    'INSERT INTO subtransactions (id, tx_id, description, amount, date, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [sub.id, sub.txId, sub.description, sub.amount, sub.date, sub.createdAt],
  );

  return sub;
}

export async function deleteSubtransaction(id: string): Promise<void> {
  const db = await getDb();
  const result = await db.execute('DELETE FROM subtransactions WHERE id = ?', [id]);
  if (result.rowsAffected === 0) throw new Error('Subtransaction not found');
}
