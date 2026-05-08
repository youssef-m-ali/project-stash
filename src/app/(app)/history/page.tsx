import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { getTransactions, patchTransaction, deleteTransaction } from '@/lib/db/queries/transactions';
import { getBuckets } from '@/lib/db/queries/buckets';
import { getConfig } from '@/lib/db/queries/config';
import type { TransactionWithSubs, Bucket } from '@/lib/types';

function monthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return format(new Date(y, m - 1, 1), 'MMMM yyyy');
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'approved') return null;
  if (status === 'pending')
    return <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 whitespace-nowrap">Pending</span>;
  return <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-500 whitespace-nowrap">Ignored</span>;
}

// ── Transaction row ───────────────────────────────────────────────────────────

function TxRow({
  tx,
  buckets,
  accountLabel,
  onReclassify,
  onDelete,
}: {
  tx: TransactionWithSubs;
  buckets: Bucket[];
  accountLabel: string;
  onReclassify: (txId: string, bucketId: string | null) => Promise<void>;
  onDelete: (txId: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  async function handleBucketChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value || null;
    setBusy(true);
    await onReclassify(tx.id, val);
    setBusy(false);
  }

  async function handleDelete() {
    setBusy(true);
    await onDelete(tx.id);
  }

  return (
    <div className="grid grid-cols-[72px_1fr_88px_120px_168px_80px_28px] gap-3 items-center py-2.5 px-4 border-b border-zinc-700/30 last:border-0 hover:bg-zinc-700/10 transition-colors group">
      <span className="text-xs text-zinc-500 tabular-nums">
        {format(parseISO(tx.date), 'MMM d')}
      </span>

      <span className="text-sm text-zinc-200 truncate" title={tx.description}>
        {tx.description}
      </span>

      <span className={`text-sm tabular-nums text-right font-medium ${tx.amount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
        {tx.amount > 0 ? '-' : '+'}${Math.abs(tx.netAmount).toFixed(2)}
      </span>

      <span className="text-xs text-zinc-500 truncate" title={accountLabel}>
        {accountLabel}
      </span>

      <select
        value={tx.bucketId ?? ''}
        onChange={handleBucketChange}
        disabled={busy}
        className="text-xs bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-zinc-300 focus:outline-none focus:border-zinc-400 disabled:opacity-50 truncate"
      >
        <option value="">— unclassified —</option>
        {buckets.map(b => (
          <option key={b.id} value={b.id}>
            {b.emoji ? `${b.emoji} ${b.name}` : b.name}
          </option>
        ))}
      </select>

      <div className="flex justify-end">
        <StatusBadge status={tx.status} />
      </div>

      <button
        type="button"
        onClick={handleDelete}
        disabled={busy}
        aria-label="Delete transaction"
        className="text-zinc-600 hover:text-red-400 transition-colors text-base leading-none opacity-0 group-hover:opacity-100 disabled:opacity-30"
      >
        ×
      </button>
    </div>
  );
}

// ── Month section ─────────────────────────────────────────────────────────────

function MonthSection({
  monthKey,
  transactions,
  buckets,
  accountMap,
  onReclassify,
  onDelete,
  defaultOpen,
}: {
  monthKey: string;
  transactions: TransactionWithSubs[];
  buckets: Bucket[];
  accountMap: Map<string, string>;
  onReclassify: (txId: string, bucketId: string | null) => Promise<void>;
  onDelete: (txId: string) => Promise<void>;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const approvedTotal = transactions
    .filter(t => t.status === 'approved')
    .reduce((s, t) => s + t.netAmount, 0);

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-800/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-4 px-4 py-3 hover:bg-zinc-700/30 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-zinc-100">{monthLabel(monthKey)}</span>
          <span className="text-xs text-zinc-500">{transactions.length} transaction{transactions.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm tabular-nums text-zinc-400">
            ${approvedTotal.toFixed(0)} approved
          </span>
          <span className="text-zinc-500 text-xs">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-zinc-700">
          <div className="grid grid-cols-[72px_1fr_88px_120px_168px_80px_28px] gap-3 px-4 py-2 bg-zinc-900/40 text-xs font-medium text-zinc-500 uppercase tracking-wide">
            <span>Date</span>
            <span>Description</span>
            <span className="text-right">Amount</span>
            <span>Account</span>
            <span>Bucket</span>
            <span className="text-right">Status</span>
            <span />
          </div>
          {transactions.map(tx => (
            <TxRow
              key={tx.id}
              tx={tx}
              buckets={buckets}
              accountLabel={accountMap.get(tx.accountId) ?? tx.accountId}
              onReclassify={onReclassify}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const [transactions, setTransactions] = useState<TransactionWithSubs[]>([]);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [accountMap, setAccountMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getTransactions(), getBuckets(), getConfig()])
      .then(([txs, buckets, config]) => {
        setTransactions(txs);
        setBuckets(buckets);
        const map = new Map<string, string>();
        for (const a of (config?.accounts ?? [])) map.set(a.id, a.label);
        setAccountMap(map);
      })
      .finally(() => setLoading(false));
  }, []);

  async function deleteTx(txId: string) {
    await deleteTransaction(txId);
    setTransactions(prev => prev.filter(tx => tx.id !== txId));
  }

  async function reclassify(txId: string, bucketId: string | null) {
    const status = bucketId ? 'approved' : 'pending';
    await patchTransaction(txId, { status, bucketId });
    setTransactions(prev => prev.map(tx =>
      tx.id === txId ? { ...tx, bucketId, status } : tx,
    ));
  }

  const byMonth = new Map<string, TransactionWithSubs[]>();
  for (const tx of transactions) {
    const month = tx.date.slice(0, 7);
    const list = byMonth.get(month) ?? [];
    list.push(tx);
    byMonth.set(month, list);
  }
  const months = [...byMonth.keys()].sort().reverse();

  if (loading) return <div className="text-zinc-500 text-sm">Loading…</div>;

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">History</h1>
        <p className="text-sm text-zinc-500 mt-0.5">All transactions grouped by month. Change the bucket to re-classify.</p>
      </div>

      {months.length === 0 ? (
        <div className="rounded-xl border border-zinc-700 bg-zinc-800/40 p-12 text-center">
          <p className="text-zinc-500 text-sm">No transactions yet.</p>
          <p className="text-zinc-600 text-xs mt-1">Import a CSV to get started.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {months.map((month, i) => (
            <MonthSection
              key={month}
              monthKey={month}
              transactions={byMonth.get(month)!}
              buckets={buckets}
              accountMap={accountMap}
              onReclassify={reclassify}
              onDelete={deleteTx}
              defaultOpen={i === 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
