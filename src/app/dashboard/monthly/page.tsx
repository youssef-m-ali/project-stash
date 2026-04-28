'use client';

import Link from 'next/link';
import { useBudget } from '@/lib/context/BudgetContext';
import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import type { Actuals } from '@/lib/storage/adapter';

function monthLabel(key: string) {
  return format(parseISO(key + '-01'), 'MMMM yyyy');
}

function fmt(n: number, currency: string) {
  return `${currency}${Math.round(Math.abs(n)).toLocaleString()}`;
}

export default function MonthlyPage() {
  const { state, computed } = useBudget();
  const { summaries } = computed;
  const currency = state.currency;
  const [actuals, setActuals] = useState<Actuals>({});

  useEffect(() => {
    fetch('/api/actuals')
      .then((r) => r.json())
      .then((d) => setActuals(d as Actuals))
      .catch(() => {});
  }, []);

  const allCategories = [
    ...state.fixedExpenses.map((e) => ({ id: e.id, name: e.name, budgeted: e.amount })),
    ...state.variableExpenses.map((e) => ({ id: e.id, name: e.name, budgeted: e.monthlyBudget })),
    ...state.subscriptions.filter((s) => !s.markedForCancel).map((s) => ({ id: s.id, name: s.name, budgeted: s.monthlyAmount })),
  ];

  const hasActuals = Object.keys(actuals).length > 0;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Monthly Budget</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Budgeted vs. actual spending by category.</p>
        </div>
        {!hasActuals && (
          <Link
            href="/dashboard/import"
            className="text-sm text-zinc-300 border border-zinc-600 rounded-lg px-3 py-1.5 hover:bg-zinc-700 transition-colors shrink-0"
          >
            Import transactions →
          </Link>
        )}
      </div>

      {!hasActuals && (
        <div className="bg-zinc-700 rounded-xl border border-zinc-600 p-6 text-center">
          <p className="text-zinc-400 text-sm">No transaction data yet.</p>
          <p className="text-zinc-500 text-xs mt-1">Upload your bank CSVs in the Import tab to see actuals here.</p>
        </div>
      )}

      {summaries.map((summary) => {
        const monthActuals = actuals[summary.monthKey] ?? {};
        const uncategorized = monthActuals['__uncategorized__'] ?? 0;

        return (
          <div key={summary.monthKey} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-zinc-300">{monthLabel(summary.monthKey)}</h2>
              {summary.paycheckCount === 3 && (
                <span className="text-xs bg-emerald-900/40 text-emerald-400 border border-emerald-700/50 rounded px-2 py-0.5">3-paycheck month</span>
              )}
            </div>

            <div className="bg-zinc-700 rounded-xl border border-zinc-600 overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[1fr_100px_100px_80px] gap-3 px-4 py-2 border-b border-zinc-600 text-xs font-medium text-zinc-500 uppercase tracking-wide">
                <span>Category</span>
                <span className="text-right">Budgeted</span>
                <span className="text-right">Actual</span>
                <span className="text-right">Variance</span>
              </div>

              {allCategories.map((cat) => {
                const actual = monthActuals[cat.id] ?? null;
                const variance = actual !== null ? cat.budgeted - actual : null;
                return (
                  <div key={cat.id} className="grid grid-cols-[1fr_100px_100px_80px] gap-3 px-4 py-2.5 border-b border-zinc-600/50 last:border-0">
                    <span className="text-sm text-zinc-300 truncate">{cat.name}</span>
                    <span className="text-sm text-zinc-400 text-right tabular-nums">{fmt(cat.budgeted, currency)}</span>
                    <span className="text-sm text-right tabular-nums text-zinc-100">
                      {actual !== null ? fmt(actual, currency) : <span className="text-zinc-600">—</span>}
                    </span>
                    <span className={`text-sm text-right tabular-nums ${variance === null ? 'text-zinc-600' : variance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {variance !== null ? `${variance >= 0 ? '+' : ''}${fmt(variance, currency)}` : '—'}
                    </span>
                  </div>
                );
              })}

              {uncategorized > 0 && (
                <div className="grid grid-cols-[1fr_100px_100px_80px] gap-3 px-4 py-2.5 border-t border-zinc-600 bg-amber-900/10">
                  <span className="text-sm text-amber-400 truncate">Uncategorized</span>
                  <span className="text-sm text-zinc-600 text-right">—</span>
                  <span className="text-sm text-amber-400 text-right tabular-nums">{fmt(uncategorized, currency)}</span>
                  <span className="text-sm text-zinc-600 text-right">—</span>
                </div>
              )}

              {/* Footer */}
              <div className="grid grid-cols-[1fr_100px_100px_80px] gap-3 px-4 py-2.5 border-t border-zinc-600 bg-zinc-800/40">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Total</span>
                <span className="text-sm font-semibold text-zinc-300 text-right tabular-nums">{fmt(summary.totalSpending, currency)}</span>
                <span className="text-sm font-semibold text-zinc-100 text-right tabular-nums">
                  {Object.keys(monthActuals).length > 0
                    ? fmt(Object.entries(monthActuals).filter(([k]) => k !== '__uncategorized__').reduce((s, [, v]) => s + v, 0), currency)
                    : <span className="text-zinc-600">—</span>}
                </span>
                <span className={`text-xs font-medium text-right ${summary.hitsGoal ? 'text-emerald-400' : 'text-zinc-500'}`}>
                  {summary.hitsGoal ? '✓ goal' : `${Math.round(summary.savingsRate * 100)}%`}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
