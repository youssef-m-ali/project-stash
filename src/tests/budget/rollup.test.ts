import { describe, it, expect } from 'vitest';
import { generatePaychecks } from '@/lib/budget/paychecks';
import { allocatePaychecks } from '@/lib/budget/allocate';
import { monthlyRollup } from '@/lib/budget/rollup';
import type { FixedExpense, VariableExpense } from '@/lib/types';

const rent: FixedExpense = { id: 'rent', name: 'Rent', amount: 1200, dueDayOfMonth: 1, category: 'housing' };
const groceries: VariableExpense = { id: 'g', name: 'Groceries', monthlyBudget: 400, isCap: false };

describe('monthlyRollup', () => {
  it('produces one entry per calendar month in the window', () => {
    const paychecks = generatePaychecks('2026-05-01', 2000, 6);
    const allocations = allocatePaychecks(paychecks, [], [], []);
    const rollup = monthlyRollup(allocations, 0.3, []);
    expect(rollup.length).toBe(6);
  });

  it('paycheckCount is 3 for 3-paycheck months', () => {
    const paychecks = generatePaychecks('2026-05-01', 2000, 6);
    const allocations = allocatePaychecks(paychecks, [], [], []);
    const rollup = monthlyRollup(allocations, 0.3, []);
    const may = rollup.find((m) => m.monthKey === '2026-05')!;
    expect(may.paycheckCount).toBe(3);
  });

  it('paycheckCount is 2 for a normal month', () => {
    const paychecks = generatePaychecks('2026-05-01', 2000, 6);
    const allocations = allocatePaychecks(paychecks, [], [], []);
    const rollup = monthlyRollup(allocations, 0.3, []);
    const jun = rollup.find((m) => m.monthKey === '2026-06')!;
    expect(jun.paycheckCount).toBe(2);
  });

  it('hitsGoal is true when savings rate meets target', () => {
    // No expenses, all money is savings — rate = 1.0, target = 0.5
    const paychecks = generatePaychecks('2026-05-01', 2000, 6);
    const allocations = allocatePaychecks(paychecks, [], [], []);
    const rollup = monthlyRollup(allocations, 0.5, []);
    for (const m of rollup) {
      expect(m.hitsGoal).toBe(true);
    }
  });

  it('hitsGoal is false when expenses exceed the savings target', () => {
    const bigRent: FixedExpense = { ...rent, amount: 3500 };
    const paychecks = generatePaychecks('2026-05-01', 2000, 6);
    const allocations = allocatePaychecks(paychecks, [bigRent], [], []);
    const rollup = monthlyRollup(allocations, 0.5, []);
    const failing = rollup.filter((m) => !m.hitsGoal);
    expect(failing.length).toBeGreaterThan(0);
  });

  it('netIncome equals paycheckCount * netPerPaycheck', () => {
    const paychecks = generatePaychecks('2026-05-01', 2000, 6);
    const allocations = allocatePaychecks(paychecks, [], [], []);
    const rollup = monthlyRollup(allocations, 0.3, []);
    for (const m of rollup) {
      expect(m.netIncome).toBe(m.paycheckCount * 2000);
    }
  });

  it('budgetedSavings = netIncome - totalSpending', () => {
    const paychecks = generatePaychecks('2026-05-01', 2000, 6);
    const allocations = allocatePaychecks(paychecks, [rent], [groceries], []);
    const rollup = monthlyRollup(allocations, 0.3, [groceries]);
    for (const m of rollup) {
      expect(m.budgetedSavings).toBeCloseTo(m.netIncome - m.totalSpending, 5);
    }
  });
});
