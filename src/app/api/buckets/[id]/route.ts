import { NextResponse } from 'next/server';
import db from '@/lib/db';
import type { Bucket } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };

function rowToBucket(r: Record<string, unknown>): Bucket {
  return {
    id: r.id as string,
    name: r.name as string,
    amountPerPaycheck: r.amount_per_paycheck as number,
    color: r.color as string,
    sortOrder: r.sort_order as number,
  };
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const body: Partial<Omit<Bucket, 'id'>> = await req.json();

  const existing = db.prepare('SELECT * FROM buckets WHERE id = ?').get(id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (body.name !== undefined) db.prepare('UPDATE buckets SET name = ? WHERE id = ?').run(body.name, id);
  if (body.amountPerPaycheck !== undefined) db.prepare('UPDATE buckets SET amount_per_paycheck = ? WHERE id = ?').run(body.amountPerPaycheck, id);
  if (body.color !== undefined) db.prepare('UPDATE buckets SET color = ? WHERE id = ?').run(body.color, id);
  if (body.sortOrder !== undefined) db.prepare('UPDATE buckets SET sort_order = ? WHERE id = ?').run(body.sortOrder, id);

  const row = db.prepare('SELECT * FROM buckets WHERE id = ?').get(id) as Record<string, unknown>;
  return NextResponse.json({ bucket: rowToBucket(row) });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  db.prepare('DELETE FROM buckets WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
