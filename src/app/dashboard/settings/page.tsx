'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBudget } from '@/lib/context/BudgetContext';
import type { BudgetState } from '@/lib/types';

export default function SettingsPage() {
  const { state, reload } = useBudget();
  const router = useRouter();
  const [currency, setCurrency] = useState(state.currency);
  const [currencySaving, setCurrencySaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function saveCurrency() {
    if (currency === state.currency || currency.trim() === '') return;
    setCurrencySaving(true);
    await fetch('/api/budget', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...state, currency }),
    });
    await reload();
    setCurrencySaving(false);
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stashup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportError(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text) as BudgetState;
      const res = await fetch('/api/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('rejected');
      await reload();
    } catch {
      setImportError('Could not import — file may be invalid or corrupted.');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  }

  async function startOver() {
    await fetch('/api/budget', { method: 'DELETE' });
    router.replace('/');
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Settings</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Currency, backup, and budget configuration.</p>
      </div>

      {/* Currency */}
      <section className="bg-zinc-700 rounded-xl border border-zinc-600 p-5 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-zinc-300">Currency symbol</h2>
        <div className="flex items-center gap-3">
          <input
            className="bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-zinc-100 w-20 focus:outline-none focus:border-zinc-400 transition-colors"
            value={currency}
            maxLength={6}
            onChange={(e) => setCurrency(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveCurrency()}
          />
          <button
            disabled={currencySaving || currency === state.currency || currency.trim() === ''}
            onClick={saveCurrency}
            className="px-4 py-2 bg-zinc-600 text-zinc-100 text-sm rounded-lg hover:bg-zinc-500 disabled:opacity-40 transition-colors"
          >
            {currencySaving ? 'Saving…' : 'Save'}
          </button>
        </div>
        <p className="text-xs text-zinc-500">
          Displayed as a prefix on all amounts, e.g.{' '}
          <span className="text-zinc-400">{currency || '$'}1,200</span>.
        </p>
      </section>

      {/* Edit budget */}
      <section className="bg-zinc-700 rounded-xl border border-zinc-600 p-5 flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-zinc-300">Edit budget</h2>
        <p className="text-xs text-zinc-500">
          Re-run the setup wizard to change income, fixed expenses, subscriptions, or your savings goal.
        </p>
        <a
          href="/setup"
          className="text-sm text-center text-zinc-300 border border-zinc-600 rounded-lg px-3 py-2 hover:bg-zinc-600 transition-colors"
        >
          Open setup wizard →
        </a>
      </section>

      {/* Backup & restore */}
      <section className="bg-zinc-700 rounded-xl border border-zinc-600 p-5 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-zinc-300">Backup &amp; restore</h2>
        <div className="flex gap-3">
          <button
            onClick={exportJSON}
            className="flex-1 px-4 py-2 bg-zinc-600 text-zinc-100 text-sm rounded-lg hover:bg-zinc-500 transition-colors"
          >
            Export JSON
          </button>
          <button
            disabled={importing}
            onClick={() => fileRef.current?.click()}
            className="flex-1 px-4 py-2 bg-zinc-600 text-zinc-100 text-sm rounded-lg hover:bg-zinc-500 disabled:opacity-40 transition-colors"
          >
            {importing ? 'Importing…' : 'Import JSON'}
          </button>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImport} />
        </div>
        {importError && <p className="text-xs text-red-400">{importError}</p>}
        <p className="text-xs text-zinc-500">
          Export saves your full budget as a JSON file. Import overwrites current data — export first if you want a backup.
        </p>
      </section>

      {/* Danger zone */}
      <section className="bg-zinc-700 rounded-xl border border-red-900/40 p-5 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-zinc-300">Danger zone</h2>
        {confirmReset ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-zinc-300">This will permanently delete all budget data. Are you sure?</p>
            <div className="flex gap-3">
              <button
                onClick={startOver}
                className="px-4 py-2 bg-red-800 text-red-100 text-sm rounded-lg hover:bg-red-700 transition-colors"
              >
                Yes, delete everything
              </button>
              <button
                onClick={() => setConfirmReset(false)}
                className="px-4 py-2 bg-zinc-600 text-zinc-100 text-sm rounded-lg hover:bg-zinc-500 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmReset(true)}
            className="w-fit px-4 py-2 border border-red-800/60 text-red-400 text-sm rounded-lg hover:bg-red-900/20 transition-colors"
          >
            Start over
          </button>
        )}
        <p className="text-xs text-zinc-500">
          Wipes all data from the local database. Export first to keep a backup.
        </p>
      </section>
    </div>
  );
}
