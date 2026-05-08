import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PeriodHeader } from '@/components/dashboard/PeriodHeader';
import { BucketFillRow } from '@/components/dashboard/BucketFillRow';
import { BucketTransactionsPanel } from '@/components/dashboard/BucketTransactionsPanel';
import { getDashboard } from '@/lib/db/queries/dashboard';
import type { BucketFill, DashboardData } from '@/lib/types';

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null | 'loading'>('loading');
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [activeBucket, setActiveBucket] = useState<BucketFill | null>(null);

  const fetchDashboard = useCallback((periodId: string | null) => {
    setData('loading');
    getDashboard(periodId ?? undefined)
      .then(setData)
      .catch(() => setData(null));
  }, []);

  useEffect(() => {
    fetchDashboard(selectedPeriodId);
    setActiveBucket(null);
  }, [selectedPeriodId, fetchDashboard]);

  if (data === 'loading') {
    return <div className="text-zinc-500 text-sm">Loading…</div>;
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <p className="text-zinc-400">No paycheck period found.</p>
        <p className="text-sm text-zinc-500">
          Make sure your income is set up correctly in{' '}
          <Link to="/settings" className="text-zinc-300 underline underline-offset-2">Settings</Link>.
        </p>
      </div>
    );
  }

  const { period, buckets, pendingCount, totalSpent, totalPlanned, prevPeriodStart, nextPeriodStart, currentPeriodStart } = data;
  const isOpen = activeBucket !== null;

  return (
    <div
      className="flex flex-col gap-6 mx-auto"
      style={{ maxWidth: isOpen ? '64rem' : '42rem', transition: 'max-width 300ms ease-in-out' }}
    >
      <PeriodHeader
        period={period}
        pendingCount={pendingCount}
        totalSpent={totalSpent}
        totalPlanned={totalPlanned}
        isCurrentPeriod={period.startDate === currentPeriodStart}
        onPrev={() => setSelectedPeriodId(prevPeriodStart)}
        onNext={() => setSelectedPeriodId(nextPeriodStart)}
        onBackToCurrent={() => setSelectedPeriodId(null)}
      />

      <div className="flex gap-4 items-stretch" style={{ maxHeight: isOpen ? 'calc(100vh - 200px)' : undefined }}>
        <div className="flex-1 min-w-0 rounded-xl border border-zinc-700 bg-zinc-800/40 px-4 overflow-y-auto">
          {buckets.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-zinc-500 text-sm">No buckets configured.</p>
              <Link to="/settings" className="text-sm text-zinc-300 underline underline-offset-2 mt-1 inline-block">
                Add buckets in Settings
              </Link>
            </div>
          ) : (
            buckets.map(b => (
              <BucketFillRow
                key={b.id}
                bucket={b}
                selected={activeBucket?.id === b.id}
                onClick={() => setActiveBucket(prev => prev?.id === b.id ? null : b)}
              />
            ))
          )}
        </div>

        <div
          className="shrink-0 rounded-xl border border-zinc-700 bg-zinc-800/40 overflow-hidden flex flex-col"
          style={{ width: isOpen ? '28rem' : '0px', opacity: isOpen ? 1 : 0, transition: 'width 300ms ease-in-out, opacity 200ms ease-in-out', borderColor: isOpen ? undefined : 'transparent' }}
        >
          {activeBucket && (
            <BucketTransactionsPanel
              bucket={activeBucket}
              periodId={period.id}
              startDate={period.startDate}
              endDate={period.endDate}
              onClose={() => setActiveBucket(null)}
            />
          )}
        </div>
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
