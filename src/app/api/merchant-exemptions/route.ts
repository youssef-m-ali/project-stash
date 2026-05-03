import { NextResponse } from 'next/server';
import db from '@/lib/db';

export function GET() {
  const rows = db
    .prepare('SELECT merchant_key, created_at FROM merchant_exemptions ORDER BY created_at DESC')
    .all() as { merchant_key: string; created_at: string }[];
  return NextResponse.json({ exemptions: rows.map(r => ({ merchantKey: r.merchant_key, createdAt: r.created_at })) });
}

export async function POST(req: Request) {
  const { merchantKey } = (await req.json()) as { merchantKey: string };
  if (!merchantKey) return Response.json({ error: 'merchantKey required' }, { status: 400 });
  db.prepare('INSERT OR IGNORE INTO merchant_exemptions (merchant_key) VALUES (?)').run(merchantKey);
  return Response.json({ ok: true });
}
