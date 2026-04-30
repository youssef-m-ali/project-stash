import { NextResponse } from 'next/server';
import db from '@/lib/db';
import type { MerchantMemory } from '@/lib/types';

function rowToMemory(r: Record<string, unknown>): MerchantMemory {
  return {
    merchantKey: r.merchant_key as string,
    bucketId: r.bucket_id as string,
    lastSeen: r.last_seen as string,
    count: r.count as number,
  };
}

export function GET() {
  const rows = db
    .prepare('SELECT * FROM merchant_memory ORDER BY count DESC, last_seen DESC')
    .all() as Record<string, unknown>[];
  return NextResponse.json({ entries: rows.map(rowToMemory) });
}
