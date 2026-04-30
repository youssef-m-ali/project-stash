import { NextResponse } from 'next/server';
import db from '@/lib/db';

type Params = { params: Promise<{ merchantKey: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const { merchantKey } = await params;
  db.prepare('DELETE FROM merchant_memory WHERE merchant_key = ?').run(
    decodeURIComponent(merchantKey),
  );
  return NextResponse.json({ ok: true });
}
