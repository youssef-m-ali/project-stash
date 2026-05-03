'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuid } from 'uuid';
import { useAppContext } from '@/lib/context/AppContext';
import type { Account, Bucket, FixedExpense, MerchantMemory } from '@/lib/types';
import { Select } from '@/components/ui/Select';
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
      { id: uuid(), name: '', amountPerPaycheck: 0, color: '#6b7280', emoji: null, sortOrder: prev.length },
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

  const total = buckets
    .filter(b => !b.isSpecial)
    .reduce((s, b) => s + (Number(b.amountPerPaycheck) || 0), 0);

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-zinc-100 border-b border-zinc-700 pb-2">Buckets</h2>

      {buckets.map((b, i) => b.isSpecial ? (
        <div key={b.id} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center opacity-70">
          <span className="w-10 text-center text-base shrink-0 py-2">🔒</span>
          <Input
            className="flex-1"
            value={b.name}
            disabled
            readOnly
          />
          <div className="flex items-center gap-1">
            <span className="text-zinc-500 text-sm">$</span>
            <Input
              className="w-36 text-zinc-500 italic text-xs"
              value=""
              placeholder="Calculated automatically"
              disabled
              readOnly
            />
          </div>
          <span className="text-xs text-zinc-600 ml-auto sm:ml-0">system</span>
        </div>
      ) : (
        <div key={b.id} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <input
            type="text"
            maxLength={8}
            placeholder="🏷"
            value={b.emoji ?? ''}
            onChange={e => updateBucket(b.id, { emoji: e.target.value || null })}
            className="w-10 text-center bg-zinc-700 border border-zinc-600 rounded-lg px-1 py-2 text-base focus:outline-none focus:border-zinc-400 shrink-0"
            title="Emoji (optional)"
          />
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

// ── Fixed expenses section ────────────────────────────────────────────────────

function FixedExpensesSection({ initialExpenses }: { initialExpenses: FixedExpense[] }) {
  const [expenses, setExpenses] = useState<FixedExpense[]>(initialExpenses);
  const [saving, setSaving] = useState(false);

  function update(id: string, patch: Partial<FixedExpense>) {
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
  }

  function add() {
    setExpenses(prev => [...prev, { id: uuid(), name: '', amount: 0, dueDayOfMonth: 1, emoji: null, sortOrder: prev.length }]);
  }

  function remove(id: string) {
    setExpenses(prev => prev.filter(e => e.id !== id));
  }

  async function save() {
    setSaving(true);
    const configRes = await fetch('/api/config').then(r => r.json());
    if (!configRes) { setSaving(false); return; }
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...configRes, fixedExpenses: expenses.map((e, i) => ({ ...e, sortOrder: i })) }),
    });
    setSaving(false);
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-zinc-100 border-b border-zinc-700 pb-2">Fixed Expenses</h2>

      {expenses.length > 0 && (
        <div className="hidden sm:grid sm:grid-cols-[40px_1fr_120px_90px_24px] gap-3 text-xs font-medium text-zinc-500 uppercase tracking-wide px-1">
          <span>Icon</span><span>Name</span><span>Amount</span><span>Due day</span><span />
        </div>
      )}

      {expenses.map(e => (
        <div key={e.id} className="grid grid-cols-[40px_1fr_120px_90px_24px] gap-3 items-center">
          <input
            type="text"
            maxLength={8}
            placeholder="🏷"
            value={e.emoji ?? ''}
            onChange={ev => update(e.id, { emoji: ev.target.value || null })}
            className="w-10 text-center bg-zinc-700 border border-zinc-600 rounded-lg px-1 py-2 text-base focus:outline-none focus:border-zinc-400"
          />
          <Input
            placeholder="e.g. Rent"
            value={e.name}
            onChange={ev => update(e.id, { name: ev.target.value })}
          />
          <div className="flex items-center gap-1">
            <span className="text-zinc-500 text-sm">$</span>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="0"
              value={e.amount}
              onChange={ev => update(e.id, { amount: Number(ev.target.value) })}
            />
          </div>
          <Input
            type="number"
            min="1"
            max="31"
            placeholder="1"
            value={e.dueDayOfMonth}
            onChange={ev => update(e.id, { dueDayOfMonth: Number(ev.target.value) })}
          />
          <button
            type="button"
            onClick={() => remove(e.id)}
            className="text-zinc-500 hover:text-red-400 transition-colors text-lg leading-none"
            aria-label="Remove"
          >×</button>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        className="text-sm text-zinc-500 hover:text-zinc-100 transition-colors self-start"
      >
        + Add expense
      </button>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save expenses'}</Button>
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

// ── Accounts section ───────────────────────────────────────────────────────────

function AccountsSection({ initialAccounts }: { initialAccounts: Account[] }) {
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [saving, setSaving] = useState(false);

  function updateAccount(id: string, patch: Partial<Account>) {
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));
  }

  function addAccount() {
    setAccounts(prev => [
      ...prev,
      { id: uuid(), label: '', kind: 'chequing' },
    ]);
  }

  function removeAccount(id: string) {
    setAccounts(prev => prev.filter(a => a.id !== id));
  }

  async function save() {
    setSaving(true);
    const configRes = await fetch('/api/config').then(r => r.json());
    if (!configRes) { setSaving(false); return; }
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...configRes, accounts }),
    });
    setSaving(false);
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-zinc-100 border-b border-zinc-700 pb-2">Accounts</h2>

      {accounts.length === 0 && (
        <p className="text-sm text-zinc-500">No accounts yet.</p>
      )}

      {accounts.map(a => (
        <div key={a.id} className="grid grid-cols-[1fr_160px_24px] gap-3 items-center">
          <Input
            placeholder="Label (e.g. Main chequing)"
            value={a.label}
            onChange={e => updateAccount(a.id, { label: e.target.value })}
          />
          <Select
            value={a.kind}
            onChange={e => updateAccount(a.id, { kind: e.target.value as Account['kind'] })}
          >
            <option value="chequing">Chequing</option>
            <option value="credit-card">Credit card</option>
          </Select>
          <button
            type="button"
            onClick={() => removeAccount(a.id)}
            className="text-zinc-500 hover:text-red-400 transition-colors text-lg leading-none"
            aria-label="Remove"
          >×</button>
        </div>
      ))}

      <button
        type="button"
        onClick={addAccount}
        className="text-sm text-zinc-500 hover:text-zinc-100 transition-colors self-start"
      >
        + Add account
      </button>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save accounts'}
        </Button>
      </div>
    </section>
  );
}

