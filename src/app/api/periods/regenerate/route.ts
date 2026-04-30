import { NextResponse } from 'next/server';
import db, { regeneratePeriods } from '@/lib/db';

export function POST() {
  const income = db.prepare('SELECT * FROM income WHERE id = 1').get() as
    | { net_per_paycheck: number; first_paycheck_date: string }
    | undefined;

  if (!income) {
    return NextResponse.json({ error: 'No income configured' }, { status: 400 });
  }

  regeneratePeriods(income.first_paycheck_date, income.net_per_paycheck);

  const count = (
    db.prepare('SELECT COUNT(*) as c FROM paycheck_periods').get() as { c: number }
  ).c;

  return NextResponse.json({ ok: true, count });
}
