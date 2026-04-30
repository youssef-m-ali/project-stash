'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PeriodHeader } from '@/components/dashboard/PeriodHeader';
import { BucketFillRow } from '@/components/dashboard/BucketFillRow';
import type { DashboardData } from '@/lib/types';

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null | 'loading'>('loading');

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (data === 'loading') {
    return <div className="text-zinc-500 text-sm">Loading…</div>;
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <p className="text-zinc-400">No paycheck period found.</p>
        <p className="text-sm text-zinc-500">
          Make sure your income is set up correctly in{' '}
          <Link href="/settings" className="text-zinc-300 underline underline-offset-2">Settings</Link>.
        </p>
      </div>
    );
  }

  const { period, buckets, pendingCount, totalSpent, totalPlanned } = data;

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <PeriodHeader
        period={period}
        pendingCount={pendingCount}
        totalSpent={totalSpent}
        totalPlanned={totalPlanned}
      />

      <div className="rounded-xl border border-zinc-700 bg-zinc-800/40 px-4">
        {buckets.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-zinc-500 text-sm">No buckets configured.</p>
            <Link href="/settings" className="text-sm text-zinc-300 underline underline-offset-2 mt-1 inline-block">
              Add buckets in Settings
            </Link>
          </div>
        ) : (
          buckets.map(b => <BucketFillRow key={b.id} bucket={b} />)
        )}
      </div>

      {buckets.length > 0 && (
        <div className="flex justify-between text-sm text-zinc-500 px-1">
          <span>Total spent</span>
          <span className="tabular-nums text-zinc-300 font-medium">
            ${totalSpent.toFixed(0)} <span className="text-zinc-500 font-normal">of ${totalPlanned.toFixed(0)} planned</span>
          </span>
        </div>
      )}
    </div>
  );
}
