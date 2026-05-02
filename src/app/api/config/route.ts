import { NextResponse } from 'next/server';
import db, { regeneratePeriods } from '@/lib/db';
import type { BudgetState, Account, Bucket } from '@/lib/types';

function rowToAccount(r: Record<string, unknown>): Account {
  return {
    id: r.id as string,
    label: r.label as string,
    kind: r.kind as Account['kind'],
    isPassThrough: Boolean(r.is_pass_through),
  };
}

function rowToBucket(r: Record<string, unknown>): Bucket {
  return {
    id: r.id as string,
    name: r.name as string,
    amountPerPaycheck: r.amount_per_paycheck as number,
    color: r.color as string,
    emoji: (r.emoji as string | null) ?? null,
    sortOrder: r.sort_order as number,
  };
}

export function GET() {
  const cfg = db.prepare('SELECT * FROM budget_config WHERE id = 1').get() as
    | Record<string, unknown>
    | undefined;
  if (!cfg) return NextResponse.json(null);

  const income = db.prepare('SELECT * FROM income WHERE id = 1').get() as
    | Record<string, unknown>
    | undefined;
  if (!income) return NextResponse.json(null);

  const accounts = (
    db.prepare('SELECT * FROM accounts ORDER BY label').all() as Record<string, unknown>[]
  ).map(rowToAccount);

  const buckets = (
    db.prepare('SELECT * FROM buckets ORDER BY sort_order, name').all() as Record<string, unknown>[]
  ).map(rowToBucket);

  const state: BudgetState = {
    schemaVersion: 4,
    currency: cfg.currency as string,
    income: {
      netPerPaycheck: income.net_per_paycheck as number,
      firstPaycheckDate: income.first_paycheck_date as string,
      frequency: 'biweekly',
    },
    accounts,
    buckets,
  };

  return NextResponse.json(state);
}

export async function POST(req: Request) {
  const body: BudgetState = await req.json();

  db.transaction(() => {
    // Upsert budget_config
    db.prepare(`
      INSERT INTO budget_config (id, currency, schema_version)
      VALUES (1, ?, 4)
      ON CONFLICT(id) DO UPDATE SET currency = excluded.currency
    `).run(body.currency ?? '$');

    // Upsert income
    db.prepare(`
      INSERT INTO income (id, net_per_paycheck, frequency, first_paycheck_date)
      VALUES (1, ?, 'biweekly', ?)
      ON CONFLICT(id) DO UPDATE SET
        net_per_paycheck    = excluded.net_per_paycheck,
        first_paycheck_date = excluded.first_paycheck_date
    `).run(body.income.netPerPaycheck, body.income.firstPaycheckDate);

    // Replace accounts
    db.prepare('DELETE FROM accounts').run();
    for (const a of body.accounts) {
      db.prepare(`
        INSERT INTO accounts (id, label, kind, is_pass_through)
        VALUES (?, ?, ?, ?)
      `).run(a.id, a.label, a.kind, a.isPassThrough ? 1 : 0);
    }

    // Replace buckets (keep merchant_memory via ON DELETE CASCADE on bucket deletion)
    db.prepare('DELETE FROM buckets').run();
    for (let i = 0; i < body.buckets.length; i++) {
      const b = body.buckets[i];
      db.prepare(`
        INSERT INTO buckets (id, name, amount_per_paycheck, color, emoji, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(b.id, b.name, b.amountPerPaycheck, b.color, b.emoji ?? null, i);
    }
  })();

  // Regenerate periods whenever income or config is saved
  regeneratePeriods(body.income.firstPaycheckDate, body.income.netPerPaycheck);

  return NextResponse.json({ ok: true });
}

export function DELETE() {
  db.transaction(() => {
    for (const tbl of [
      'merchant_memory',
      'transactions',
      'paycheck_periods',
      'buckets',
      'accounts',
      'income',
      'budget_config',
    ]) {
      db.prepare(`DELETE FROM ${tbl}`).run();
    }
  })();
  return NextResponse.json({ ok: true });
}
