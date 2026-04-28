import { v4 as uuid } from 'uuid';
import { format, nextFriday } from 'date-fns';
import type { BudgetState } from '../types';

export function sampleBudgetState(): BudgetState {
  const firstPaycheck = nextFriday(new Date());
  return {
    schemaVersion: 1,
    currency: '$',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    income: {
      netPerPaycheck: 2200,
      frequency: 'biweekly',
      firstPaycheckDate: format(firstPaycheck, 'yyyy-MM-dd'),
      payDayOfWeek: firstPaycheck.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    },
    fixedExpenses: [
      { id: uuid(), name: 'Rent', amount: 1400, dueDayOfMonth: 1, category: 'housing' },
      { id: uuid(), name: 'Utilities', amount: 120, dueDayOfMonth: 15, category: 'utilities' },
      { id: uuid(), name: 'Phone', amount: 55, dueDayOfMonth: 20, category: 'utilities' },
      { id: uuid(), name: 'Car insurance', amount: 90, dueDayOfMonth: 10, category: 'insurance' },
    ],
    variableExpenses: [
      { id: uuid(), name: 'Groceries', monthlyBudget: 400, isCap: false },
      { id: uuid(), name: 'Dining out', monthlyBudget: 150, isCap: true },
      { id: uuid(), name: 'Gas', monthlyBudget: 80, isCap: false },
      { id: uuid(), name: 'Personal care', monthlyBudget: 50, isCap: false },
      { id: uuid(), name: 'Buffer', monthlyBudget: 100, isCap: false },
    ],
    subscriptions: [
      { id: uuid(), name: 'Netflix', monthlyAmount: 17, usedRecently: true, markedForCancel: false },
      { id: uuid(), name: 'Spotify', monthlyAmount: 11, usedRecently: true, markedForCancel: false },
      { id: uuid(), name: 'Gym', monthlyAmount: 40, usedRecently: false, markedForCancel: false },
    ],
    savingsGoal: {
      targetRate: 0.3,
      buckets: [
        { id: uuid(), name: 'TFSA', percentageOfSavings: 0.5 },
        { id: uuid(), name: 'House fund', percentageOfSavings: 0.5 },
      ],
    },
  };
}
