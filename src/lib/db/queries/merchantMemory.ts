import { getDb } from '../client';
import { normalizeMerchant } from '@/lib/import/normalizeMerchant';
import type { MerchantMemory } from '@/lib/types';

type MemRow = { merchant_key: string; bucket_id: string; last_seen: string; count: number };

function rowToMemory(r: MemRow): MerchantMemory {
  return { merchantKey: r.merchant_key, bucketId: r.bucket_id, lastSeen: r.last_seen, count: r.count };
}

export async function getMerchantMemory(): Promise<MerchantMemory[]> {
  const db = await getDb();
  const rows = await db.select<MemRow[]>(
    'SELECT * FROM merchant_memory ORDER BY count DESC, last_seen DESC', [],
  );
  return rows.map(rowToMemory);
}

export async function patchMerchantMemory(
  merchantKey: string,
  bucketId: string,
  updateHistorical: boolean,
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE merchant_memory SET bucket_id = ?, last_seen = date('now') WHERE merchant_key = ?`,
    [bucketId, merchantKey],
  );

  if (updateHistorical) {
    const rows = await db.select<{ id: string; description: string }[]>(
      `SELECT id, description FROM transactions WHERE status = 'approved'`, [],
    );
    const ids = rows.filter(r => normalizeMerchant(r.description) === merchantKey).map(r => r.id);
    if (ids.length > 0) {
      const ph = ids.map(() => '?').join(',');
      await db.execute(`UPDATE transactions SET bucket_id = ? WHERE id IN (${ph})`, [bucketId, ...ids]);
    }
  }
}

export async function deleteMerchantMemory(merchantKey: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM merchant_memory WHERE merchant_key = ?', [merchantKey]);
}
