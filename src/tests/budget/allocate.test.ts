import { describe, it, expect } from 'vitest';
import { generatePaychecks } from '@/lib/budget/paychecks';
import { allocatePaychecks } from '@/lib/budget/allocate';
import type { FixedExpense, VariableExpense, Subscription } from '@/lib/types';

const rent: FixedExpense = {
  id: 'rent',
  name: 'Rent',
  amount: 1200,
  dueDayOfMonth: 1,
  category: 'housing',
};

const utilities: FixedExpense = {
  id: 'utils',
  name: 'Utilities',
  amount: 150,
  dueDayOfMonth: 15,
  category: 'utilities',
};

const groceries: VariableExpense = {
  id: 'groceries',
  name: 'Groceries',
  monthlyBudget: 400,
  isCap: false,
};

const noSubs: Subscription[] = [];

describe('allocatePaychecks', () => {
  it('returns one allocation per paycheck', () => {
    const paychecks = generatePaychecks('2026-05-01', 2000, 6);
    const allocations = allocatePaychecks(paychecks, [rent], [groceries], noSubs);
    expect(allocations.length).toBe(paychecks.length);
  });

  it('variable allowance is sum(monthlyBudgets) / 2', () => {
    const paychecks = generatePaychecks('2026-05-01', 2000, 6);
    const allocations = allocatePaychecks(paychecks, [], [groceries], noSubs);
    for (const a of allocations) {
      expect(a.variableAllowance).toBe(200); // 400/2
    }
  });

  it('savings = paycheck - bills - variable allowance', () => {
    const paychecks = generatePaychecks('2026-05-01', 2000, 6);
    const allocations = allocatePaychecks(paychecks, [utilities], [groceries], noSubs);
    for (const a of allocations) {
      expect(a.savings).toBeCloseTo(a.paycheck.amount - a.totalBills - a.variableAllowance, 5);
    }
  });

  it('assigns rent due on 1st to the May 1 paycheck', () => {
    const paychecks = generatePaychecks('2026-05-01', 2000, 6);
    const allocations = allocatePaychecks(paychecks, [rent], [], noSubs);
    const may1 = allocations.find((a) => a.paycheck.date === '2026-05-01')!;
    expect(may1).toBeDefined();
    expect(may1.billsPaid.some((b) => b.name === 'Rent')).toBe(true);
  });

  it('assigns utilities due on 15th to the May 15 paycheck', () => {
    const paychecks = generatePaychecks('2026-05-01', 2000, 6);
    const allocations = allocatePaychecks(paychecks, [utilities], [], noSubs);
    const may15 = allocations.find((a) => a.paycheck.date === '2026-05-15')!;
    expect(may15).toBeDefined();
    expect(may15.billsPaid.some((b) => b.name === 'Utilities')).toBe(true);
  });

  it('paycheck on same day as bill due date pays the bill', () => {
    const paychecks = generatePaychecks('2026-05-01', 2000, 6);
    const allocations = allocatePaychecks(paychecks, [rent], [], noSubs);
    const may1 = allocations.find((a) => a.paycheck.date === '2026-05-01')!;
    expect(may1.billsPaid.length).toBeGreaterThan(0);
  });

  it('3-paycheck month: 3rd paycheck funds advance rent for next month', () => {
    // May 2026 has 3 paychecks: May 1, 15, 29
    const paychecks = generatePaychecks('2026-05-01', 2000, 6);
    const allocations = allocatePaychecks(paychecks, [rent], [], noSubs);
    const may29 = allocations.find((a) => a.paycheck.date === '2026-05-29')!;
    expect(may29).toBeDefined();
    expect(may29.billsPaid.some((b) => b.name.includes('next month'))).toBe(true);
    expect(may29.notes).toContain('next month');
  });

  it('in a 2-paycheck month, rent is not pre-funded on the last paycheck', () => {
    // June 2026: paychecks on Jun 12 and Jun 26 — only 2
    const paychecks = generatePaychecks('2026-05-01', 2000, 6);
    const junePay = paychecks.filter((p) => p.monthKey === '2026-06');
    expect(junePay.length).toBe(2);
    const allocations = allocatePaychecks(paychecks, [rent], [], noSubs);
    const juneLast = allocations.find((a) => a.paycheck.date === junePay[junePay.length - 1].date)!;
    expect(juneLast.billsPaid.every((b) => !b.name.includes('next month'))).toBe(true);
  });

  it('subscriptions are included as a synthetic bill', () => {
    const sub: Subscription = { id: 's1', name: 'Netflix', monthlyAmount: 20, usedRecently: true, markedForCancel: false };
    const paychecks = generatePaychecks('2026-05-01', 2000, 6);
    const allocations = allocatePaychecks(paychecks, [], [], [sub]);
    const hasSub = allocations.some((a) => a.billsPaid.some((b) => b.name === 'Subscriptions'));
    expect(hasSub).toBe(true);
  });

  it('cancelled subscriptions are excluded from bills', () => {
    const sub: Subscription = { id: 's1', name: 'Netflix', monthlyAmount: 20, usedRecently: true, markedForCancel: true };
    const paychecks = generatePaychecks('2026-05-01', 2000, 6);
    const allocations = allocatePaychecks(paychecks, [], [], [sub]);
    const hasSub = allocations.some((a) => a.billsPaid.some((b) => b.name === 'Subscriptions'));
    expect(hasSub).toBe(false);
  });

  it('non-housing bills due before the first paycheck of the month get assigned to the prior month\'s last paycheck', () => {
    // May 2026: May 1, 15, 29 (3 paychecks). June: Jun 12, Jun 26.
    // A bill due June 5 has no June paycheck before it, so May 29 (7 days prior) should cover it.
    const earlyJuneBill: FixedExpense = {
      id: 'phone',
      name: 'Phone',
      amount: 60,
      dueDayOfMonth: 5,
      category: 'utilities',
    };
    const paychecks = generatePaychecks('2026-05-01', 2000, 6);
    const allocations = allocatePaychecks(paychecks, [earlyJuneBill], [], noSubs);
    const may29 = allocations.find((a) => a.paycheck.date === '2026-05-29')!;
    expect(may29.billsPaid.some((b) => b.name === 'Phone')).toBe(true);
  });

  it('housing in the month after a 3-paycheck month is not double-assigned', () => {
    // May 29 advances June rent. Jun 12 (first June paycheck, mid-month) must NOT
    // also carry a plain "Rent" entry — that would double-count June's housing.
    // Jun 26 legitimately carries July rent (it is 5 days before July 1), which is fine.
    const paychecks = generatePaychecks('2026-05-01', 2000, 6);
    const allocations = allocatePaychecks(paychecks, [rent], [], noSubs);
    const jun12 = allocations.find((a) => a.paycheck.date === '2026-06-12')!;
    expect(jun12.billsPaid.every((b) => b.name !== 'Rent')).toBe(true);
  });

  it('returns empty array for empty paychecks', () => {
    expect(allocatePaychecks([], [rent], [groceries], noSubs)).toEqual([]);
  });

  it('handles no fixed or variable expenses — all goes to savings', () => {
    const paychecks = generatePaychecks('2026-05-01', 2000, 6);
    const allocations = allocatePaychecks(paychecks, [], [], noSubs);
    for (const a of allocations) {
      expect(a.totalBills).toBe(0);
      expect(a.variableAllowance).toBe(0);
      expect(a.savings).toBe(a.paycheck.amount);
    }
  });
});
