'use client';

import { useState } from 'react';
import type { ParsedTransaction, Account, BudgetState } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';

interface Props {
  transactions: (ParsedTransaction & { id: string })[];
  state: BudgetState;
  onConfirm: (txs: (ParsedTransaction & { id: string })[]) => void;
  loading: boolean;
}

function fmt(n: number, currency: string) {
  return `${currency}${Math.abs(n).toFixed(2)}`;
}

function accountLabel(id: string, accounts: Account[]) {
  return accounts.find((a) => a.id === id)?.label ?? id;
}

function categoryLabel(id: string | null, state: BudgetState) {
  if (!id) return null;
  const all = [
    ...state.fixedExpenses.map((e) => ({ id: e.id, name: e.name })),
    ...state.variableExpenses.map((e) => ({ id: e.id, name: e.name })),
    ...state.subscriptions.map((s) => ({ id: s.id, name: s.name })),
  ];
  return all.find((c) => c.id === id)?.name ?? id;
}

export function PreviewTable({ transactions, state, onConfirm, loading }: Props) {
  const [overrides, setOverrides] = useState<Record<string, string | null>>({});
  const [showIgnored, setShowIgnored] = useState(false);

  const allCategories = [
    ...state.fixedExpenses.map((e) => ({ id: e.id, name: e.name, group: 'Fixed' })),
    ...state.variableExpenses.map((e) => ({ id: e.id, name: e.name, group: 'Variable' })),
    ...state.subscriptions.map((s) => ({ id: s.id, name: s.name, group: 'Subscriptions' })),
  ];

  function setOverride(tempId: string, categoryId: string | null) {
    setOverrides((prev) => ({ ...prev, [tempId]: categoryId }));
  }

  const active = transactions.filter((t) => t.status === 'active');
  const ignored = transactions.filter((t) => t.status === 'ignored');
  const duplicates = transactions.filter((t) => t.duplicate).length;
  const uncategorized = active.filter((t) => !overrides[t.tempId] && !t.categoryId).length;

  function handleConfirm() {
    const merged = transactions.map((tx) => ({
      ...tx,
      userOverrideCategory: overrides[tx.tempId] !== undefined ? overrides[tx.tempId] : tx.userOverrideCategory,
    }));
    onConfirm(merged);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Summary bar */}
      <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
        <span><span className="text-zinc-100 font-medium">{active.length}</span> active</span>
        <span><span className="text-zinc-100 font-medium">{ignored.length}</span> ignored</span>
        {duplicates > 0 && <span><span className="text-amber-400 font-medium">{duplicates}</span> already imported</span>}
        {uncategorized > 0 && <span><span className="text-amber-400 font-medium">{uncategorized}</span> uncategorized</span>}
      </div>

      {/* Active transactions */}
      {active.length > 0 && (
        <div className="bg-zinc-700 rounded-xl border border-zinc-600 overflow-hidden">
          <div className="hidden md:grid grid-cols-[100px_120px_1fr_80px_180px] gap-3 px-4 py-2 border-b border-zinc-600 text-xs font-medium text-zinc-500 uppercase tracking-wide">
            <span>Date</span>
            <span>Account</span>
            <span>Description</span>
            <span className="text-right">Amount</span>
            <span>Category</span>
          </div>
          {active.map((tx) => (
            <div
              key={tx.tempId}
              className={`md:grid md:grid-cols-[100px_120px_1fr_80px_180px] gap-3 px-4 py-2.5 border-b border-zinc-600/50 last:border-0 flex flex-col gap-1 ${tx.duplicate ? 'opacity-50' : ''}`}
            >
              <span className="text-xs text-zinc-400 tabular-nums">{tx.date}</span>
              <span className="text-xs text-zinc-400 truncate">{accountLabel(tx.accountId, state.accounts)}</span>
              <span className="text-sm text-zinc-200 truncate">{tx.description}</span>
              <span className="text-sm text-zinc-100 md:text-right tabular-nums">{fmt(tx.amount, state.currency)}</span>
              <Select
                value={overrides[tx.tempId] !== undefined ? (overrides[tx.tempId] ?? '') : (tx.categoryId ?? '')}
                onChange={(e) => setOverride(tx.tempId, e.target.value || null)}
                className="text-xs py-1"
              >
                <option value="">— uncategorized —</option>
                {allCategories.map((c) => (
                  <option key={c.id} value={c.id}>[{c.group}] {c.name}</option>
                ))}
              </Select>
              {tx.duplicate && <span className="text-xs text-amber-400 md:col-span-5">already imported</span>}
            </div>
          ))}
        </div>
      )}

      {/* Ignored toggle */}
      {ignored.length > 0 && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowIgnored((v) => !v)}
            className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors self-start"
          >
            {showIgnored ? '▲' : '▼'} {ignored.length} ignored row{ignored.length !== 1 ? 's' : ''}
          </button>

          {showIgnored && (
            <div className="bg-zinc-800/60 rounded-xl border border-zinc-700 overflow-hidden">
              {ignored.map((tx) => (
                <div key={tx.tempId} className="flex items-center gap-3 px-4 py-2 border-b border-zinc-700/50 last:border-0 opacity-50">
                  <span className="text-xs text-zinc-500 tabular-nums w-20 shrink-0">{tx.date}</span>
                  <span className="text-xs text-zinc-500 flex-1 truncate">{tx.description}</span>
                  <span className="text-xs text-zinc-500 tabular-nums">{fmt(tx.rawAmount, state.currency)}</span>
                  <span className="text-xs bg-zinc-700 text-zinc-400 px-2 py-0.5 rounded shrink-0">{tx.ignoreReason}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-4 pt-2">
        <Button onClick={handleConfirm} disabled={loading}>
          {loading ? 'Importing…' : `Confirm import (${active.filter((t) => !t.duplicate).length} new)`}
        </Button>
        {uncategorized > 0 && (
          <p className="text-xs text-zinc-500">{uncategorized} transactions will be saved as uncategorized — you can assign them later.</p>
        )}
      </div>
    </div>
  );
}
