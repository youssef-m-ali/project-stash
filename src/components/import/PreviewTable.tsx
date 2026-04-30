'use client';

import { useState } from 'react';
import type { ParsedTransaction, Account, Bucket } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';

interface Props {
  transactions: (ParsedTransaction & { id: string })[];
  accounts: Account[];
  buckets: Bucket[];
  currency: string;
  onConfirm: (txs: (ParsedTransaction & { id: string })[]) => void;
  loading: boolean;
}

function fmt(n: number, currency: string) {
  return `${currency}${Math.abs(n).toFixed(2)}`;
}

function accountLabel(id: string, accounts: Account[]) {
  return accounts.find((a) => a.id === id)?.label ?? id;
}

export function PreviewTable({ transactions, accounts, buckets, currency, onConfirm, loading }: Props) {
  const [overrides, setOverrides] = useState<Record<string, string | null>>({});
  const [showIgnored, setShowIgnored] = useState(false);

  function setOverride(tempId: string, bucketId: string | null) {
    setOverrides(prev => ({ ...prev, [tempId]: bucketId }));
  }

  const pending  = transactions.filter(t => t.status === 'pending');
  const ignored  = transactions.filter(t => t.status === 'ignored');
  const duplicates = transactions.filter(t => t.duplicate).length;
  const newTxs = pending.filter(t => !t.duplicate);

  function handleConfirm() {
    const merged = transactions.map(tx => ({
      ...tx,
      bucketId:
        overrides[tx.tempId] !== undefined
          ? overrides[tx.tempId]
          : (tx.suggestedBucketId ?? tx.bucketId),
    }));
    onConfirm(merged);
  }

  function resolvedBucketId(tx: ParsedTransaction) {
    if (overrides[tx.tempId] !== undefined) return overrides[tx.tempId] ?? '';
    return tx.suggestedBucketId ?? '';
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Summary bar */}
      <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
        <span><span className="text-zinc-100 font-medium">{newTxs.length}</span> new</span>
        <span><span className="text-zinc-100 font-medium">{ignored.length}</span> ignored</span>
        {duplicates > 0 && (
          <span><span className="text-amber-400 font-medium">{duplicates}</span> already imported</span>
        )}
      </div>

      {/* Pending transactions */}
      {pending.length > 0 && (
        <div className="bg-zinc-700 rounded-xl border border-zinc-600 overflow-hidden">
          <div className="hidden md:grid grid-cols-[100px_120px_1fr_80px_180px] gap-3 px-4 py-2 border-b border-zinc-600 text-xs font-medium text-zinc-500 uppercase tracking-wide">
            <span>Date</span>
            <span>Account</span>
            <span>Description</span>
            <span className="text-right">Amount</span>
            <span>Bucket</span>
          </div>
          {pending.map(tx => (
            <div
              key={tx.tempId}
              className={`md:grid md:grid-cols-[100px_120px_1fr_80px_180px] gap-3 px-4 py-2.5 border-b border-zinc-600/50 last:border-0 flex flex-col gap-1 ${tx.duplicate ? 'opacity-50' : ''}`}
            >
              <span className="text-xs text-zinc-400 tabular-nums">{tx.date}</span>
              <span className="text-xs text-zinc-400 truncate">{accountLabel(tx.accountId, accounts)}</span>
              <span className="text-sm text-zinc-200 truncate">{tx.description}</span>
              <span className="text-sm text-zinc-100 md:text-right tabular-nums">{fmt(tx.amount, currency)}</span>
              <Select
                value={resolvedBucketId(tx)}
                onChange={e => setOverride(tx.tempId, e.target.value || null)}
                className={`text-xs py-1 ${tx.suggestedBucketId && !overrides[tx.tempId] ? 'border-amber-400/50' : ''}`}
              >
                <option value="">— unassigned —</option>
                {buckets.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </Select>
              {tx.duplicate && (
                <span className="text-xs text-amber-400 md:col-span-5">already imported</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Ignored rows toggle */}
      {ignored.length > 0 && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowIgnored(v => !v)}
            className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors self-start"
          >
            {showIgnored ? '▲' : '▼'} {ignored.length} ignored row{ignored.length !== 1 ? 's' : ''}
          </button>

          {showIgnored && (
            <div className="bg-zinc-800/60 rounded-xl border border-zinc-700 overflow-hidden">
              {ignored.map(tx => (
                <div
                  key={tx.tempId}
                  className="flex items-center gap-3 px-4 py-2 border-b border-zinc-700/50 last:border-0 opacity-50"
                >
                  <span className="text-xs text-zinc-500 tabular-nums w-20 shrink-0">{tx.date}</span>
                  <span className="text-xs text-zinc-500 flex-1 truncate">{tx.description}</span>
                  <span className="text-xs text-zinc-500 tabular-nums">{fmt(tx.rawAmount, currency)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-4 pt-2">
        <Button onClick={handleConfirm} disabled={loading}>
          {loading ? 'Importing…' : `Confirm import (${newTxs.length} new)`}
        </Button>
        <p className="text-xs text-zinc-500">
          Unassigned transactions will appear in the Review queue.
        </p>
      </div>
    </div>
  );
}
