'use client';

import { useEffect, useState, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import type { PaycheckPeriod, BucketFill, TransactionWithSubs, Subtransaction } from '@/lib/types';

function fmt(iso: string) {
  return format(parseISO(iso), 'MMM d, yyyy');
}

function fmtShort(iso: string) {
  return format(parseISO(iso), 'MMM d');
}

// ── Split form ────────────────────────────────────────────────────────────────

function AddSplitForm({
  txId,
  txDate,
  onAdded,
}: {
  txId: string;
  txDate: string;
  onAdded: (sub: Subtransaction) => void;
}) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(txDate);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!description.trim() || isNaN(parsed) || parsed <= 0) return;
    setBusy(true);
    const res = await fetch(`/api/transactions/${txId}/subtransactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: description.trim(), amount: parsed, date }),
    });
    if (res.ok) {
      const { subtransaction } = await res.json();
      onAdded(subtransaction);
      setDescription('');
      setAmount('');
    }
    setBusy(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 mt-1.5 pl-4">
      <input
        className="flex-1 min-w-32 bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-400"
        placeholder="Description (e.g. Roommate's share)"
        value={description}
        onChange={e => setDescription(e.target.value)}
        disabled={busy}
      />
      <input
        type="number"
        min="0.01"
        step="0.01"
        className="w-24 bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-400 tabular-nums"
        placeholder="Amount"
        value={amount}
        onChange={e => setAmount(e.target.value)}
        disabled={busy}
      />
      <input
        type="date"
        className="bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-zinc-400"
        value={date}
        onChange={e => setDate(e.target.value)}
        disabled={busy}
      />
      <button
        type="submit"
        disabled={busy || !description.trim() || !amount}
        className="px-3 py-1 text-xs bg-zinc-600 text-zinc-200 rounded hover:bg-zinc-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Add split
      </button>
    </form>
  );
}

// ── Transaction row ───────────────────────────────────────────────────────────

function TransactionRow({
  tx,
  onSubtransactionChange,
}: {
  tx: TransactionWithSubs;
  onSubtransactionChange: (txId: string, subs: Subtransaction[]) => void;
}) {
  const [addingSplit, setAddingSplit] = useState(false);

  function handleAdded(sub: Subtransaction) {
    const updated = [...tx.subtransactions, sub];
    onSubtransactionChange(tx.id, updated);
    setAddingSplit(false);
  }

  async function handleDeleteSub(subId: string) {
    await fetch(`/api/subtransactions/${subId}`, { method: 'DELETE' });
    const updated = tx.subtransactions.filter(s => s.id !== subId);
    onSubtransactionChange(tx.id, updated);
  }

  const netAmount = tx.amount + tx.subtransactions.reduce((s, sub) => s + sub.amount, 0);

  return (
    <div className="py-2 border-b border-zinc-700/30 last:border-0">
      {/* Main transaction row */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-zinc-500 tabular-nums w-14 shrink-0">{fmtShort(tx.date)}</span>
        <span className="text-sm text-zinc-300 flex-1 truncate" title={tx.description}>{tx.description}</span>
        <div className="flex items-center gap-3 shrink-0">
          {tx.subtransactions.length > 0 && (
            <span className="text-xs text-zinc-500 tabular-nums line-through">
              ${tx.amount.toFixed(2)}
            </span>
          )}
          <span className={`text-sm tabular-nums font-medium ${netAmount <= 0 ? 'text-emerald-400' : 'text-zinc-200'}`}>
            ${netAmount.toFixed(2)}
          </span>
          <button
            type="button"
            onClick={() => setAddingSplit((v: boolean) => !v)}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-1.5 py-0.5 rounded hover:bg-zinc-700"
          >
            {addingSplit ? '✕' : '+ split'}
          </button>
        </div>
      </div>

      {/* Existing subtransactions */}
      {tx.subtransactions.map(sub => (
        <div key={sub.id} className="flex items-center gap-3 pl-4 mt-1">
          <span className="text-xs text-zinc-600 tabular-nums w-14 shrink-0">{fmtShort(sub.date)}</span>
          <span className="text-xs text-zinc-500 flex-1 truncate">↳ {sub.description}</span>
          <span className="text-xs text-emerald-500 tabular-nums">+${Math.abs(sub.amount).toFixed(2)}</span>
          <button
            type="button"
            onClick={() => handleDeleteSub(sub.id)}
            className="text-xs text-zinc-600 hover:text-red-400 transition-colors px-1"
            aria-label="Remove split"
          >
            ✕
          </button>
        </div>
      ))}

      {/* Add split form */}
      {addingSplit && (
        <AddSplitForm txId={tx.id} txDate={tx.date} onAdded={handleAdded} />
      )}
    </div>
  );
}

// ── Bucket detail (transactions within a bucket) ──────────────────────────────

function BucketDetail({
  bucketId,
  periodId,
}: {
  bucketId: string;
  periodId: string;
}) {
  const [transactions, setTransactions] = useState<TransactionWithSubs[] | null>(null);

  useEffect(() => {
    fetch(`/api/transactions?periodId=${periodId}&status=approved&bucketId=${bucketId}`)
      .then(r => r.json())
      .then(d => setTransactions(d.transactions ?? []));
  }, [bucketId, periodId]);

  function handleSubChange(txId: string, subs: Subtransaction[]) {
    setTransactions(prev =>
      prev?.map(tx => {
        if (tx.id !== txId) return tx;
        const subTotal = subs.reduce((s, sub) => s + sub.amount, 0);
        return { ...tx, subtransactions: subs, netAmount: tx.amount + subTotal };
      }) ?? null,
    );
  }

  if (transactions === null) {
    return <div className="px-4 py-3 text-xs text-zinc-500">Loading…</div>;
  }
  if (transactions.length === 0) {
    return <div className="px-4 py-3 text-xs text-zinc-500">No transactions.</div>;
  }

  return (
    <div className="px-4 pb-3">
      {transactions.map(tx => (
        <TransactionRow key={tx.id} tx={tx} onSubtransactionChange={handleSubChange} />
      ))}
    </div>
  );
}

// ── Period card ───────────────────────────────────────────────────────────────

interface PeriodSummary {
  period: PaycheckPeriod;
  buckets: BucketFill[];
  totalSpent: number;
  totalPlanned: number;
}

function PeriodCard({ summary }: { summary: PeriodSummary }) {
  const [expanded, setExpanded] = useState(false);
  const [expandedBucket, setExpandedBucket] = useState<string | null>(null);
  const { period, buckets, totalSpent, totalPlanned } = summary;
  const pct = totalPlanned > 0 ? Math.min(totalSpent / totalPlanned, 1) : 0;

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-800/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between gap-4 p-4 hover:bg-zinc-700/30 transition-colors"
      >
        <div className="text-left">
          <p className="text-sm font-medium text-zinc-200">
            {fmt(period.startDate)} – {fmt(period.endDate)}
          </p>
          <p className="text-xs text-zinc-500 mt-0.5 tabular-nums">
            ${totalSpent.toFixed(0)} of ${totalPlanned.toFixed(0)} spent
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-24 h-1.5 rounded-full bg-zinc-700">
            <div className="h-full rounded-full bg-zinc-400" style={{ width: `${pct * 100}%` }} />
          </div>
          <span className="text-xs text-zinc-500">{Math.round(pct * 100)}%</span>
          <span className="text-zinc-500 text-sm">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-zinc-700">
          {buckets.map(b => (
            <div key={b.id}>
              <button
                type="button"
                onClick={() => setExpandedBucket(prev => prev === b.id ? null : b.id)}
                className="w-full flex items-center gap-3 px-4 py-2.5 border-b border-zinc-700/40 last:border-0 hover:bg-zinc-700/20 transition-colors"
              >
                {b.emoji ? (
                  <span className="text-base leading-none shrink-0">{b.emoji}</span>
                ) : (
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                )}
                <span className="text-sm text-zinc-300 flex-1 text-left truncate">{b.name}</span>
                <span className="text-sm tabular-nums text-zinc-400">
                  ${b.spent.toFixed(0)} / ${b.planned.toFixed(0)}
                </span>
                {b.spent > b.planned && (
                  <span className="text-xs text-red-400">OVER</span>
                )}
                <span className="text-zinc-600 text-xs ml-1">{expandedBucket === b.id ? '▲' : '▼'}</span>
              </button>

              {expandedBucket === b.id && (
                <div className="border-b border-zinc-700/40 bg-zinc-900/30">
                  <BucketDetail bucketId={b.id} periodId={period.id} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const [summaries, setSummaries] = useState<PeriodSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [periodsData, bucketsData] = await Promise.all([
      fetch('/api/periods').then(r => r.json()),
      fetch('/api/buckets').then(r => r.json()),
    ]);

    const today = new Date().toISOString().slice(0, 10);
    const pastPeriods: PaycheckPeriod[] = (periodsData.periods ?? []).filter(
      (p: PaycheckPeriod) => p.endDate < today,
    );

    const results = await Promise.all(
      pastPeriods.map(async (period: PaycheckPeriod) => {
        const txData = await fetch(
          `/api/transactions?periodId=${period.id}&status=approved`,
        ).then(r => r.json());

        const txs: TransactionWithSubs[] = txData.transactions ?? [];

        // Net spend by bucket — uses netAmount which already includes subtransaction credits
        const spendMap = new Map<string, number>();
        for (const tx of txs) {
          if (tx.bucketId) {
            spendMap.set(tx.bucketId, (spendMap.get(tx.bucketId) ?? 0) + tx.netAmount);
          }
        }

        const buckets: BucketFill[] = (bucketsData.buckets ?? []).map(
          (b: { id: string; name: string; color: string; emoji: string | null; sortOrder: number; amountPerPaycheck: number }) => {
            const spent = spendMap.get(b.id) ?? 0;
            return {
              id: b.id,
              name: b.name,
              color: b.color,
              emoji: b.emoji ?? null,
              sortOrder: b.sortOrder,
              planned: b.amountPerPaycheck,
              spent,
              pct: b.amountPerPaycheck > 0 ? spent / b.amountPerPaycheck : 0,
            };
          },
        );

        return {
          period,
          buckets,
          totalSpent: buckets.reduce((s, b) => s + b.spent, 0),
          totalPlanned: buckets.reduce((s, b) => s + b.planned, 0),
        };
      }),
    );

    setSummaries(results);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  if (loading) return <div className="text-zinc-500 text-sm">Loading…</div>;

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">History</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Past paycheck periods with spending summaries.</p>
      </div>

      {summaries.length === 0 ? (
        <div className="rounded-xl border border-zinc-700 bg-zinc-800/40 p-12 text-center">
          <p className="text-zinc-500 text-sm">No past periods yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {summaries.map(s => <PeriodCard key={s.period.id} summary={s} />)}
        </div>
      )}
    </div>
  );
}
