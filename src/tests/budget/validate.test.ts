import { describe, it, expect } from 'vitest';
import { validateBudgetState } from '@/lib/budget/validate';
import type { BudgetState } from '@/lib/types';

const validState: BudgetState = {
  schemaVersion: 1,
  currency: '$',
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
  income: {
    netPerPaycheck: 2000,
    frequency: 'biweekly',
    firstPaycheckDate: '2026-05-01',
    payDayOfWeek: 5,
  },
  fixedExpenses: [
    { id: 'rent', name: 'Rent', amount: 1200, dueDayOfMonth: 1, category: 'housing' },
  ],
  variableExpenses: [
    { id: 'groceries', name: 'Groceries', monthlyBudget: 400, isCap: false },
  ],
  subscriptions: [
    { id: 'netflix', name: 'Netflix', monthlyAmount: 18, dueDayOfMonth: 1, usedRecently: true, markedForCancel: false },
  ],
  savingsGoal: {
    targetRate: 0.3,
    buckets: [{ id: 'gen', name: 'General', percentageOfSavings: 1 }],
  },
  accounts: [],
};

describe('validateBudgetState', () => {
  it('passes for a valid state', () => {
    const result = validateBudgetState(validState);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails when bucket percentages do not sum to 1', () => {
    const state: BudgetState = {
      ...validState,
      savingsGoal: {
        targetRate: 0.3,
        buckets: [
          { id: 'a', name: 'A', percentageOfSavings: 0.4 },
          { id: 'b', name: 'B', percentageOfSavings: 0.4 },
        ],
      },
    };
    const result = validateBudgetState(state);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'savingsGoal.buckets')).toBe(true);
  });

  it('fails when target rate is out of 0–1 range', () => {
    const state: BudgetState = { ...validState, savingsGoal: { ...validState.savingsGoal, targetRate: 1.5 } };
    const result = validateBudgetState(state);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'savingsGoal.targetRate')).toBe(true);
  });

  it('fails on invalid firstPaycheckDate', () => {
    const state: BudgetState = {
      ...validState,
      income: { ...validState.income, firstPaycheckDate: 'not-a-date' },
    };
    const result = validateBudgetState(state);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'income.firstPaycheckDate')).toBe(true);
  });

  it('fails on negative expense amount', () => {
    const state: BudgetState = {
      ...validState,
      fixedExpenses: [{ ...validState.fixedExpenses[0], amount: -100 }],
    };
    const result = validateBudgetState(state);
    expect(result.valid).toBe(false);
  });

  it('fails on duplicate IDs', () => {
    const state: BudgetState = {
      ...validState,
      fixedExpenses: [
        { id: 'dup', name: 'A', amount: 100, dueDayOfMonth: 1, category: 'utilities' },
        { id: 'dup', name: 'B', amount: 200, dueDayOfMonth: 15, category: 'utilities' },
      ],
    };
    const result = validateBudgetState(state);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'ids')).toBe(true);
  });

  it('fails on negative income', () => {
    const state: BudgetState = {
      ...validState,
      income: { ...validState.income, netPerPaycheck: -500 },
    };
    const result = validateBudgetState(state);
    expect(result.valid).toBe(false);
  });
});
