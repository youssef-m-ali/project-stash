import { NextResponse } from 'next/server';
import db from '@/lib/db';
import type { Bucket } from '@/lib/types';
import { randomUUID } from 'crypto';

function rowToBucket(r: Record<string, unknown>): Bucket {
  return {
    id: r.id as string,
    name: r.name as string,
    amountPerPaycheck: r.amount_per_paycheck as number,
    color: r.color as string,
    sortOrder: r.sort_order as number,
  };
}

export function GET() {
  const rows = db
    .prepare('SELECT * FROM buckets ORDER BY sort_order, name')
    .all() as Record<string, unknown>[];
  return NextResponse.json({ buckets: rows.map(rowToBucket) });
}

export async function POST(req: Request) {
  const body: Omit<Bucket, 'id'> = await req.json();
  const id = randomUUID();
  const maxOrder = (
    db.prepare('SELECT MAX(sort_order) as m FROM buckets').get() as { m: number | null }
  ).m ?? -1;
  db.prepare(`
    INSERT INTO buckets (id, name, amount_per_paycheck, color, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, body.name, body.amountPerPaycheck, body.color ?? '#6b7280', maxOrder + 1);

  const row = db.prepare('SELECT * FROM buckets WHERE id = ?').get(id) as Record<string, unknown>;
  return NextResponse.json({ bucket: rowToBucket(row) }, { status: 201 });
}
