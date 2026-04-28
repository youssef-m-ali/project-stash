'use client';

import { useBudget } from '@/lib/context/BudgetContext';
import { StatCard } from '@/components/dashboard/StatCard';
import { SpendingPieChart } from '@/components/dashboard/SpendingPieChart';
import { SavingsBarChart } from '@/components/dashboard/SavingsBarChart';

function fmt(n: number, currency: string) {
  return `${currency}${Math.round(n).toLocaleString()}`;
}

export default function SummaryPage() {
  const { state, computed } = useBudget();
  const { summaries, sixMonthSavings, effectiveSavingsRate } = computed;
  const currency = state.currency;
  const targetRate = state.savingsGoal.targetRate;
  const meetsGoal = effectiveSavingsRate >= targetRate;

  const avgFixed = summaries.length
    ? summaries.reduce((s, m) => s + m.fixedSpending, 0) / summaries.length
    : 0;
  const avgVariable = summaries.length
    ? summaries.reduce((s, m) => s + m.variableSpending, 0) / summaries.length
    : 0;
  const avgSavings = summaries.length ? sixMonthSavings / summaries.length : 0;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Summary</h1>
        <p className="text-sm text-zinc-500 mt-0.5">6-month projection from {state.income.firstPaycheckDate}</p>
      </div>

      {/* Big stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="6-month savings"
          value={fmt(sixMonthSavings, currency)}
          sub={`${fmt(avgSavings, currency)}/month average`}
          accent="green"
        />
        <StatCard
          label="Effective savings rate"
          value={`${Math.round(effectiveSavingsRate * 100)}%`}
          sub={`Target: ${Math.round(targetRate * 100)}%`}
          accent={meetsGoal ? 'green' : 'red'}
        />
        <StatCard
          label="Goal"
          value={meetsGoal ? '✓ On track' : '✗ Below target'}
          sub={meetsGoal
            ? `${Math.round((effectiveSavingsRate - targetRate) * 100)}pp above target`
            : `${Math.round((targetRate - effectiveSavingsRate) * 100)}pp below target`}
          accent={meetsGoal ? 'green' : 'red'}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-zinc-700 rounded-xl border border-zinc-600 p-5">
          <h2 className="text-sm font-semibold text-zinc-300 mb-4">Monthly spending breakdown</h2>
          <SpendingPieChart
            fixed={avgFixed}
            variable={avgVariable}
            savings={avgSavings}
            currency={currency}
          />
          <p className="text-xs text-zinc-500 text-center mt-2">Monthly averages across the 6-month window</p>
        </div>

        <div className="bg-zinc-700 rounded-xl border border-zinc-600 p-5">
          <h2 className="text-sm font-semibold text-zinc-300 mb-1">Monthly savings</h2>
          <p className="text-xs text-zinc-500 mb-4">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-1" />
            Green bars = 3-paycheck month (extra savings)
          </p>
          <SavingsBarChart summaries={summaries} currency={currency} />
        </div>
      </div>

      {/* Bucket allocation */}
      {state.savingsGoal.buckets.length > 0 && (
        <div className="bg-zinc-700 rounded-xl border border-zinc-600 p-5">
          <h2 className="text-sm font-semibold text-zinc-300 mb-4">Savings bucket allocation</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {state.savingsGoal.buckets.map((b) => (
              <div key={b.id} className="flex flex-col gap-0.5 bg-zinc-800 rounded-lg px-4 py-3">
                <span className="text-xs text-zinc-400">{b.name}</span>
                <span className="text-lg font-semibold text-zinc-100">
                  {fmt(sixMonthSavings * b.percentageOfSavings, currency)}
                </span>
                <span className="text-xs text-zinc-500">{Math.round(b.percentageOfSavings * 100)}% of savings</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
