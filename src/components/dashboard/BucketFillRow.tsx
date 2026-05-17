

import type { BucketFill } from '@/lib/types';

interface Props {
  bucket: BucketFill;
  onClick?: () => void;
  selected?: boolean;
}

export function BucketFillRow({ bucket, onClick, selected }: Props) {
  const { name, color, emoji, spent, planned, pct } = bucket;
  const isOver = spent > planned;
  const isFull = planned > 0 && spent >= planned;
  const displayPct = Math.min(pct, 1);

  return (
    <div
      className={`flex flex-col gap-1.5 py-3 border-b border-zinc-700/60 last:border-0 -mx-4 px-4 rounded-lg transition-colors ${onClick ? 'cursor-pointer' : ''} ${selected ? 'bg-zinc-700/40' : onClick ? 'hover:bg-zinc-700/20' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          {emoji ? (
            <span className="text-base leading-none shrink-0">{emoji}</span>
          ) : (
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
          )}
          <span className="text-sm font-medium text-zinc-200 truncate">{name}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0 text-sm tabular-nums">
          <span className={isOver ? 'text-red-400 font-medium' : 'text-zinc-300'}>
            ${spent.toFixed(0)}
          </span>
          <span className="text-zinc-600">/</span>
          <span className="text-zinc-500">${planned.toFixed(0)}</span>

          {isFull && !isOver && (
            <span className="text-xs text-emerald-400 font-medium">✓</span>
          )}
          {isOver && (
            <span className="text-xs text-red-400 font-semibold uppercase">OVER</span>
          )}
          {!isFull && !isOver && (
            <span className="text-xs text-zinc-500 w-9 text-right">
              {Math.round(pct * 100)}%
            </span>
          )}
        </div>
      </div>

      <div className="h-2 w-full rounded-full bg-zinc-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${isOver ? 'bg-red-500' : ''}`}
          style={{
            width: `${displayPct * 100}%`,
            backgroundColor: isOver ? undefined : color,
          }}
        />
      </div>
    </div>
  );
}
