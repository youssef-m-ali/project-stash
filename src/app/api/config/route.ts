import { NextResponse } from 'next/server';
import db, { regeneratePeriods, FIXED_EXPENSES_BUCKET_ID } from '@/lib/db';
import type { BudgetState, Account, Bucket, FixedExpense } from '@/lib/types';

function rowToAccount(r: Record<string, unknown>): Account {
  return {
    id: r.id as string,
    label: r.label as string,
    kind: r.kind as Account['kind'],
  };
}

function rowToFixedExpense(r: Record<string, unknown>): FixedExpense {
  return {
    id: r.id as string,
    name: r.name as string,
    amount: r.amount as number,
    dueDayOfMonth: r.due_day_of_month as number,
    emoji: (r.emoji as string | null) ?? null,
    sortOrder: r.sort_order as number,
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
    isSpecial: Boolean(r.is_special),
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

  const fixedExpenses = (
    db.prepare('SELECT * FROM fixed_expenses ORDER BY sort_order').all() as Record<string, unknown>[]
  ).map(rowToFixedExpense);

  const state: BudgetState = {
    schemaVersion: 4,
    currency: cfg.currency as string,
    income: {
      netPerPaycheck: income.net_per_paycheck as number,
      firstPaycheckDate: income.first_paycheck_date as string,
      frequency: 'biweekly',
    },
    fixedExpenses,
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

    // Upsert accounts; only delete ones removed from the list.
    // (Cannot DELETE FROM accounts wholesale — transactions.account_id is NOT NULL REFERENCES)
    const accountIds = body.accounts.map(a => a.id);
    if (accountIds.length > 0) {
      db.prepare(`DELETE FROM accounts WHERE id NOT IN (${accountIds.map(() => '?').join(',')})`).run(...accountIds);
    }
    for (const a of body.accounts) {
      db.prepare(`
        INSERT INTO accounts (id, label, kind) VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          label = excluded.label,
          kind  = excluded.kind
      `).run(a.id, a.label, a.kind);
    }

    // Replace fixed expenses
    db.prepare('DELETE FROM fixed_expenses').run();
    for (let i = 0; i < (body.fixedExpenses ?? []).length; i++) {
      const e = body.fixedExpenses[i];
      db.prepare(`
        INSERT INTO fixed_expenses (id, name, amount, due_day_of_month, emoji, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(e.id, e.name, e.amount, e.dueDayOfMonth, e.emoji ?? null, i);
    }

    // Upsert buckets; only delete ones removed from the list.
    // Avoids cascading merchant_memory deletes and nulling approved transaction bucket assignments.
    // The special Fixed Expenses bucket (is_special = 1) is never deleted or modified here.
    const bucketIds = body.buckets.map(b => b.id);
    if (bucketIds.length > 0) {
      db.prepare(`DELETE FROM buckets WHERE id NOT IN (${bucketIds.map(() => '?').join(',')}) AND is_special = 0`).run(...bucketIds);
    } else {
      db.prepare('DELETE FROM buckets WHERE is_special = 0').run();
    }
    for (let i = 0; i < body.buckets.length; i++) {
      const b = body.buckets[i];
      if (b.id === FIXED_EXPENSES_BUCKET_ID) continue;
      db.prepare(`
        INSERT INTO buckets (id, name, amount_per_paycheck, color, emoji, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name                = excluded.name,
          amount_per_paycheck = excluded.amount_per_paycheck,
          color               = excluded.color,
          emoji               = excluded.emoji,
          sort_order          = excluded.sort_order
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
      'fixed_expenses',
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
