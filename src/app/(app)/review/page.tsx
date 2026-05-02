'use client';

import { useEffect, useState, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import type { ReviewTransaction, Bucket } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';

function ReviewRow({
  tx,
  buckets,
  onApprove,
  onIgnore,
}: {
  tx: ReviewTransaction;
  buckets: Bucket[];
  onApprove: (id: string, bucketId: string) => Promise<void>;
  onIgnore: (id: string) => Promise<void>;
}) {
  const [selectedBucketId, setSelectedBucketId] = useState(tx.suggestedBucketId ?? '');
  const [busy, setBusy] = useState(false);
  const isSuggested = !!tx.suggestedBucketId && selectedBucketId === tx.suggestedBucketId;

  async function handleApprove() {
    if (!selectedBucketId) return;
    setBusy(true);
    await onApprove(tx.id, selectedBucketId);
  }

  async function handleIgnore() {
    setBusy(true);
    await onIgnore(tx.id);
  }

  return (
    <div className="flex flex-col sm:grid sm:grid-cols-[90px_1fr_90px_180px_140px] gap-2 sm:gap-3 items-start sm:items-center py-3 border-b border-zinc-700/60 last:border-0">
      <span className="text-xs text-zinc-500 tabular-nums">
        {format(parseISO(tx.date), 'MMM d')}
      </span>

      <span className="text-sm text-zinc-200 truncate max-w-full" title={tx.description}>
        {tx.description}
      </span>

      <span className={`text-sm font-medium tabular-nums ${tx.amount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
        {tx.amount > 0 ? '-' : '+'}${Math.abs(tx.amount).toFixed(2)}
      </span>

      <div className={`rounded-md ${isSuggested ? 'ring-1 ring-amber-400/50' : ''}`}>
        <Select
          value={selectedBucketId}
          onChange={e => setSelectedBucketId(e.target.value)}
          disabled={busy}
        >
          <option value="">— select bucket —</option>
          {buckets.map(b => (
            <option key={b.id} value={b.id}>{b.emoji ? `${b.emoji} ${b.name}` : b.name}</option>
          ))}
        </Select>
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!selectedBucketId || busy}
          onClick={handleApprove}
        >
          Approve
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={handleIgnore}
        >
          Ignore
        </Button>
      </div>
    </div>
  );
}

export default function ReviewPage() {
  const [transactions, setTransactions] = useState<ReviewTransaction[]>([]);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [txRes, bucketRes] = await Promise.all([
      fetch('/api/review').then(r => r.json()),
      fetch('/api/buckets').then(r => r.json()),
    ]);
    setTransactions(txRes.transactions ?? []);
    setBuckets(bucketRes.buckets ?? []);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function handleApprove(id: string, bucketId: string) {
    await fetch(`/api/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved', bucketId }),
    });
    setTransactions(prev => prev.filter(t => t.id !== id));
  }

  async function handleIgnore(id: string) {
    await fetch(`/api/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ignored' }),
    });
    setTransactions(prev => prev.filter(t => t.id !== id));
  }

  async function handleApproveAllSuggested() {
    const suggested = transactions.filter(t => t.suggestedBucketId);
    await Promise.all(
      suggested.map(t =>
        fetch(`/api/transactions/${t.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'approved', bucketId: t.suggestedBucketId }),
        }),
      ),
    );
    const approvedIds = new Set(suggested.map(t => t.id));
    setTransactions(prev => prev.filter(t => !approvedIds.has(t.id)));
  }

  if (loading) {
    return <div className="text-zinc-500 text-sm">Loading…</div>;
  }

  const suggestedCount = transactions.filter(t => t.suggestedBucketId).length;

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Review</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {transactions.length === 0
              ? 'All caught up — nothing to review.'
              : `${transactions.length} transaction${transactions.length === 1 ? '' : 's'} need approval`}
          </p>
        </div>

        {suggestedCount > 0 && (
          <Button type="button" variant="secondary" onClick={handleApproveAllSuggested}>
            Approve all suggested ({suggestedCount})
          </Button>
        )}
      </div>

      {transactions.length === 0 ? (
        <div className="rounded-xl border border-zinc-700 bg-zinc-800/40 p-12 text-center">
          <p className="text-2xl mb-2">✓</p>
          <p className="text-zinc-400 text-sm">No pending transactions.</p>
          <p className="text-zinc-500 text-xs mt-1">Import a CSV to get started.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-700 bg-zinc-800/40 px-4">
          {transactions.map(tx => (
            <ReviewRow
              key={tx.id}
              tx={tx}
              buckets={buckets}
              onApprove={handleApprove}
              onIgnore={handleIgnore}
            />
          ))}
        </div>
      )}
    </div>
  );
}
