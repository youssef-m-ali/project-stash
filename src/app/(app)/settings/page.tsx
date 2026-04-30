'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuid } from 'uuid';
import { useAppContext } from '@/lib/context/AppContext';
import type { Bucket, MerchantMemory } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';

const PRESET_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#6b7280', '#22c55e'];

// ── Buckets section ────────────────────────────────────────────────────────────

function BucketsSection({ initialBuckets }: { initialBuckets: Bucket[] }) {
  const [buckets, setBuckets] = useState<Bucket[]>(initialBuckets);
  const [saving, setSaving] = useState(false);

  function updateBucket(id: string, patch: Partial<Bucket>) {
    setBuckets(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b));
  }

  function addBucket() {
    setBuckets(prev => [
      ...prev,
      { id: uuid(), name: '', amountPerPaycheck: 0, color: '#6b7280', sortOrder: prev.length },
    ]);
  }

  function removeBucket(id: string) {
    setBuckets(prev => prev.filter(b => b.id !== id));
  }

  async function save() {
    setSaving(true);
    // Delete all + re-insert via config POST (simpler than diffing)
    const configRes = await fetch('/api/config').then(r => r.json());
    if (!configRes) { setSaving(false); return; }
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...configRes, buckets: buckets.map((b, i) => ({ ...b, sortOrder: i })) }),
    });
    setSaving(false);
  }

  const total = buckets.reduce((s, b) => s + (Number(b.amountPerPaycheck) || 0), 0);

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-zinc-100 border-b border-zinc-700 pb-2">Buckets</h2>

      {buckets.map((b, i) => (
        <div key={b.id} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <Input
            className="flex-1"
            placeholder="Bucket name"
            value={b.name}
            onChange={e => updateBucket(b.id, { name: e.target.value })}
          />
          <div className="flex items-center gap-1">
            <span className="text-zinc-500 text-sm">$</span>
            <Input
              type="number"
              min="0"
              className="w-24"
              placeholder="0"
              value={b.amountPerPaycheck}
              onChange={e => updateBucket(b.id, { amountPerPaycheck: Number(e.target.value) })}
            />
          </div>
          <div className="flex gap-1">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => updateBucket(b.id, { color: c })}
                className="w-5 h-5 rounded-full border-2 transition-all"
                style={{
                  backgroundColor: c,
                  borderColor: b.color === c ? 'white' : 'transparent',
                }}
                title={c}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => removeBucket(b.id)}
            className="text-zinc-500 hover:text-red-400 transition-colors text-lg"
            aria-label="Remove"
          >×</button>
          <span className="text-xs text-zinc-600">{i}</span>
        </div>
      ))}

      <button
        type="button"
        onClick={addBucket}
        className="text-sm text-zinc-500 hover:text-zinc-100 transition-colors self-start"
      >
        + Add bucket
      </button>

      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-500">Total: <span className="text-zinc-300 font-medium tabular-nums">${total.toFixed(0)}</span>/paycheck</span>
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save buckets'}
        </Button>
      </div>
    </section>
  );
}

// ── Income section ─────────────────────────────────────────────────────────────

function IncomeSection({ initialNet, initialDate }: { initialNet: number; initialDate: string }) {
  const [netPerPaycheck, setNetPerPaycheck] = useState(String(initialNet));
  const [firstPaycheckDate, setFirstPaycheckDate] = useState(initialDate);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const configRes = await fetch('/api/config').then(r => r.json());
    if (!configRes) { setSaving(false); return; }
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...configRes,
        income: { netPerPaycheck: Number(netPerPaycheck), firstPaycheckDate, frequency: 'biweekly' },
      }),
    });
    // Regenerate periods
    await fetch('/api/periods/regenerate', { method: 'POST' });
    setSaving(false);
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-zinc-100 border-b border-zinc-700 pb-2">Income</h2>
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex flex-col gap-1.5 flex-1">
          <Label htmlFor="net">Net per paycheck ($)</Label>
          <Input
            id="net"
            type="number"
            min="0"
            value={netPerPaycheck}
            onChange={e => setNetPerPaycheck(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5 flex-1">
          <Label htmlFor="date">First paycheck date</Label>
          <Input
            id="date"
            type="date"
            value={firstPaycheckDate}
            onChange={e => setFirstPaycheckDate(e.target.value)}
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save income'}
        </Button>
      </div>
    </section>
  );
}

// ── Merchant memory section ────────────────────────────────────────────────────

function MerchantMemorySection() {
  const [entries, setEntries] = useState<MerchantMemory[]>([]);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/merchant-memory').then(r => r.json()),
      fetch('/api/buckets').then(r => r.json()),
    ]).then(([memData, bucketData]) => {
      setEntries(memData.entries ?? []);
      setBuckets(bucketData.buckets ?? []);
    }).finally(() => setLoading(false));
  }, []);

  function bucketName(id: string) {
    return buckets.find(b => b.id === id)?.name ?? id;
  }

  async function forget(key: string) {
    await fetch(`/api/merchant-memory/${encodeURIComponent(key)}`, { method: 'DELETE' });
    setEntries(prev => prev.filter(e => e.merchantKey !== key));
  }

  if (loading) return null;
  if (entries.length === 0) return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-zinc-100 border-b border-zinc-700 pb-2">Merchant Memory</h2>
      <p className="text-sm text-zinc-500">No merchant mappings saved yet. Approve transactions to build merchant memory.</p>
    </section>
  );

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-zinc-100 border-b border-zinc-700 pb-2">Merchant Memory</h2>
      <p className="text-sm text-zinc-500">{entries.length} merchant mappings saved.</p>
      <div className="rounded-xl border border-zinc-700 bg-zinc-800/40 overflow-hidden">
        {entries.map(e => (
          <div key={e.merchantKey} className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-700/50 last:border-0">
            <span className="font-mono text-sm text-zinc-300 flex-1">{e.merchantKey}</span>
            <span className="text-sm text-zinc-500">→</span>
            <span className="text-sm text-zinc-400">{bucketName(e.bucketId)}</span>
            <span className="text-xs text-zinc-600 tabular-nums w-12 text-right">{e.count}×</span>
            <button
              type="button"
              onClick={() => forget(e.merchantKey)}
              className="text-zinc-600 hover:text-red-400 transition-colors text-sm"
              aria-label="Forget"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Danger zone ────────────────────────────────────────────────────────────────

function DangerZone() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  async function handleReset() {
    await fetch('/api/config', { method: 'DELETE' });
    router.push('/setup');
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-red-400 border-b border-zinc-700 pb-2">Danger zone</h2>
      {!confirming ? (
        <Button variant="secondary" onClick={() => setConfirming(true)} className="self-start border-red-800 text-red-400 hover:bg-red-900/20">
          Reset everything
        </Button>
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-red-800 bg-red-900/10 p-4">
          <p className="text-sm text-red-300">
            This will delete all data: transactions, buckets, accounts, merchant memory, and paycheck periods.
            This cannot be undone.
          </p>
          <div className="flex gap-3">
            <Button onClick={handleReset} className="bg-red-700 hover:bg-red-600">
              Yes, delete everything
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </section>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { config, isLoading } = useAppContext();

  if (isLoading || !config) return null;

  return (
    <div className="flex flex-col gap-10 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Settings</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Manage your income, buckets, and account settings.</p>
      </div>

      <IncomeSection
        initialNet={config.income.netPerPaycheck}
        initialDate={config.income.firstPaycheckDate}
      />

      <BucketsSection initialBuckets={config.buckets} />

      <MerchantMemorySection />

      <DangerZone />
    </div>
  );
}
