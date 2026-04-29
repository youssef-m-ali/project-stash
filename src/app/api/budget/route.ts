import db, { regeneratePaychecks } from '@/lib/db';
import type { BudgetState, FixedExpense, Account } from '@/lib/types';

// ── Row types ─────────────────────────────────────────────────────────────────

type ConfigRow = { currency: string; schema_version: number; created_at: string; updated_at: string };
type IncomeRow = { net_per_paycheck: number; frequency: string; first_paycheck_date: string; pay_day_of_week: number };
type FixedRow = { id: string; name: string; amount: number; due_day_of_month: number; category: string };
type VarRow = { id: string; name: string; monthly_budget: number; is_cap: number };
type SubRow = { id: string; name: string; monthly_amount: number; due_day_of_month: number; used_recently: number; marked_for_cancel: number };
type GoalRow = { target_rate: number };
type BucketRow = { id: string; name: string; percentage_of_savings: number; notes: string | null };
type AccountRow = { id: string; label: string; kind: string; is_pass_through: number };

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  const config = db.prepare('SELECT currency, schema_version, created_at, updated_at FROM budget_config WHERE id = 1').get() as ConfigRow | undefined;
  if (!config) return Response.json(null);

  const income = db.prepare('SELECT net_per_paycheck, frequency, first_paycheck_date, pay_day_of_week FROM income WHERE id = 1').get() as IncomeRow | undefined;
  if (!income) return Response.json(null);

  const fixedRows = db.prepare('SELECT id, name, amount, due_day_of_month, category FROM fixed_expenses ORDER BY sort_order').all() as FixedRow[];
  const varRows = db.prepare('SELECT id, name, monthly_budget, is_cap FROM variable_expenses ORDER BY sort_order').all() as VarRow[];
  const subRows = db.prepare('SELECT id, name, monthly_amount, due_day_of_month, used_recently, marked_for_cancel FROM subscriptions').all() as SubRow[];
  const goal = db.prepare('SELECT target_rate FROM savings_goal WHERE id = 1').get() as GoalRow | undefined;
  const bucketRows = db.prepare('SELECT id, name, percentage_of_savings, notes FROM savings_buckets ORDER BY sort_order').all() as BucketRow[];
  const accountRows = db.prepare('SELECT id, label, kind, is_pass_through FROM accounts').all() as AccountRow[];

  const state: BudgetState = {
    schemaVersion: config.schema_version,
    currency: config.currency,
    createdAt: config.created_at,
    updatedAt: config.updated_at,
    income: {
      netPerPaycheck: income.net_per_paycheck,
      frequency: income.frequency as 'biweekly',
      firstPaycheckDate: income.first_paycheck_date,
      payDayOfWeek: income.pay_day_of_week as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    },
    fixedExpenses: fixedRows.map((r) => ({
      id: r.id,
      name: r.name,
      amount: r.amount,
      dueDayOfMonth: r.due_day_of_month,
      category: r.category as FixedExpense['category'],
    })),
    variableExpenses: varRows.map((r) => ({
      id: r.id,
      name: r.name,
      monthlyBudget: r.monthly_budget,
      isCap: Boolean(r.is_cap),
    })),
    subscriptions: subRows.map((r) => ({
      id: r.id,
      name: r.name,
      monthlyAmount: r.monthly_amount,
      dueDayOfMonth: r.due_day_of_month,
      usedRecently: Boolean(r.used_recently),
      markedForCancel: Boolean(r.marked_for_cancel),
    })),
    savingsGoal: {
      targetRate: goal?.target_rate ?? 0.2,
      buckets: bucketRows.map((r) => ({
        id: r.id,
        name: r.name,
        percentageOfSavings: r.percentage_of_savings,
        ...(r.notes != null && { notes: r.notes }),
      })),
    },
    accounts: accountRows.map((r) => ({
      id: r.id,
      label: r.label,
      kind: r.kind as Account['kind'],
      isPassThrough: Boolean(r.is_pass_through),
    })),
  };

  return Response.json(state);
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const state = (await request.json()) as BudgetState;

  db.transaction(() => {
    db.prepare(`
      INSERT INTO budget_config (id, currency, schema_version, updated_at)
      VALUES (1, ?, 3, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        currency = excluded.currency,
        schema_version = excluded.schema_version,
        updated_at = excluded.updated_at
    `).run(state.currency);

    db.prepare(`
      INSERT INTO income (id, net_per_paycheck, frequency, first_paycheck_date, pay_day_of_week)
      VALUES (1, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        net_per_paycheck = excluded.net_per_paycheck,
        frequency = excluded.frequency,
        first_paycheck_date = excluded.first_paycheck_date,
        pay_day_of_week = excluded.pay_day_of_week
    `).run(
      state.income.netPerPaycheck,
      state.income.frequency,
      state.income.firstPaycheckDate,
      state.income.payDayOfWeek,
    );

    const insertFixed = db.prepare(`
      INSERT INTO fixed_expenses (id, name, amount, due_day_of_month, category, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    db.prepare('DELETE FROM fixed_expenses').run();
    state.fixedExpenses.forEach((e, i) => insertFixed.run(e.id, e.name, e.amount, e.dueDayOfMonth, e.category, i));

    const insertVar = db.prepare(`
      INSERT INTO variable_expenses (id, name, monthly_budget, is_cap, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `);
    db.prepare('DELETE FROM variable_expenses').run();
    state.variableExpenses.forEach((e, i) => insertVar.run(e.id, e.name, e.monthlyBudget, e.isCap ? 1 : 0, i));

    const insertSub = db.prepare(`
      INSERT INTO subscriptions (id, name, monthly_amount, due_day_of_month, used_recently, marked_for_cancel)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    db.prepare('DELETE FROM subscriptions').run();
    state.subscriptions.forEach((s) =>
      insertSub.run(s.id, s.name, s.monthlyAmount, s.dueDayOfMonth, s.usedRecently ? 1 : 0, s.markedForCancel ? 1 : 0),
    );

    db.prepare(`INSERT OR REPLACE INTO savings_goal (id, target_rate) VALUES (1, ?)`)
      .run(state.savingsGoal.targetRate);

    const insertBucket = db.prepare(`
      INSERT INTO savings_buckets (id, name, percentage_of_savings, notes, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `);
    db.prepare('DELETE FROM savings_buckets').run();
    state.savingsGoal.buckets.forEach((b, i) =>
      insertBucket.run(b.id, b.name, b.percentageOfSavings, b.notes ?? null, i),
    );

    const insertAccount = db.prepare(`
      INSERT INTO accounts (id, label, kind, is_pass_through)
      VALUES (?, ?, ?, ?)
    `);
    db.prepare('DELETE FROM accounts').run();
    state.accounts.forEach((a) => insertAccount.run(a.id, a.label, a.kind, a.isPassThrough ? 1 : 0));
  })();

  regeneratePaychecks(state.income.firstPaycheckDate, state.income.netPerPaycheck);

  return Response.json({ ok: true });
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE() {
  db.transaction(() => {
    for (const table of [
      'budget_config', 'income', 'paychecks',
      'fixed_expenses', 'variable_expenses', 'subscriptions',
      'savings_goal', 'savings_buckets', 'accounts', 'actuals',
    ]) {
      db.prepare(`DELETE FROM ${table}`).run();
    }
  })();
  return Response.json({ ok: true });
}
