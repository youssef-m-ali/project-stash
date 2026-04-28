'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { storageAdapter } from '@/lib/storage/sqliteAdapter';

export default function WelcomePage() {
  const [hasSavedState, setHasSavedState] = useState(false);

  useEffect(() => {
    storageAdapter.loadState().then((s) => setHasSavedState(s !== null));
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <main className="w-full max-w-lg flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-100">
            Stash Up
          </h1>
          <p className="text-lg text-zinc-400 leading-relaxed">
            Build a 6-month budget plan on your biweekly paycheck. Set a savings
            target, track fixed bills, and see exactly which paycheck covers what.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {hasSavedState ? (
            <>
              <Link
                href="/dashboard"
                className="flex h-12 items-center justify-center rounded-lg bg-zinc-100 px-6 text-base font-medium text-zinc-900 transition-colors hover:bg-white"
              >
                Continue to dashboard
              </Link>
              <Link
                href="/setup"
                className="flex h-12 items-center justify-center rounded-lg border border-zinc-600 px-6 text-base font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
              >
                Start questionnaire
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/setup"
                className="flex h-12 items-center justify-center rounded-lg bg-zinc-100 px-6 text-base font-medium text-zinc-900 transition-colors hover:bg-white"
              >
                Start questionnaire
              </Link>
              <Link
                href="/setup?sample=1"
                className="flex h-12 items-center justify-center rounded-lg border border-zinc-600 px-6 text-base font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
              >
                Try with sample data
              </Link>
            </>
          )}
        </div>

        <p className="text-sm text-zinc-500 text-center">
          100% local — your data never leaves your device.
        </p>
      </main>
    </div>
  );
}
