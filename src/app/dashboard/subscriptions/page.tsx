'use client';

import { useState } from 'react';
import { useBudget } from '@/lib/context/BudgetContext';

function fmt(n: number, currency: string) {
  return `${currency}${Math.round(n).toLocaleString()}`;
}

export default function SubscriptionsPage() {
  const { state, reload } = useBudget();
  const currency = state.currency;
  const [sortBy, setSortBy] = useState<'amount' | 'name'>('amount');
  const [toggling, setToggling] = useState<Set<string>>(new Set());

  const sorted = [...state.subscriptions].sort((a, b) =>
    sortBy === 'amount' ? b.monthlyAmount - a.monthlyAmount : a.name.localeCompare(b.name),
  );

  const totalMonthly = state.subscriptions.reduce((s, sub) => s + sub.monthlyAmount, 0);
  const cancelledMonthly = state.subscriptions
    .filter((s) => s.markedForCancel)
    .reduce((s, sub) => s + sub.monthlyAmount, 0);
  const afterCancelMonthly = totalMonthly - cancelledMonthly;
  const hasCancellations = cancelledMonthly > 0;

  async function toggleCancel(id: string, current: boolean) {
    setToggling((prev) => new Set(prev).add(id));
    await fetch(`/api/subscriptions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markedForCancel: !current }),
    });
    await reload();
    setToggling((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Subscriptions</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          {state.subscriptions.length} subscription{state.subscriptions.length !== 1 ? 's' : ''} tracked
        </p>
      </div>

      {/* Stats */}
      <div className={`grid gap-4 ${hasCancellations ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} grid-cols-1`}>
        <div className="bg-zinc-700 rounded-xl border border-zinc-600 p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Total monthly</p>
          <p className="text-2xl font-bold text-zinc-100">{fmt(totalMonthly, currency)}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{fmt(totalMonthly * 12, currency)}/year</p>
        </div>

        {hasCancellations && (
          <div className="bg-zinc-700 rounded-xl border border-zinc-600 p-5">
            <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Savings if cancelled</p>
            <p className="text-2xl font-bold text-emerald-400">−{fmt(cancelledMonthly, currency)}/mo</p>
            <p className="text-xs text-zinc-500 mt-0.5">−{fmt(cancelledMonthly * 12, currency)}/year</p>
          </div>
        )}

        <div className="bg-zinc-700 rounded-xl border border-zinc-600 p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">
            {hasCancellations ? 'After cancellations' : 'Annual total'}
          </p>
          <p className="text-2xl font-bold text-zinc-100">
            {hasCancellations ? fmt(afterCancelMonthly, currency) : fmt(totalMonthly * 12, currency)}
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {hasCancellations ? `${fmt(afterCancelMonthly * 12, currency)}/year` : '/year'}
          </p>
        </div>
      </div>

      {/* Table */}
      {state.subscriptions.length === 0 ? (
        <div className="bg-zinc-700 rounded-xl border border-zinc-600 p-8 text-center">
          <p className="text-zinc-400 text-sm">No subscriptions added yet.</p>
          <p className="text-zinc-500 text-xs mt-1">Add them via the setup wizard in Settings.</p>
        </div>
      ) : (
        <div className="bg-zinc-700 rounded-xl border border-zinc-600 overflow-hidden">
          <div className="grid grid-cols-[1fr_100px_110px_100px] gap-3 px-4 py-2 border-b border-zinc-600 text-xs font-medium text-zinc-500 uppercase tracking-wide">
            <button
              className={`text-left transition-colors hover:text-zinc-300 ${sortBy === 'name' ? 'text-zinc-300' : ''}`}
              onClick={() => setSortBy('name')}
            >
              Name {sortBy === 'name' && '↑'}
            </button>
            <button
              className={`text-right transition-colors hover:text-zinc-300 ${sortBy === 'amount' ? 'text-zinc-300' : ''}`}
              onClick={() => setSortBy('amount')}
            >
              Monthly {sortBy === 'amount' && '↓'}
            </button>
            <span className="text-right">Annual</span>
            <span className="text-right">Action</span>
          </div>

          {sorted.map((sub) => {
            const isCandidate = !sub.usedRecently && !sub.markedForCancel;
            const isCancelled = sub.markedForCancel;
            return (
              <div
                key={sub.id}
                className={`grid grid-cols-[1fr_100px_110px_100px] gap-3 px-4 py-3 border-b border-zinc-600/50 last:border-0 transition-opacity ${
                  isCandidate ? 'bg-amber-900/10' : ''
                } ${isCancelled ? 'opacity-50' : ''}`}
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className={`text-sm truncate ${isCancelled ? 'line-through text-zinc-500' : 'text-zinc-100'}`}>
                    {sub.name}
                  </span>
                  {isCandidate && <span className="text-xs text-amber-500">Not used recently</span>}
                  {isCancelled && <span className="text-xs text-zinc-600">Marked for cancel</span>}
                </div>
                <span className="text-sm text-zinc-300 text-right tabular-nums self-center">
                  {fmt(sub.monthlyAmount, currency)}
                </span>
                <span className="text-sm text-zinc-500 text-right tabular-nums self-center">
                  {fmt(sub.monthlyAmount * 12, currency)}
                </span>
                <div className="flex justify-end items-center">
                  <button
                    disabled={toggling.has(sub.id)}
                    onClick={() => toggleCancel(sub.id, sub.markedForCancel)}
                    className={`text-xs px-3 py-1 rounded border transition-colors disabled:opacity-40 ${
                      isCancelled
                        ? 'border-zinc-600 text-zinc-400 hover:border-zinc-400 hover:text-zinc-200'
                        : 'border-red-800/60 text-red-400 hover:bg-red-900/20'
                    }`}
                  >
                    {toggling.has(sub.id) ? '…' : isCancelled ? 'Undo' : 'Cancel'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
