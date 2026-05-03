import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { normalizeMerchant } from '@/lib/import/normalizeMerchant';

type Params = { params: Promise<{ merchantKey: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const { merchantKey } = await params;
  const key = decodeURIComponent(merchantKey);
  const { bucketId, updateHistorical } = (await req.json()) as { bucketId: string; updateHistorical: boolean };

  db.prepare(
    `UPDATE merchant_memory SET bucket_id = ?, last_seen = date('now') WHERE merchant_key = ?`,
  ).run(bucketId, key);

  if (updateHistorical) {
    const rows = db
      .prepare(`SELECT id, description FROM transactions WHERE status = 'approved'`)
      .all() as { id: string; description: string }[];
    const ids = rows.filter(r => normalizeMerchant(r.description) === key).map(r => r.id);
    if (ids.length > 0) {
      db.prepare(
        `UPDATE transactions SET bucket_id = ? WHERE id IN (${ids.map(() => '?').join(',')})`,
      ).run(bucketId, ...ids);
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { merchantKey } = await params;
  db.prepare('DELETE FROM merchant_memory WHERE merchant_key = ?').run(
    decodeURIComponent(merchantKey),
  );
  return NextResponse.json({ ok: true });
}
