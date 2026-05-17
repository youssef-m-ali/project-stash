

import { useEffect, useState } from 'react';
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import type { CsvMapping } from '@/lib/types';
import { splitRows, splitCols } from '@/lib/import/parseUtils';
import { Button } from '@/components/ui/Button';

export interface MappingEntry {
  file: File;
  accountId: string;
  accountLabel: string;
  headers: string[];
  mapping: CsvMapping;
}

function ColChip({ label, faded = false, fullWidth = false }: { label: string; faded?: boolean; fullWidth?: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-md bg-zinc-700 border border-zinc-600 text-xs font-mono text-zinc-200 select-none transition-opacity ${faded ? 'opacity-25' : ''} ${fullWidth ? 'w-full h-full' : ''}`}
    >
      {label}
    </span>
  );
}

function DraggableChip({ colIdx, label }: { colIdx: number; label: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: String(colIdx) });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className="touch-none cursor-grab active:cursor-grabbing w-full h-10">
      <ColChip label={label} faded={isDragging} fullWidth />
    </div>
  );
}

function DropSlot({
  label,
  slotId,
  assignedLabel,
  onClear,
}: {
  label: string;
  slotId: string;
  assignedLabel: string | null;
  onClear: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: slotId });

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{label}</span>
      <div
        ref={setNodeRef}
        className={`h-10 rounded-lg border-2 flex items-center px-3 transition-colors ${
          assignedLabel
            ? 'border-solid border-zinc-600 bg-zinc-700/50'
            : isOver
            ? 'border-blue-400/70 border-dashed bg-blue-500/5'
            : 'border-dashed border-zinc-600/50'
        }`}
      >
        {assignedLabel ? (
          <div className="flex items-center justify-between w-full gap-2">
            <span className="text-xs font-mono text-zinc-200 truncate">{assignedLabel}</span>
            <button
              onClick={onClear}
              className="shrink-0 text-zinc-500 hover:text-zinc-200 text-base leading-none transition-colors"
              aria-label="Clear"
            >
              ×
            </button>
          </div>
        ) : (
          <span className="text-xs text-zinc-600">Drop here</span>
        )}
      </div>
    </div>
  );
}

function DropPool({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'pool' });
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col gap-1.5 min-h-10 rounded-lg p-2 -mx-2 transition-colors ${isOver ? 'bg-zinc-700/20' : ''}`}
    >
      {children}
    </div>
  );
}

