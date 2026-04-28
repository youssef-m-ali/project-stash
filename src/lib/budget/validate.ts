import { isValid, parseISO } from 'date-fns';
import type { BudgetState, ValidationResult } from '../types';

export function validateBudgetState(state: BudgetState): ValidationResult {
  const errors: { field: string; message: string }[] = [];

  // Savings rate
  if (state.savingsGoal.targetRate < 0 || state.savingsGoal.targetRate > 1) {
    errors.push({ field: 'savingsGoal.targetRate', message: 'Target savings rate must be between 0 and 1' });
  }

  // Bucket percentages sum to 1
  const bucketSum = state.savingsGoal.buckets.reduce((s, b) => s + b.percentageOfSavings, 0);
  if (state.savingsGoal.buckets.length > 0 && Math.abs(bucketSum - 1) > 0.001) {
    errors.push({ field: 'savingsGoal.buckets', message: `Bucket percentages must sum to 100%, currently ${Math.round(bucketSum * 100)}%` });
  }

  // firstPaycheckDate valid
  const parsedDate = parseISO(state.income.firstPaycheckDate);
  if (!isValid(parsedDate)) {
    errors.push({ field: 'income.firstPaycheckDate', message: 'First paycheck date is not a valid date' });
  }

  // All amounts >= 0
  if (state.income.netPerPaycheck < 0) {
    errors.push({ field: 'income.netPerPaycheck', message: 'Net per paycheck must be >= 0' });
  }
  for (const e of state.fixedExpenses) {
    if (e.amount < 0) {
      errors.push({ field: `fixedExpenses.${e.id}.amount`, message: `Fixed expense "${e.name}" amount must be >= 0` });
    }
  }
  for (const e of state.variableExpenses) {
    if (e.monthlyBudget < 0) {
      errors.push({ field: `variableExpenses.${e.id}.monthlyBudget`, message: `Variable expense "${e.name}" budget must be >= 0` });
    }
  }
  for (const s of state.subscriptions) {
    if (s.monthlyAmount < 0) {
      errors.push({ field: `subscriptions.${s.id}.monthlyAmount`, message: `Subscription "${s.name}" amount must be >= 0` });
    }
  }

  // No duplicate account IDs
  const accountIds = (state.accounts ?? []).map((a) => a.id);
  const accountIdSet = new Set<string>();
  for (const id of accountIds) {
    if (accountIdSet.has(id)) {
      errors.push({ field: 'accounts', message: `Duplicate account ID: ${id}` });
    }
    accountIdSet.add(id);
  }

  // No duplicate IDs across budget items
  const allIds = [
    ...state.fixedExpenses.map((e) => e.id),
    ...state.variableExpenses.map((e) => e.id),
    ...state.subscriptions.map((s) => s.id),
    ...state.savingsGoal.buckets.map((b) => b.id),
  ];
  const seen = new Set<string>();
  for (const id of allIds) {
    if (seen.has(id)) {
      errors.push({ field: 'ids', message: `Duplicate ID found: ${id}` });
    }
    seen.add(id);
  }

  return { valid: errors.length === 0, errors };
}
