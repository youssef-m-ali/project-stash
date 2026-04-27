import type { PaycheckAllocation, MonthlySummary, VariableExpense } from '../types';

export function monthlyRollup(
  allocations: PaycheckAllocation[],
  targetRate: number,
  variableExpenses: VariableExpense[],
): MonthlySummary[] {
  const byMonth = new Map<string, PaycheckAllocation[]>();
  for (const a of allocations) {
    const arr = byMonth.get(a.paycheck.monthKey) ?? [];
    arr.push(a);
    byMonth.set(a.paycheck.monthKey, arr);
  }

  const monthlyVariableTotal = variableExpenses.reduce((s, e) => s + e.monthlyBudget, 0);

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, group]) => {
      const netIncome = group.reduce((s, a) => s + a.paycheck.amount, 0);
      const fixedSpending = group.reduce((s, a) => s + a.totalBills, 0);
      // Variable spending is the monthly budget (not per-paycheck allowance * count)
      const variableSpending = monthlyVariableTotal;
      const totalSpending = fixedSpending + variableSpending;
      const budgetedSavings = netIncome - totalSpending;
      const savingsRate = netIncome > 0 ? budgetedSavings / netIncome : 0;

      return {
        monthKey,
        paycheckCount: group.length,
        netIncome,
        fixedSpending,
        variableSpending,
        totalSpending,
        budgetedSavings,
        savingsRate,
        hitsGoal: savingsRate >= targetRate,
      };
    });
}