function FileMappingCard({
  entry,
  onChange,
}: {
  entry: MappingEntry;
  onChange: (m: CsvMapping) => void;
}) {
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [activeColIdx, setActiveColIdx] = useState<number | null>(null);
  const { mapping, headers } = entry;

  useEffect(() => {
    entry.file.text().then(text => {
      const parsed = splitRows(text).slice(0, 5).map(r => splitCols(r));
      setPreviewRows(parsed);
    });
  }, [entry.file]);

  function slotOf(colIdx: number): 'date' | 'desc' | 'amount' | null {
    if (mapping.dateCol === colIdx) return 'date';
    if (mapping.descCol === colIdx) return 'desc';
    if (mapping.amountCol === colIdx) return 'amount';
    return null;
  }

  function headerOf(colIdx: number | null): string | null {
    if (colIdx === null) return null;
    return headers[colIdx] ?? `Col ${colIdx}`;
  }

  function handleDragStart({ active }: DragStartEvent) {
    setActiveColIdx(Number(active.id));
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveColIdx(null);
    if (!over) return;

    const colIdx = Number(active.id);
    const target = over.id as 'pool' | 'date' | 'desc' | 'amount';
    const from   = slotOf(colIdx);

    if (from === target || (from === null && target === 'pool')) return;

    const next = { ...mapping };

    // Who is currently in the target slot (will be displaced)
    const displaced =
      target === 'date'   ? mapping.dateCol :
      target === 'desc'   ? mapping.descCol :
      target === 'amount' ? mapping.amountCol : null;

    // Vacate the source slot
    if (from === 'date')   next.dateCol   = null;
    if (from === 'desc')   next.descCol   = null;
    if (from === 'amount') next.amountCol = null;

    // Swap: put displaced into the source slot (if source was a slot, not pool)
    if (displaced !== null && from !== null) {
      if (from === 'date')   next.dateCol   = displaced;
      if (from === 'desc')   next.descCol   = displaced;
      if (from === 'amount') next.amountCol = displaced;
    }

    // Place dragged chip into target
    if (target === 'date')   next.dateCol   = colIdx;
    if (target === 'desc')   next.descCol   = colIdx;
    if (target === 'amount') next.amountCol = colIdx;

    onChange(next);
  }

  function clearSlot(slot: 'date' | 'desc' | 'amount') {
    onChange({
      ...mapping,
      dateCol:   slot === 'date'   ? null : mapping.dateCol,
      descCol:   slot === 'desc'   ? null : mapping.descCol,
      amountCol: slot === 'amount' ? null : mapping.amountCol,
    });
  }

  const poolCols = headers.map((_, i) => i).filter(i => slotOf(i) === null);
  const allMapped = mapping.dateCol !== null && mapping.descCol !== null && mapping.amountCol !== null;
  const dataRows  = previewRows.slice(1, 4);

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-800/40 p-5 flex flex-col gap-5">
      <div>
        <p className="text-sm font-semibold text-zinc-100">{entry.accountLabel}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{entry.file.name}</p>
      </div>

      <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-2 gap-32 w-4/5 mx-auto mt-4">
          <div>
            <p className="text-xs text-zinc-500 mb-2">Drag a column to a field:</p>
            <DropPool>
              {poolCols.length === 0 ? (
                <span className="text-xs text-zinc-600 py-1">All columns assigned</span>
              ) : (
                poolCols.map(i => (
                  <DraggableChip key={i} colIdx={i} label={headers[i] ?? `Col ${i}`} />
                ))
              )}
            </DropPool>
          </div>

          <div className="flex flex-col gap-2">
            <DropSlot label="Date"        slotId="date"   assignedLabel={headerOf(mapping.dateCol)}   onClear={() => clearSlot('date')}   />
            <DropSlot label="Description" slotId="desc"   assignedLabel={headerOf(mapping.descCol)}   onClear={() => clearSlot('desc')}   />
            <DropSlot label="Amount"      slotId="amount" assignedLabel={headerOf(mapping.amountCol)} onClear={() => clearSlot('amount')} />
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeColIdx !== null && (
            <ColChip label={headers[activeColIdx] ?? `Col ${activeColIdx}`} />
          )}
        </DragOverlay>
      </DndContext>

      <label className="flex items-center gap-3 cursor-pointer mt-4">
        <button
          type="button"
          role="switch"
          aria-checked={mapping.flipSign}
          onClick={() => onChange({ ...mapping, flipSign: !mapping.flipSign })}
          className={`relative w-9 h-5 rounded-full transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${mapping.flipSign ? 'bg-blue-500' : 'bg-zinc-600'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${mapping.flipSign ? 'translate-x-4' : ''}`} />
        </button>
        <div>
          <p className="text-sm text-zinc-200 leading-none">Flip amount sign</p>
          <p className="text-xs text-zinc-500 mt-1">Turn on if your CSV shows spending as negative numbers</p>
        </div>
      </label>

      {allMapped && dataRows.length > 0 && (
        <div>
          <p className="text-xs text-zinc-500 mb-2">Preview ({dataRows.length} rows):</p>
          <div className="rounded-lg overflow-hidden border border-zinc-700/60">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-zinc-700/40">
                  <th className="text-left px-3 py-2 text-zinc-400 font-medium">Date</th>
                  <th className="text-left px-3 py-2 text-zinc-400 font-medium">Description</th>
                  <th className="text-right px-3 py-2 text-zinc-400 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-700/40">
                {dataRows.map((row, i) => {
                  const raw = parseFloat(row[mapping.amountCol!] ?? '');
                  const effective = isNaN(raw) ? null : (mapping.flipSign ? -raw : raw);
                  return (
                    <tr key={i}>
                      <td className="px-3 py-2 text-zinc-300 tabular-nums whitespace-nowrap">
                        {row[mapping.dateCol!] ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-zinc-300 truncate max-w-[14rem]">
                        {row[mapping.descCol!] ?? '—'}
                      </td>
                      <td className={`px-3 py-2 text-right tabular-nums font-medium ${effective !== null && effective < 0 ? 'text-emerald-400' : 'text-zinc-200'}`}>
                        {effective === null ? '—' : `${effective < 0 ? '−' : ''}$${Math.abs(effective).toFixed(2)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

interface Props {
  entries: MappingEntry[];
  onConfirm: (entries: MappingEntry[]) => void;
  onBack: () => void;
  loading: boolean;
}

export function ColumnMappingStep({ entries, onConfirm, onBack, loading }: Props) {
  const [localEntries, setLocalEntries] = useState<MappingEntry[]>(entries);

  function updateMapping(index: number, mapping: CsvMapping) {
    setLocalEntries(prev => prev.map((e, i) => i === index ? { ...e, mapping } : e));
  }

  const allMapped = localEntries.every(
    e => e.mapping.dateCol !== null && e.mapping.descCol !== null && e.mapping.amountCol !== null,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">Map columns</h2>
        <p className="text-sm text-zinc-500 mt-0.5">
          Drag each CSV column to its field. Mappings are saved per account for future imports.
        </p>
      </div>

      {localEntries.map((entry, i) => (
        <FileMappingCard
          key={entry.accountId}
          entry={entry}
          onChange={m => updateMapping(i, m)}
        />
      ))}

      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={onBack} disabled={loading}>
          Back
        </Button>
        <Button onClick={() => onConfirm(localEntries)} disabled={!allMapped || loading}>
          {loading ? 'Loading…' : 'Confirm mapping'}
        </Button>
        {!allMapped && (
          <span className="text-xs text-zinc-500">All three fields must be assigned</span>
        )}
      </div>
    </div>
  );
}
