'use client';

import type { BudgetState } from '@/lib/types';
import { Button } from '@/components/ui/Button';

interface Props {
  draft: Partial<BudgetState>;
  onFinish: (slice: Partial<BudgetState>) => void;
  onBack: () => void;
}

function fmt(n: number, currency = '$') {
  return `${currency}${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function StepReview({ draft, onFinish, onBack }: Props) {
  const currency = draft.currency ?? '$';
  const income = draft.income;
  const fixedTotal = (draft.fixedExpenses ?? []).reduce((s, e) => s + e.amount, 0);
  const subTotal = (draft.subscriptions ?? [])
    .filter((s) => !s.markedForCancel)
    .reduce((s, sub) => s + sub.monthlyAmount, 0);
  const variableTotal = (draft.variableExpenses ?? []).reduce((s, e) => s + e.monthlyBudget, 0);
  const monthlyIncome = income ? income.netPerPaycheck * 26 / 12 : 0;
  const totalSpending = fixedTotal + subTotal + variableTotal;
  const monthlySavings = monthlyIncome - totalSpending;
  const savingsRate = monthlyIncome > 0 ? monthlySavings / monthlyIncome : 0;
  const targetRate = draft.savingsGoal?.targetRate ?? 0.3;
  const meetsGoal = savingsRate >= targetRate;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Review</h2>
        <p className="mt-1 text-sm text-zinc-500">Double-check everything before we build your plan.</p>
      </div>

      {/* Income */}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">Income</h3>
        <div className="rounded-lg border border-zinc-100 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
          <Row label="Net per paycheck" value={income ? fmt(income.netPerPaycheck, currency) : '—'} />
          <Row label="Frequency" value="Biweekly" />
          <Row label="First paycheck date" value={income?.firstPaycheckDate ?? '—'} />
        </div>
      </section>

      {/* Fixed expenses */}
      {(draft.fixedExpenses ?? []).length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
            Fixed expenses <span className="font-normal text-zinc-400">({fmt(fixedTotal, currency)}/mo)</span>
          </h3>
          <div className="rounded-lg border border-zinc-100 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
            {draft.fixedExpenses!.map((e) => (
              <Row key={e.id} label={`${e.name} (due day ${e.dueDayOfMonth})`} value={fmt(e.amount, currency)} />
            ))}
          </div>
        </section>
      )}

      {/* Variable expenses */}
      {(draft.variableExpenses ?? []).length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
            Variable expenses <span className="font-normal text-zinc-400">({fmt(variableTotal, currency)}/mo)</span>
          </h3>
          <div className="rounded-lg border border-zinc-100 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
            {draft.variableExpenses!.map((e) => (
              <Row key={e.id} label={`${e.name}${e.isCap ? ' (cap)' : ''}`} value={fmt(e.monthlyBudget, currency)} />
            ))}
          </div>
        </section>
      )}

      {/* Subscriptions */}
      {(draft.subscriptions ?? []).length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
            Subscriptions <span className="font-normal text-zinc-400">({fmt(subTotal, currency)}/mo active)</span>
          </h3>
          <div className="rounded-lg border border-zinc-100 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
            {draft.subscriptions!.map((s) => (
              <Row
                key={s.id}
                label={`${s.name}${s.markedForCancel ? ' ✕ cancel' : ''}`}
                value={fmt(s.monthlyAmount, currency)}
                muted={s.markedForCancel}
              />
            ))}
          </div>
        </section>
      )}

      {/* Savings goal */}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">Savings goal</h3>
        <div className="rounded-lg border border-zinc-100 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
          <Row label="Target rate" value={`${Math.round(targetRate * 100)}%`} />
          {(draft.savingsGoal?.buckets ?? []).map((b) => (
            <Row key={b.id} label={b.name} value={`${Math.round(b.percentageOfSavings * 100)}%`} />
          ))}
        </div>
      </section>

      {/* Projection */}
      <div className={`rounded-lg p-4 border ${meetsGoal ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950' : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950'}`}>
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Your projected monthly savings will be{' '}
          <span className="font-bold">{fmt(Math.max(0, monthlySavings), currency)}</span>{' '}
          ({Math.round(Math.max(0, savingsRate) * 100)}% of income).{' '}
          {meetsGoal
            ? `That meets your ${Math.round(targetRate * 100)}% target.`
            : `That's below your ${Math.round(targetRate * 100)}% target — consider reducing expenses or adjusting your goal.`}
        </p>
      </div>

      <div className="flex justify-between pt-2">
        <Button type="button" variant="secondary" onClick={onBack}>Back</Button>
        <Button type="button" onClick={() => onFinish({})}>
          Looks good — go to dashboard
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-3 py-2 text-sm ${muted ? 'opacity-40 line-through' : ''}`}>
      <span className="text-zinc-600 dark:text-zinc-400">{label}</span>
      <span className="font-medium text-zinc-900 dark:text-zinc-100">{value}</span>
    </div>
  );
}
