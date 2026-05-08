

import type { ParsedTransaction } from '@/lib/types';
import { Button } from '@/components/ui/Button';

interface Props {
  transactions: (ParsedTransaction & { id: string })[];
  onConfirm: (txs: (ParsedTransaction & { id: string })[]) => void;
  loading: boolean;
}

export function PreviewTable({ transactions, onConfirm, loading }: Props) {
  const newTxs      = transactions.filter(t => !t.duplicate);
  const duplicates  = transactions.filter(t => t.duplicate);

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-zinc-700 bg-zinc-800/40 px-6 py-5 flex flex-col gap-3">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-zinc-100 tabular-nums">{newTxs.length}</span>
          <span className="text-sm text-zinc-400">new transaction{newTxs.length !== 1 ? 's' : ''}</span>
        </div>
        {duplicates.length > 0 && (
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-semibold text-amber-400 tabular-nums">{duplicates.length}</span>
            <span className="text-sm text-zinc-500">already imported — will be skipped</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <Button onClick={() => onConfirm(transactions)} disabled={loading || newTxs.length === 0}>
          {loading ? 'Importing…' : `Import ${newTxs.length} transaction${newTxs.length !== 1 ? 's' : ''}`}
        </Button>
        <p className="text-xs text-zinc-500">
          Transactions will appear in the Review queue for categorization.
        </p>
      </div>
    </div>
  );
}
