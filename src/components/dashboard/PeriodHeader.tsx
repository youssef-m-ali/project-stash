'use client';

import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import type { PaycheckPeriod } from '@/lib/types';

interface Props {
  period: PaycheckPeriod;
  pendingCount: number;
  totalSpent: number;
  totalPlanned: number;
}

function fmt(iso: string) {
  return format(parseISO(iso), 'MMM d, yyyy');
}

export function PeriodHeader({ period, pendingCount, totalSpent, totalPlanned }: Props) {
  const remainder = totalPlanned - totalSpent;

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-800/60 p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
      <div>
        <p className="text-xs text-zinc-500 uppercase tracking-wide font-medium">Current period</p>
        <h2 className="text-lg font-semibold text-zinc-100">
          {fmt(period.startDate)} – {fmt(period.endDate)}
        </h2>
        <p className="text-sm text-zinc-400 mt-0.5">
          Net: <span className="text-zinc-200 font-medium">${period.paycheckAmount.toLocaleString()}</span>
        </p>
      </div>

      <div className="flex flex-col sm:items-end gap-1">
        {pendingCount > 0 ? (
          <Link
            href="/review"
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 px-3 py-1.5 text-sm font-medium hover:bg-amber-500/20 transition-colors"
          >
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-black text-xs font-bold">
              {pendingCount > 99 ? '99+' : pendingCount}
            </span>
            pending
          </Link>
        ) : (
          <span className="text-sm text-emerald-400 font-medium">All caught up ✓</span>
        )}
        <p className="text-xs text-zinc-500 tabular-nums">
          ${totalSpent.toFixed(0)} spent · ${Math.abs(remainder).toFixed(0)} {remainder >= 0 ? 'remaining' : 'over'}
        </p>
      </div>
    </div>
  );
}
