import { useEffect, useState } from 'react';
import { getTransactions } from '@/lib/db/queries/transactions';
import type { BucketFill, TransactionWithSubs } from '@/lib/types';

interface Props {
  bucket: BucketFill;
  periodId: string;
  startDate: string;
  endDate: string;
  onClose: () => void;
}

export function BucketTransactionsPanel({ bucket, periodId, startDate, endDate, onClose }: Props) {
  const [txs, setTxs] = useState<TransactionWithSubs[] | 'loading'>('loading');

  useEffect(() => {
    setTxs('loading');
    getTransactions({ bucketId: bucket.id, periodId, startDate, endDate, status: 'approved' })
      .then(setTxs)
      .catch(() => setTxs([]));
  }, [bucket.id, periodId, startDate, endDate]);

  const isOver = bucket.spent > bucket.planned;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-zinc-700/60 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {bucket.emoji ? (
            <span className="text-base leading-none shrink-0">{bucket.emoji}</span>
          ) : (
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: bucket.color }} />
          )}
          <span className="text-sm font-semibold text-zinc-100 truncate">{bucket.name}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs tabular-nums text-zinc-400">
            <span className={isOver ? 'text-red-400' : 'text-zinc-300'}>${bucket.spent.toFixed(0)}</span>
            <span className="text-zinc-600"> / </span>
            <span>${bucket.planned.toFixed(0)}</span>
          </span>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 transition-colors text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {txs === 'loading' ? (
          <p className="text-sm text-zinc-500 py-8 text-center">Loading…</p>
        ) : txs.length === 0 ? (
          <p className="text-sm text-zinc-500 py-8 text-center">No transactions this period.</p>
        ) : (
          <ul className="divide-y divide-zinc-700/40">
            {txs.map(tx => (
              <li key={tx.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-zinc-200 truncate">{tx.description}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{tx.date}</p>
                  {tx.subtransactions.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5">
                      {tx.subtransactions.map(s => (
                        <li key={s.id} className="flex justify-between text-xs text-zinc-500 gap-2">
                          <span className="truncate">{s.description}</span>
                          <span className="tabular-nums shrink-0">
                            {s.amount < 0 ? '−' : '+'}${Math.abs(s.amount).toFixed(2)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="shrink-0 text-sm tabular-nums pt-0.5">
                  {tx.netAmount < 0 ? (
                    <span className="text-emerald-400">−${Math.abs(tx.netAmount).toFixed(2)}</span>
                  ) : (
                    <span className="text-zinc-200">${tx.netAmount.toFixed(2)}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
