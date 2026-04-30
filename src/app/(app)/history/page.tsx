'use client';

import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import type { PaycheckPeriod, BucketFill } from '@/lib/types';

interface PeriodSummary {
  period: PaycheckPeriod;
  buckets: BucketFill[];
  totalSpent: number;
  totalPlanned: number;
}

function fmt(iso: string) {
  return format(parseISO(iso), 'MMM d, yyyy');
}

function PeriodCard({ summary }: { summary: PeriodSummary }) {
  const [expanded, setExpanded] = useState(false);
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
            <div
              className="h-full rounded-full bg-zinc-400"
              style={{ width: `${pct * 100}%` }}
            />
          </div>
          <span className="text-xs text-zinc-500">{Math.round(pct * 100)}%</span>
          <span className="text-zinc-500 text-sm">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-zinc-700 px-4 pb-4">
          {buckets.map(b => (
            <div key={b.id} className="flex items-center gap-3 py-2 border-b border-zinc-700/40 last:border-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: b.color }}
              />
              <span className="text-sm text-zinc-300 flex-1 truncate">{b.name}</span>
              <span className="text-sm tabular-nums text-zinc-400">
                ${b.spent.toFixed(0)} / ${b.planned.toFixed(0)}
              </span>
              {b.spent > b.planned && (
                <span className="text-xs text-red-400">OVER</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HistoryPage() {
  const [summaries, setSummaries] = useState<PeriodSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/periods').then(r => r.json()),
      fetch('/api/buckets').then(r => r.json()),
    ]).then(async ([periodsData, bucketsData]) => {
      const today = new Date().toISOString().slice(0, 10);
      const pastPeriods: PaycheckPeriod[] = (periodsData.periods ?? []).filter(
        (p: PaycheckPeriod) => p.endDate < today,
      );

      // For each past period, fetch spend totals
      const results = await Promise.all(
        pastPeriods.map(async (period: PaycheckPeriod) => {
          const txRes = await fetch(`/api/transactions?periodId=${period.id}&status=approved`);
          const txData = await txRes.json();
          const txs = txData.transactions ?? [];

          // Sum spend by bucket
          const spendMap = new Map<string, number>();
          for (const tx of txs) {
            if (tx.amount > 0 && tx.bucketId) {
              spendMap.set(tx.bucketId, (spendMap.get(tx.bucketId) ?? 0) + tx.amount);
            }
          }

          const buckets: BucketFill[] = (bucketsData.buckets ?? []).map(
            (b: { id: string; name: string; color: string; sortOrder: number; amountPerPaycheck: number }) => {
              const spent = spendMap.get(b.id) ?? 0;
              return {
                id: b.id,
                name: b.name,
                color: b.color,
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
    }).finally(() => setLoading(false));
  }, []);

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
