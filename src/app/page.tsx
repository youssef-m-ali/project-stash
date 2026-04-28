'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { localStorageAdapter } from '@/lib/storage/localStorage';

export default function WelcomePage() {
  const [hasSavedState, setHasSavedState] = useState(false);

  useEffect(() => {
    setHasSavedState(localStorageAdapter.loadState() !== null);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <main className="w-full max-w-lg flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Project Stash
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Build a 6-month budget plan on your biweekly paycheck. Set a savings
            target, track fixed bills, and see exactly which paycheck covers what.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {hasSavedState ? (
            <>
              <Link
                href="/dashboard"
                className="flex h-12 items-center justify-center rounded-lg bg-zinc-900 dark:bg-zinc-50 px-6 text-base font-medium text-white dark:text-zinc-900 transition-colors hover:bg-zinc-700 dark:hover:bg-zinc-200"
              >
                Continue to dashboard
              </Link>
              <Link
                href="/setup"
                className="flex h-12 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 px-6 text-base font-medium text-zinc-700 dark:text-zinc-300 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900"
              >
                Start questionnaire
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/setup"
                className="flex h-12 items-center justify-center rounded-lg bg-zinc-900 dark:bg-zinc-50 px-6 text-base font-medium text-white dark:text-zinc-900 transition-colors hover:bg-zinc-700 dark:hover:bg-zinc-200"
              >
                Start questionnaire
              </Link>
              <Link
                href="/setup?sample=1"
                className="flex h-12 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 px-6 text-base font-medium text-zinc-700 dark:text-zinc-300 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900"
              >
                Try with sample data
              </Link>
            </>
          )}
        </div>

        <p className="text-sm text-zinc-400 dark:text-zinc-600 text-center">
          100% local — your data never leaves your device.
        </p>
      </main>
    </div>
  );
}
