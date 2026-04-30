import { NextResponse } from 'next/server';
import db from '@/lib/db';
import type { PaycheckPeriod } from '@/lib/types';

function rowToPeriod(r: Record<string, unknown>): PaycheckPeriod {
  return {
    id: r.id as string,
    startDate: r.start_date as string,
    endDate: r.end_date as string,
    paycheckAmount: r.paycheck_amount as number,
  };
}

export function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  if (searchParams.get('current') === 'true') {
    const today = new Date().toISOString().slice(0, 10);
    const row = db
      .prepare(`SELECT * FROM paycheck_periods WHERE start_date <= ? AND ? <= end_date LIMIT 1`)
      .get(today, today) as Record<string, unknown> | undefined;
    return NextResponse.json({ period: row ? rowToPeriod(row) : null });
  }

  const rows = db
    .prepare('SELECT * FROM paycheck_periods ORDER BY start_date DESC')
    .all() as Record<string, unknown>[];
  return NextResponse.json({ periods: rows.map(rowToPeriod) });
}
