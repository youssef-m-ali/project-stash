'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { useBudget } from '@/lib/context/BudgetContext';
import type { PaycheckAllocation } from '@/lib/types';

function fmt(n: number, currency: string) {
  return `${currency}${Math.round(n).toLocaleString()}`;
}

function formatDate(iso: string) {
  return format(parseISO(iso), 'MMM d, yyyy');
}

function monthLabel(key: string) {
  return format(parseISO(key + '-01'), 'MMMM yyyy');
}

export default function PerPaycheckPage() {
  const { state, computed } = useBudget();
  const { allocations } = computed;
  const currency = state.currency;
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  function toggle(idx: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }

  // Group by monthKey
  const byMonth = new Map<string, PaycheckAllocation[]>();
  for (const a of allocations) {
    const arr = byMonth.get(a.paycheck.monthKey) ?? [];
    arr.push(a);
    byMonth.set(a.paycheck.monthKey, arr);
  }
  const months = Array.from(byMonth.keys()).sort();

  const variablePerPaycheck = state.variableExpenses.reduce((s, e) => s + e.monthlyBudget, 0) / 2;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Per Paycheck</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Every paycheck in the 6-month window and what it covers.
        </p>
      </div>

      {/* Variable allowance summary */}
      <div className="bg-zinc-700 rounded-xl border border-zinc-600 p-5">
        <h2 className="text-sm font-semibold text-zinc-300 mb-3">Variable allowance breakdown</h2>
        <p className="text-sm text-zinc-400 mb-3">
          <span className="font-semibold text-zinc-200">{fmt(variablePerPaycheck, currency)}</span> every 2 weeks
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {state.variableExpenses.map((e) => (
            <div key={e.id} className="bg-zinc-800 rounded-lg px-3 py-2">
              <div className="text-xs text-zinc-400 truncate">{e.name}{e.isCap ? ' (cap)' : ''}</div>
              <div className="text-sm font-medium text-zinc-200">{fmt(e.monthlyBudget / 2, currency)}/paycheck</div>
            </div>
          ))}
        </div>
      </div>

      {/* Month groups */}
      {months.map((monthKey) => {
        const group = byMonth.get(monthKey)!;
        const isThreePaycheck = group.length === 3;

        return (
          <div key={monthKey} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-zinc-300">{monthLabel(monthKey)}</h2>
              {isThreePaycheck && (
                <span className="text-xs font-medium bg-emerald-900/40 text-emerald-400 border border-emerald-700/50 rounded px-2 py-0.5">
                  3-paycheck month
                </span>
              )}
            </div>

            <div className="bg-zinc-700 rounded-xl border border-zinc-600 overflow-hidden">
              {/* Header */}
              <div className="hidden md:grid grid-cols-[130px_1fr_110px_110px_110px] gap-3 px-4 py-2 border-b border-zinc-600 text-xs font-medium text-zinc-500 uppercase tracking-wide">
                <span>Date</span>
                <span>Job</span>
                <span className="text-right">Bills</span>
                <span className="text-right">Variable</span>
                <span className="text-right">Savings</span>
              </div>

              {group.map((alloc) => {
                const isThird = isThreePaycheck && alloc.paycheck.index === group[2].paycheck.index;
                const isOpen = expanded.has(alloc.paycheck.index);

                return (
                  <div
                    key={alloc.paycheck.index}
                    className={`border-b border-zinc-600 last:border-b-0 ${isThird ? 'bg-emerald-900/10' : ''}`}
                  >
                    {/* Main row */}
                    <div
                      className="md:grid md:grid-cols-[130px_1fr_110px_110px_110px] gap-3 px-4 py-3 flex flex-col gap-1 cursor-pointer hover:bg-zinc-600/30 transition-colors"
                      onClick={() => alloc.billsPaid.length > 0 && toggle(alloc.paycheck.index)}
                    >
                      {/* Date */}
                      <span className="text-sm text-zinc-300 tabular-nums">
                        {formatDate(alloc.paycheck.date)}
                      </span>

                      {/* Job + notes */}
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className={`text-sm font-medium truncate ${isThird ? 'text-emerald-400' : 'text-zinc-100'}`}>
                          {alloc.job}
                        </span>
                        {alloc.notes && (
                          <span className="text-xs text-zinc-500 truncate">{alloc.notes}</span>
                        )}
                        {alloc.billsPaid.length > 0 && (
                          <button
                            className="text-xs text-zinc-500 hover:text-zinc-300 text-left transition-colors"
                            onClick={(e) => { e.stopPropagation(); toggle(alloc.paycheck.index); }}
                          >
                            {isOpen ? '▲' : '▼'} {alloc.billsPaid.length} bill{alloc.billsPaid.length !== 1 ? 's' : ''}
                          </button>
                        )}
                      </div>

                      {/* Bills */}
                      <span className="text-sm text-zinc-300 md:text-right tabular-nums">
                        {alloc.totalBills > 0 ? fmt(alloc.totalBills, currency) : '—'}
                      </span>

                      {/* Variable */}
                      <span className="text-sm text-zinc-300 md:text-right tabular-nums">
                        {fmt(alloc.variableAllowance, currency)}
                      </span>

                      {/* Savings */}
                      <span className={`text-sm font-medium md:text-right tabular-nums ${alloc.savings >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {fmt(alloc.savings, currency)}
                      </span>
                    </div>

                    {/* Expanded bills */}
                    {isOpen && alloc.billsPaid.length > 0 && (
                      <div className="border-t border-zinc-600/50 bg-zinc-800/40">
                        {alloc.billsPaid.map((bill, i) => (
                          <div
                            key={i}
                            className="md:grid md:grid-cols-[130px_1fr_110px_110px_110px] gap-3 px-4 py-1.5 last:pb-3 flex items-center justify-between"
                          >
                            <span className="hidden md:block" />
                            <div className="flex flex-col gap-0">
                              <span className="text-sm text-zinc-400">{bill.name}</span>
                              <span className="text-xs text-zinc-600">Due {format(parseISO(bill.dueDate), 'MMM d')}</span>
                            </div>
                            <span className="text-sm text-zinc-300 md:text-right tabular-nums">{fmt(bill.amount, currency)}</span>
                            <span className="hidden md:block" />
                            <span className="hidden md:block" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
