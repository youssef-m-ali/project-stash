'use client';

import { useEffect, useState, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import type { ReviewTransaction, Bucket } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { normalizeMerchant } from '@/lib/import/normalizeMerchant';

// ─── Card content (shared between inline + drag overlay) ──────────────────────

function TxCardContent({ tx }: { tx: ReviewTransaction }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-zinc-500 tabular-nums">
          {format(parseISO(tx.date), 'MMM d')}
        </span>
        <span className={`text-xs font-semibold tabular-nums ${tx.amount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
          {tx.amount > 0 ? '-' : '+'}${Math.abs(tx.amount).toFixed(2)}
        </span>
      </div>
      <p className="text-sm text-zinc-200 leading-snug line-clamp-2">{tx.description}</p>
    </div>
  );
}

// ─── Draggable card (backlog only) ────────────────────────────────────────────

function DraggableCard({
  tx,
  onIgnore,
  onEdit,
}: {
  tx: ReviewTransaction;
  onIgnore: () => void;
  onEdit: (description: string, amount: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [desc, setDesc]       = useState(tx.description);
  const [amount, setAmount]   = useState(String(tx.amount));
  const [saving, setSaving]   = useState(false);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: tx.id });

  function openEdit() {
    setDesc(tx.description);
    setAmount(String(tx.amount));
    setEditing(true);
  }

  async function handleSave() {
    const parsed = parseFloat(amount);
    if (isNaN(parsed)) return;
    setSaving(true);
    await fetch(`/api/transactions/${tx.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: desc, amount: parsed }),
    });
    onEdit(desc, parsed);
    setEditing(false);
    setSaving(false);
  }

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...(editing ? {} : listeners)}
      className={`rounded-lg bg-zinc-800 border border-zinc-700 p-3 touch-none select-none transition-opacity ${isDragging ? 'opacity-25' : 'hover:border-zinc-600'} ${editing ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
    >
      <TxCardContent tx={tx} />
      {editing ? (
        <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-zinc-700/50">
          <input
            value={desc}
            onChange={e => setDesc(e.target.value)}
            onPointerDown={e => e.stopPropagation()}
            className="w-full text-sm bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-zinc-200 focus:outline-none focus:border-zinc-400"
            placeholder="Description"
          />
          <input
            value={amount}
            onChange={e => setAmount(e.target.value)}
            onPointerDown={e => e.stopPropagation()}
            type="number"
            step="0.01"
            className="w-full text-sm bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-zinc-200 focus:outline-none focus:border-zinc-400 tabular-nums"
            placeholder="Amount"
          />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onPointerDown={e => e.stopPropagation()} onClick={() => setEditing(false)} className="text-xs h-6 px-2">Cancel</Button>
            <Button size="sm" onPointerDown={e => e.stopPropagation()} onClick={handleSave} disabled={saving} className="text-xs h-6 px-2">Save</Button>
          </div>
        </div>
      ) : (
        <div className="mt-2 pt-2 border-t border-zinc-700/50 flex justify-between">
          <Button size="sm" variant="ghost" onPointerDown={e => e.stopPropagation()} onClick={openEdit} className="text-xs h-6 px-2">Edit</Button>
          <Button size="sm" variant="ghost" onPointerDown={e => e.stopPropagation()} onClick={onIgnore} className="text-xs h-6 px-2">Ignore</Button>
        </div>
      )}
    </div>
  );
}

// ─── Suggested card (sits in a bucket column, awaits confirmation) ─────────────

function SuggestedCard({
  tx,
  onConfirm,
  onDenyOnce,
  onDenyAndExempt,
  busy,
}: {
  tx: ReviewTransaction;
  onConfirm: () => void;
  onDenyOnce: () => void;
  onDenyAndExempt: () => void;
  busy: boolean;
}) {
  const [popoverOpen, setPopoverOpen] = useState(false);

  return (
    <div className="rounded-lg bg-zinc-800 border border-amber-400/40 p-3">
      <TxCardContent tx={tx} />
      <div className="mt-2 pt-2 border-t border-zinc-700/50 relative">
        <div className="flex gap-2 justify-end">
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => setPopoverOpen(v => !v)}
            className="text-xs h-6 px-2"
          >
            Deny
          </Button>
          <Button size="sm" disabled={busy} onClick={onConfirm} className="text-xs h-6 px-2 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30">
            Confirm
          </Button>
        </div>

        {popoverOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setPopoverOpen(false)} />
            <div className="absolute top-full right-0 mt-2 z-50 w-52 bg-zinc-900 border border-zinc-700/60 rounded-2xl shadow-lg shadow-black/30 p-3 flex flex-col gap-2.5">
              <div className="absolute -top-1.5 right-10 w-3 h-3 bg-zinc-900 border-l border-t border-zinc-700/60 rotate-45" />
              <p className="text-xs text-zinc-400 leading-snug">Keep auto-classifying this merchant going forward?</p>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => { onDenyOnce(); setPopoverOpen(false); }}
                  className="flex-1 text-xs py-1.5 px-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                >
                  Just this once
                </button>
                <button
                  type="button"
                  onClick={() => { onDenyAndExempt(); setPopoverOpen(false); }}
                  className="flex-1 text-xs py-1.5 px-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400 transition-colors"
                >
                  Exempt
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Backlog column ───────────────────────────────────────────────────────────

function BacklogColumn({
  transactions,
  onIgnore,
  onEdit,
}: {
  transactions: ReviewTransaction[];
  onIgnore: (id: string) => void;
  onEdit: (id: string, description: string, amount: number) => void;
}) {
  return (
    <div className="flex-none w-64 flex flex-col gap-3 self-start sticky top-0">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-600">
        <span className="text-sm font-semibold text-zinc-300 flex-1">Backlog</span>
        {transactions.length > 0 && (
          <span className="text-xs bg-zinc-700 text-zinc-400 px-2 py-0.5 rounded-full tabular-nums">
            {transactions.length}
          </span>
        )}
      </div>
      <div className="relative rounded-lg border border-zinc-700 bg-zinc-900/50">
        <div className="flex flex-col gap-2 overflow-y-auto max-h-[calc(100vh-12rem)] p-2">
          {transactions.length === 0 ? (
            <div className="min-h-24 flex items-center justify-center rounded-md border-2 border-dashed border-zinc-700/30">
              <span className="text-xs text-zinc-600">All categorized</span>
            </div>
          ) : (
            transactions.map(tx => (
              <DraggableCard
                key={tx.id}
                tx={tx}
                onIgnore={() => onIgnore(tx.id)}
                onEdit={(description, amount) => onEdit(tx.id, description, amount)}
              />
            ))
          )}
        </div>
        {transactions.length > 0 && (
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-12 rounded-b-lg bg-gradient-to-t from-zinc-900 to-transparent" />
        )}
      </div>
    </div>
  );
}

// ─── Droppable bucket column ──────────────────────────────────────────────────

function BucketColumn({
  bucket,
  transactions,
  onConfirm,
  onDenyOnce,
  onDenyAndExempt,
}: {
  bucket: Bucket;
  transactions: ReviewTransaction[];
  onConfirm: (txId: string, bucketId: string) => Promise<void>;
  onDenyOnce: (id: string) => void;
  onDenyAndExempt: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: bucket.id });
  const [busyIds, setBusyIds] = useState(new Set<string>());

  async function handleConfirm(txId: string) {
    setBusyIds(p => new Set(p).add(txId));
    await onConfirm(txId, bucket.id);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700">
        {bucket.emoji && <span className="text-base leading-none">{bucket.emoji}</span>}
        <span className="text-sm font-semibold text-zinc-200 flex-1 truncate">{bucket.name}</span>
        {transactions.length > 0 && (
          <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full tabular-nums">
            {transactions.length}
          </span>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 min-h-24 flex flex-col gap-2 rounded-lg border-2 border-dashed p-2 transition-colors ${
          isOver
            ? 'border-blue-400/70 bg-blue-500/5'
            : 'border-zinc-700/30'
        }`}
      >
        {transactions.map(tx => (
          <SuggestedCard
            key={tx.id}
            tx={tx}
            onConfirm={() => handleConfirm(tx.id)}
            onDenyOnce={() => onDenyOnce(tx.id)}
            onDenyAndExempt={() => onDenyAndExempt(tx.id)}
            busy={busyIds.has(tx.id)}
          />
        ))}
        {transactions.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-xs text-zinc-600">Drop here</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main board ───────────────────────────────────────────────────────────────

export default function ReviewPage() {
  const [transactions, setTransactions] = useState<ReviewTransaction[]>([]);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);

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
    setTransactions(prev => {
      const approvedTx = prev.find(t => t.id === id);
      const key = approvedTx ? normalizeMerchant(approvedTx.description) : null;
      return prev
        .filter(t => t.id !== id)
        .map(t => {
          if (key && !t.suggestedBucketId && normalizeMerchant(t.description) === key) {
            return { ...t, suggestedBucketId: bucketId };
          }
          return t;
        });
    });
  }

  async function handleIgnore(id: string) {
    await fetch(`/api/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ignored' }),
    });
    setTransactions(prev => prev.filter(t => t.id !== id));
  }

  async function handleConfirmAllSuggested() {
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
    const merchantMap = new Map<string, string>();
    for (const t of suggested) {
      const key = normalizeMerchant(t.description);
      if (key) merchantMap.set(key, t.suggestedBucketId!);
    }
    setTransactions(prev =>
      prev.filter(t => !approvedIds.has(t.id)).map(t => {
        if (!t.suggestedBucketId) {
          const key = normalizeMerchant(t.description);
          const bucketId = key ? merchantMap.get(key) : undefined;
          if (bucketId) return { ...t, suggestedBucketId: bucketId };
        }
        return t;
      }),
    );
  }

  function handleDenyOnce(id: string) {
    setTransactions(prev => prev.map(t =>
      t.id === id ? { ...t, suggestedBucketId: null } : t,
    ));
  }

  async function handleDenyAndExempt(id: string) {
    const tx = transactions.find(t => t.id === id);
    const key = tx ? normalizeMerchant(tx.description) : '';
    if (key) {
      await fetch('/api/merchant-exemptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchantKey: key }),
      });
      setTransactions(prev => prev.map(t =>
        normalizeMerchant(t.description) === key ? { ...t, suggestedBucketId: null } : t,
      ));
    } else {
      setTransactions(prev => prev.map(t =>
        t.id === id ? { ...t, suggestedBucketId: null } : t,
      ));
    }
  }

  function handleEdit(id: string, description: string, amount: number) {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, description, amount } : t));
  }

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;
    handleApprove(active.id as string, over.id as string);
  }

  if (loading) return <div className="text-zinc-500 text-sm">Loading…</div>;

  const uncategorized = transactions.filter(t => !t.suggestedBucketId);
  const suggestedByBucket = new Map<string, ReviewTransaction[]>();
  for (const tx of transactions) {
    if (!tx.suggestedBucketId) continue;
    const list = suggestedByBucket.get(tx.suggestedBucketId) ?? [];
    list.push(tx);
    suggestedByBucket.set(tx.suggestedBucketId, list);
  }

  const suggestedCount = transactions.length - uncategorized.length;
  const activeTx = activeId ? transactions.find(t => t.id === activeId) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Review</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {transactions.length === 0
              ? 'All caught up — nothing to review.'
              : `${transactions.length} transaction${transactions.length === 1 ? '' : 's'} pending · drag backlog cards to a bucket`}
          </p>
        </div>
        {suggestedCount > 0 && (
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() =>
              setTransactions(prev => prev.map(t => ({ ...t, suggestedBucketId: null })))
            }>
              Deny all
            </Button>
            <Button type="button" variant="secondary" onClick={handleConfirmAllSuggested}>
              Confirm all ({suggestedCount})
            </Button>
          </div>
        )}
      </div>

      {transactions.length === 0 ? (
        <div className="rounded-xl border border-zinc-700 bg-zinc-800/40 p-12 text-center">
          <p className="text-2xl mb-2">✓</p>
          <p className="text-zinc-400 text-sm">No pending transactions.</p>
          <p className="text-zinc-500 text-xs mt-1">Import a CSV to get started.</p>
        </div>
      ) : (
        <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 items-start">
            <BacklogColumn transactions={uncategorized} onIgnore={handleIgnore} onEdit={handleEdit} />
            <div className="grid grid-cols-3 gap-3 flex-1">
              {buckets.map(bucket => (
                <BucketColumn
                  key={bucket.id}
                  bucket={bucket}
                  transactions={suggestedByBucket.get(bucket.id) ?? []}
                  onConfirm={handleApprove}
                  onDenyOnce={handleDenyOnce}
                  onDenyAndExempt={handleDenyAndExempt}
                />
              ))}
            </div>
          </div>

          <DragOverlay dropAnimation={null}>
            {activeTx && (
              <div className="rounded-lg bg-zinc-800 border border-blue-400/60 p-3 shadow-2xl w-64 rotate-1 opacity-95 pointer-events-none">
                <TxCardContent tx={activeTx} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

    </div>
  );
}
