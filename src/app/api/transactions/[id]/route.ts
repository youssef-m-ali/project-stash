import db from '@/lib/db';
import { normalizeMerchant } from '@/lib/import/normalizeMerchant';

type Params = { params: Promise<{ id: string }> };

interface PatchBody {
  status?: 'approved' | 'ignored';
  bucketId?: string | null;
  description?: string;
  amount?: number;
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = (await request.json()) as PatchBody;

  const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as
    | { description: string; status: string }
    | undefined;

  if (!tx) return Response.json({ error: 'Not found' }, { status: 404 });

  // Field edit (description / amount only — id/rawAmount never change)
  if (body.description !== undefined || body.amount !== undefined) {
    const fields: string[] = [];
    const vals: unknown[] = [];
    if (body.description !== undefined) { fields.push('description = ?'); vals.push(body.description); }
    if (body.amount     !== undefined) { fields.push('amount = ?');      vals.push(body.amount); }
    vals.push(id);
    db.prepare(`UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
    return Response.json({ ok: true });
  }

  db.prepare('UPDATE transactions SET status = ?, bucket_id = ? WHERE id = ?').run(
    body.status,
    body.bucketId ?? null,
    id,
  );

  // Upsert merchant memory whenever a transaction is approved with a bucket
  if (body.status === 'approved' && body.bucketId) {
    const key = normalizeMerchant(tx.description);
    if (key) {
      db.prepare(`
        INSERT INTO merchant_memory (merchant_key, bucket_id, last_seen, count)
        VALUES (?, ?, date('now'), 1)
        ON CONFLICT(merchant_key) DO UPDATE SET
          bucket_id = excluded.bucket_id,
          last_seen = excluded.last_seen,
          count = count + 1
      `).run(key, body.bucketId);
    }
  }

  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
  return Response.json({ ok: true });
}
