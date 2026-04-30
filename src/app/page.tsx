'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(data => {
        if (data !== null) {
          router.replace('/dashboard');
        }
        // else: stay on page (show welcome)
      })
      .catch(() => { /* stay on page */ });
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <main className="w-full max-w-lg flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-100">Stash Up</h1>
          <p className="text-lg text-zinc-400 leading-relaxed">
            Upload your weekly bank CSVs, approve transactions into spending buckets,
            and watch your per-paycheck plan fill up in real time.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/setup"
            className="flex h-12 items-center justify-center rounded-lg bg-zinc-100 px-6 text-base font-medium text-zinc-900 transition-colors hover:bg-white"
          >
            Get started
          </Link>
        </div>

        <p className="text-sm text-zinc-500 text-center">
          100% local — your data never leaves your device.
        </p>
      </main>
    </div>
  );
}
