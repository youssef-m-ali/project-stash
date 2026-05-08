import { getDb } from '../client';
import type { Bucket } from '@/lib/types';

type BucketRow = { id: string; name: string; amount_per_paycheck: number; color: string; emoji: string | null; sort_order: number; is_special: number };

function rowToBucket(r: BucketRow): Bucket {
  return {
    id: r.id,
    name: r.name,
    amountPerPaycheck: r.amount_per_paycheck,
    color: r.color,
    emoji: r.emoji ?? null,
    sortOrder: r.sort_order,
    isSpecial: Boolean(r.is_special),
  };
}

export async function getBuckets(): Promise<Bucket[]> {
  const db = await getDb();
  const rows = await db.select<BucketRow[]>('SELECT * FROM buckets ORDER BY sort_order, name', []);
  return rows.map(rowToBucket);
}
