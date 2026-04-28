'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { BudgetState, Paycheck, PaycheckAllocation, MonthlySummary } from '@/lib/types';
import { localStorageAdapter } from '@/lib/storage/localStorage';
import { generatePaychecks } from '@/lib/budget/paychecks';
import { allocatePaychecks } from '@/lib/budget/allocate';
import { monthlyRollup } from '@/lib/budget/rollup';

export interface ComputedBudget {
  paychecks: Paycheck[];
  allocations: PaycheckAllocation[];
  summaries: MonthlySummary[];
  sixMonthSavings: number;
  effectiveSavingsRate: number;
}

interface BudgetContextValue {
  state: BudgetState;
  computed: ComputedBudget;
  reload: () => void;
}

const BudgetContext = createContext<BudgetContextValue | null>(null);

function compute(state: BudgetState): ComputedBudget {
  const paychecks = generatePaychecks(
    state.income.firstPaycheckDate,
    state.income.netPerPaycheck,
    6,
  );
  const allocations = allocatePaychecks(
    paychecks,
    state.fixedExpenses,
    state.variableExpenses,
    state.subscriptions,
  );
  const summaries = monthlyRollup(
    allocations,
    state.savingsGoal.targetRate,
    state.variableExpenses,
  );

  const sixMonthSavings = summaries.reduce((s, m) => s + Math.max(0, m.budgetedSavings), 0);
  const totalIncome = summaries.reduce((s, m) => s + m.netIncome, 0);
  const effectiveSavingsRate = totalIncome > 0 ? sixMonthSavings / totalIncome : 0;

  return { paychecks, allocations, summaries, sixMonthSavings, effectiveSavingsRate };
}

export function BudgetProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [value, setValue] = useState<BudgetContextValue | null>(null);

  function load() {
    const state = localStorageAdapter.loadState();
    if (!state) {
      router.replace('/');
      return;
    }
    setValue({ state, computed: compute(state), reload: load });
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!value) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-zinc-500 text-sm">Loading…</span>
      </div>
    );
  }

  return <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>;
}

export function useBudget(): BudgetContextValue {
  const ctx = useContext(BudgetContext);
  if (!ctx) throw new Error('useBudget must be used inside BudgetProvider');
  return ctx;
}