// ── Merchant memory section ────────────────────────────────────────────────────

function MerchantMemorySection() {
  const [entries, setEntries] = useState<MerchantMemory[]>([]);
  const [exemptions, setExemptions] = useState<{ merchantKey: string }[]>([]);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [remapModal, setRemapModal] = useState<{ merchantKey: string; newBucketId: string } | null>(null);
  const [remapping, setRemapping] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/merchant-memory').then(r => r.json()),
      fetch('/api/merchant-exemptions').then(r => r.json()),
      fetch('/api/buckets').then(r => r.json()),
    ]).then(([memData, exemptData, bucketData]) => {
      setEntries(memData.entries ?? []);
      setExemptions(exemptData.exemptions ?? []);
      setBuckets(bucketData.buckets ?? []);
    }).finally(() => setLoading(false));
  }, []);

  const exemptKeys = new Set(exemptions.map(e => e.merchantKey));
  const activeEntries = entries.filter(e => !exemptKeys.has(e.merchantKey));

  async function forget(key: string) {
    await fetch(`/api/merchant-memory/${encodeURIComponent(key)}`, { method: 'DELETE' });
    setEntries(prev => prev.filter(e => e.merchantKey !== key));
  }

  async function exempt(key: string) {
    await fetch('/api/merchant-exemptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchantKey: key }),
    });
    setExemptions(prev => [...prev, { merchantKey: key }]);
  }

  async function removeExemption(key: string) {
    await fetch(`/api/merchant-exemptions/${encodeURIComponent(key)}`, { method: 'DELETE' });
    setExemptions(prev => prev.filter(e => e.merchantKey !== key));
  }

  async function applyRemap(updateHistorical: boolean) {
    if (!remapModal) return;
    setRemapping(true);
    await fetch(`/api/merchant-memory/${encodeURIComponent(remapModal.merchantKey)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucketId: remapModal.newBucketId, updateHistorical }),
    });
    setEntries(prev => prev.map(e =>
      e.merchantKey === remapModal.merchantKey ? { ...e, bucketId: remapModal.newBucketId } : e,
    ));
    setRemapping(false);
    setRemapModal(null);
  }

  if (loading) return null;

  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold text-zinc-100 border-b border-zinc-700 pb-2">Merchant Memory</h2>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-zinc-400">Learned mappings</h3>
        {activeEntries.length === 0 ? (
          <p className="text-sm text-zinc-500">No active mappings. Approve transactions to build merchant memory.</p>
        ) : (
          <div className="rounded-xl border border-zinc-700 bg-zinc-800/40 overflow-hidden">
            {activeEntries.map(e => (
              <div key={e.merchantKey} className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-700/50 last:border-0">
                <span className="font-mono text-sm text-zinc-300 flex-1">{e.merchantKey}</span>
                <span className="text-sm text-zinc-500">→</span>
                <div className="relative">
                  <select
                    value={e.bucketId}
                    onChange={ev => setRemapModal({ merchantKey: e.merchantKey, newBucketId: ev.target.value })}
                    className="text-xs bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-zinc-300 focus:outline-none focus:border-zinc-400"
                  >
                    {buckets.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.emoji ? `${b.emoji} ${b.name}` : b.name}
                      </option>
                    ))}
                  </select>

                  {remapModal?.merchantKey === e.merchantKey && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => !remapping && setRemapModal(null)} />
                      <div className="absolute top-full left-0 mt-2 z-50 w-56 bg-zinc-900 border border-zinc-700/60 rounded-2xl shadow-lg shadow-black/30 p-3 flex flex-col gap-2.5">
                        <div className="absolute -top-1.5 left-4 w-3 h-3 bg-zinc-900 border-l border-t border-zinc-700/60 rotate-45" />
                        <p className="text-xs text-zinc-400 leading-snug">Apply this change to future transactions, or historical ones too?</p>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            disabled={remapping}
                            onClick={() => applyRemap(false)}
                            className="flex-1 text-xs py-1.5 px-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors disabled:opacity-50"
                          >
                            Future only
                          </button>
                          <button
                            type="button"
                            disabled={remapping}
                            onClick={() => applyRemap(true)}
                            className="flex-1 text-xs py-1.5 px-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors disabled:opacity-50"
                          >
                            Future + history
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <span className="text-xs text-zinc-600 tabular-nums w-10 text-right">{e.count}×</span>
                <button
                  type="button"
                  onClick={() => exempt(e.merchantKey)}
                  className="text-xs text-zinc-500 hover:text-amber-400 transition-colors px-2 py-0.5 rounded border border-zinc-700 hover:border-amber-500/50"
                  title="Stop auto-classifying this merchant"
                >
                  Exempt
                </button>
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
        )}
      </div>


      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-zinc-400">Exemptions</h3>
        {exemptions.length === 0 ? (
          <p className="text-sm text-zinc-500">No exemptions. Exempt a merchant to stop it from being auto-classified.</p>
        ) : (
          <div className="rounded-xl border border-zinc-700 bg-zinc-800/40 overflow-hidden">
            {exemptions.map(e => (
              <div key={e.merchantKey} className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-700/50 last:border-0">
                <span className="font-mono text-sm text-zinc-300 flex-1">{e.merchantKey}</span>
                <span className="text-xs text-zinc-500 bg-zinc-700/60 px-2 py-0.5 rounded">exempt</span>
                <button
                  type="button"
                  onClick={() => removeExemption(e.merchantKey)}
                  className="text-zinc-600 hover:text-red-400 transition-colors text-sm"
                  aria-label="Remove exemption"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
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

const TABS = ['Income', 'Fixed Expenses', 'Buckets', 'Accounts', 'Merchant Memory', 'Danger Zone'] as const;
type Tab = typeof TABS[number];

export default function SettingsPage() {
  const { config, isLoading } = useAppContext();
  const [tab, setTab] = useState<Tab>('Income');

  if (isLoading || !config) return null;

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Settings</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Manage your income, buckets, accounts, and other settings.</p>
      </div>

      <div className="flex gap-1 border-b border-zinc-700">
        {TABS.map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
              tab === t
                ? 'text-zinc-100 border-b-2 border-zinc-100 -mb-px'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Income' && (
        <IncomeSection
          initialNet={config.income.netPerPaycheck}
          initialDate={config.income.firstPaycheckDate}
        />
      )}
      {tab === 'Fixed Expenses' && <FixedExpensesSection initialExpenses={config.fixedExpenses} />}
      {tab === 'Buckets'        && <BucketsSection initialBuckets={config.buckets} />}
      {tab === 'Accounts'       && <AccountsSection initialAccounts={config.accounts} />}
      {tab === 'Merchant Memory' && <MerchantMemorySection />}
      {tab === 'Danger Zone'    && <DangerZone />}
    </div>
  );
}
