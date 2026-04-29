'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getDay, parseISO } from 'date-fns';
import { useBudget } from '@/lib/context/BudgetContext';
import type { BudgetState, FixedExpense, VariableExpense, Subscription, SavingsBucket } from '@/lib/types';

// ── Utilities ─────────────────────────────────────────────────────────────────

function uid() {
  return crypto.randomUUID().slice(0, 12);
}

function fmt(n: number, currency: string) {
  return `${currency}${Math.round(n).toLocaleString()}`;
}

async function post(state: BudgetState) {
  await fetch('/api/budget', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  });
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const cx = {
  input:
    'bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:border-zinc-400 transition-colors w-full',
  btnSave:
    'text-xs px-3 py-1 bg-zinc-600 text-zinc-100 rounded hover:bg-zinc-500 transition-colors disabled:opacity-40',
  btnCancel: 'text-xs px-2 py-1 text-zinc-500 hover:text-zinc-200 transition-colors',
  btnEdit: 'text-xs text-zinc-500 hover:text-zinc-200 transition-colors px-1.5 py-1',
  btnDel: 'text-xs text-zinc-600 hover:text-red-400 transition-colors px-1.5 py-1',
  btnAdd:
    'text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-600 rounded px-2 py-1 transition-colors',
};

// ── Section shell ─────────────────────────────────────────────────────────────

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-zinc-700 rounded-xl border border-zinc-600 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-600 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-300">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

// Wraps an inline edit form with Save / Cancel buttons
function FormShell({
  children,
  onSave,
  onCancel,
  saving,
  canSave,
}: {
  children: React.ReactNode;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  canSave: boolean;
}) {
  return (
    <div className="px-4 py-3 bg-zinc-800/50 border-b border-zinc-600/50 last:border-0 flex flex-col gap-2">
      {children}
      <div className="flex gap-2 pt-1">
        <button disabled={!canSave || saving} onClick={onSave} className={cx.btnSave}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={onCancel} className={cx.btnCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Income ────────────────────────────────────────────────────────────────────

function IncomeSection({ state, reload }: { state: BudgetState; reload: () => void }) {
  const [net, setNet] = useState(String(state.income.netPerPaycheck));
  const [date, setDate] = useState(state.income.firstPaycheckDate);
  const [saving, setSaving] = useState(false);

  const dirty =
    net !== String(state.income.netPerPaycheck) || date !== state.income.firstPaycheckDate;

  async function save() {
    const n = parseFloat(net);
    if (!n || n <= 0) return;
    setSaving(true);
    await post({
      ...state,
      income: {
        ...state.income,
        netPerPaycheck: n,
        firstPaycheckDate: date,
        payDayOfWeek: getDay(parseISO(date)) as 0 | 1 | 2 | 3 | 4 | 5 | 6,
      },
    });
    await reload();
    setSaving(false);
  }

  return (
    <Section title="Income">
      <div className="px-4 py-4 flex flex-col gap-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Net per paycheck</label>
            <input
              type="number"
              className={cx.input}
              value={net}
              min={0}
              onChange={(e) => setNet(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">First paycheck date</label>
            <input
              type="date"
              className={cx.input}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
        <button disabled={!dirty || saving} onClick={save} className={`${cx.btnSave} w-fit`}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Section>
  );
}

// ── Fixed Expenses ────────────────────────────────────────────────────────────

const FIXED_CATS = [
  'housing',
  'utilities',
  'transport',
  'insurance',
  'subscription',
  'other',
] as const;

function FixedFields({
  form,
  onChange,
}: {
  form: Partial<FixedExpense>;
  onChange: (f: Partial<FixedExpense>) => void;
}) {
  return (
    <div className="grid sm:grid-cols-4 gap-2">
      <input
        className={cx.input}
        placeholder="Name"
        value={form.name ?? ''}
        onChange={(e) => onChange({ ...form, name: e.target.value })}
      />
      <input
        type="number"
        className={cx.input}
        placeholder="Amount"
        value={form.amount ?? ''}
        min={0}
        onChange={(e) => onChange({ ...form, amount: parseFloat(e.target.value) || 0 })}
      />
      <input
        type="number"
        className={cx.input}
        placeholder="Due day"
        value={form.dueDayOfMonth ?? ''}
        min={1}
        max={31}
        onChange={(e) => onChange({ ...form, dueDayOfMonth: parseInt(e.target.value) || 1 })}
      />
      <select
        className={cx.input}
        value={form.category ?? 'other'}
        onChange={(e) =>
          onChange({ ...form, category: e.target.value as FixedExpense['category'] })
        }
      >
        {FIXED_CATS.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </div>
  );
}

function FixedSection({ state, reload }: { state: BudgetState; reload: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<FixedExpense>>({});
  const [saving, setSaving] = useState(false);

  function startAdd() {
    setEditingId('__new__');
    setForm({ id: uid(), name: '', amount: 0, dueDayOfMonth: 1, category: 'other' });
  }

  async function commit() {
    const updated =
      editingId === '__new__'
        ? [...state.fixedExpenses, form as FixedExpense]
        : state.fixedExpenses.map((i) =>
            i.id === editingId ? ({ ...i, ...form } as FixedExpense) : i,
          );
    setSaving(true);
    await post({ ...state, fixedExpenses: updated });
    await reload();
    setEditingId(null);
    setSaving(false);
  }

  async function remove(id: string) {
    await post({ ...state, fixedExpenses: state.fixedExpenses.filter((i) => i.id !== id) });
    await reload();
  }

  const canSave = !!form.name?.trim() && (form.amount ?? 0) >= 0;

  return (
    <Section
      title="Fixed Expenses"
      action={
        <button onClick={startAdd} className={cx.btnAdd}>
          + Add
        </button>
      }
    >
      {state.fixedExpenses.length === 0 && editingId !== '__new__' && (
        <p className="px-4 py-4 text-sm text-zinc-500">No fixed expenses.</p>
      )}

      {state.fixedExpenses.map((item) =>
        editingId === item.id ? (
          <FormShell
            key={item.id}
            onSave={commit}
            onCancel={() => setEditingId(null)}
            saving={saving}
            canSave={canSave}
          >
            <FixedFields form={form} onChange={setForm} />
          </FormShell>
        ) : (
          <div
            key={item.id}
            className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-2.5 border-b border-zinc-600/50 last:border-0 items-center"
          >
            <div className="min-w-0">
              <span className="text-sm text-zinc-100">{item.name}</span>
              <span className="text-xs text-zinc-500 ml-2">
                {item.category} · due {item.dueDayOfMonth}
              </span>
            </div>
            <span className="text-sm text-zinc-300 tabular-nums">
              {fmt(item.amount, state.currency)}
            </span>
            <div className="flex">
              <button
                onClick={() => {
                  setEditingId(item.id);
                  setForm({ ...item });
                }}
                className={cx.btnEdit}
              >
                Edit
              </button>
              <button onClick={() => remove(item.id)} className={cx.btnDel}>
                ×
              </button>
            </div>
          </div>
        ),
      )}

      {editingId === '__new__' && (
        <FormShell
          onSave={commit}
          onCancel={() => setEditingId(null)}
          saving={saving}
          canSave={canSave}
        >
          <FixedFields form={form} onChange={setForm} />
        </FormShell>
      )}
    </Section>
  );
}

// ── Variable Expenses ─────────────────────────────────────────────────────────

function VarFields({
  form,
  onChange,
}: {
  form: Partial<VariableExpense>;
  onChange: (f: Partial<VariableExpense>) => void;
}) {
  return (
    <div className="grid sm:grid-cols-3 gap-2 items-center">
      <input
        className={cx.input}
        placeholder="Name"
        value={form.name ?? ''}
        onChange={(e) => onChange({ ...form, name: e.target.value })}
      />
      <input
        type="number"
        className={cx.input}
        placeholder="Monthly budget"
        value={form.monthlyBudget ?? ''}
        min={0}
        onChange={(e) => onChange({ ...form, monthlyBudget: parseFloat(e.target.value) || 0 })}
      />
      <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
        <input
          type="checkbox"
          checked={form.isCap ?? false}
          onChange={(e) => onChange({ ...form, isCap: e.target.checked })}
          className="w-4 h-4 accent-zinc-400"
        />
        Hard cap
      </label>
    </div>
  );
}

function VarSection({ state, reload }: { state: BudgetState; reload: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<VariableExpense>>({});
  const [saving, setSaving] = useState(false);

  function startAdd() {
    setEditingId('__new__');
    setForm({ id: uid(), name: '', monthlyBudget: 0, isCap: false });
  }

  async function commit() {
    const updated =
      editingId === '__new__'
        ? [...state.variableExpenses, form as VariableExpense]
        : state.variableExpenses.map((i) =>
            i.id === editingId ? ({ ...i, ...form } as VariableExpense) : i,
          );
    setSaving(true);
    await post({ ...state, variableExpenses: updated });
    await reload();
    setEditingId(null);
    setSaving(false);
  }

  async function remove(id: string) {
    await post({
      ...state,
      variableExpenses: state.variableExpenses.filter((i) => i.id !== id),
    });
    await reload();
  }

  const canSave = !!form.name?.trim() && (form.monthlyBudget ?? 0) >= 0;

  return (
    <Section
      title="Variable Expenses"
      action={
        <button onClick={startAdd} className={cx.btnAdd}>
          + Add
        </button>
      }
    >
      {state.variableExpenses.length === 0 && editingId !== '__new__' && (
        <p className="px-4 py-4 text-sm text-zinc-500">No variable expenses.</p>
      )}

      {state.variableExpenses.map((item) =>
        editingId === item.id ? (
          <FormShell
            key={item.id}
            onSave={commit}
            onCancel={() => setEditingId(null)}
            saving={saving}
            canSave={canSave}
          >
            <VarFields form={form} onChange={setForm} />
          </FormShell>
        ) : (
          <div
            key={item.id}
            className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-2.5 border-b border-zinc-600/50 last:border-0 items-center"
          >
            <div className="min-w-0">
              <span className="text-sm text-zinc-100">{item.name}</span>
              {item.isCap && <span className="text-xs text-zinc-500 ml-2">(cap)</span>}
            </div>
            <span className="text-sm text-zinc-300 tabular-nums">
              {fmt(item.monthlyBudget, state.currency)}/mo
            </span>
            <div className="flex">
              <button
                onClick={() => {
                  setEditingId(item.id);
                  setForm({ ...item });
                }}
                className={cx.btnEdit}
              >
                Edit
              </button>
              <button onClick={() => remove(item.id)} className={cx.btnDel}>
                ×
              </button>
            </div>
          </div>
        ),
      )}

      {editingId === '__new__' && (
        <FormShell
          onSave={commit}
          onCancel={() => setEditingId(null)}
          saving={saving}
          canSave={canSave}
        >
          <VarFields form={form} onChange={setForm} />
        </FormShell>
      )}
    </Section>
  );
}

// ── Subscriptions ─────────────────────────────────────────────────────────────

function SubFields({
  form,
  onChange,
}: {
  form: Partial<Subscription>;
  onChange: (f: Partial<Subscription>) => void;
}) {
  return (
    <div className="grid sm:grid-cols-4 gap-2 items-center">
      <input
        className={cx.input}
        placeholder="Name"
        value={form.name ?? ''}
        onChange={(e) => onChange({ ...form, name: e.target.value })}
      />
      <input
        type="number"
        className={cx.input}
        placeholder="Monthly amount"
        value={form.monthlyAmount ?? ''}
        min={0}
        onChange={(e) => onChange({ ...form, monthlyAmount: parseFloat(e.target.value) || 0 })}
      />
      <input
        type="number"
        className={cx.input}
        placeholder="Due day"
        value={form.dueDayOfMonth ?? ''}
        min={1}
        max={31}
        onChange={(e) => onChange({ ...form, dueDayOfMonth: parseInt(e.target.value) || 1 })}
      />
      <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
        <input
          type="checkbox"
          checked={form.usedRecently ?? true}
          onChange={(e) => onChange({ ...form, usedRecently: e.target.checked })}
          className="w-4 h-4 accent-zinc-400"
        />
        Used recently
      </label>
    </div>
  );
}

function SubsSection({ state, reload }: { state: BudgetState; reload: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Subscription>>({});
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<Set<string>>(new Set());

  const totalMonthly = state.subscriptions.reduce((s, sub) => s + sub.monthlyAmount, 0);
  const cancelledMonthly = state.subscriptions
    .filter((s) => s.markedForCancel)
    .reduce((s, sub) => s + sub.monthlyAmount, 0);

  function startAdd() {
    setEditingId('__new__');
    setForm({ id: uid(), name: '', monthlyAmount: 0, dueDayOfMonth: 1, usedRecently: true, markedForCancel: false });
  }

  async function commit() {
    const updated =
      editingId === '__new__'
        ? [...state.subscriptions, form as Subscription]
        : state.subscriptions.map((i) =>
            i.id === editingId ? ({ ...i, ...form } as Subscription) : i,
          );
    setSaving(true);
    await post({ ...state, subscriptions: updated });
    await reload();
    setEditingId(null);
    setSaving(false);
  }

  async function remove(id: string) {
    await post({ ...state, subscriptions: state.subscriptions.filter((i) => i.id !== id) });
    await reload();
  }

  async function toggleCancel(id: string, current: boolean) {
    setToggling((prev) => new Set(prev).add(id));
    await post({
      ...state,
      subscriptions: state.subscriptions.map((s) =>
        s.id === id ? { ...s, markedForCancel: !current } : s,
      ),
    });
    await reload();
    setToggling((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  const canSave = !!form.name?.trim() && (form.monthlyAmount ?? 0) >= 0;
  const title =
    state.subscriptions.length > 0
      ? `Subscriptions · ${fmt(totalMonthly, state.currency)}/mo`
      : 'Subscriptions';

  return (
    <Section
      title={title}
      action={
        <button onClick={startAdd} className={cx.btnAdd}>
          + Add
        </button>
      }
    >
      {cancelledMonthly > 0 && (
        <div className="px-4 py-2 bg-emerald-900/10 border-b border-zinc-600/50 text-xs text-emerald-400">
          Cancelling marked subs saves {fmt(cancelledMonthly, state.currency)}/mo (
          {fmt(cancelledMonthly * 12, state.currency)}/year)
        </div>
      )}

      {state.subscriptions.length === 0 && editingId !== '__new__' && (
        <p className="px-4 py-4 text-sm text-zinc-500">No subscriptions.</p>
      )}

      {state.subscriptions.map((item) =>
        editingId === item.id ? (
          <FormShell
            key={item.id}
            onSave={commit}
            onCancel={() => setEditingId(null)}
            saving={saving}
            canSave={canSave}
          >
            <SubFields form={form} onChange={setForm} />
          </FormShell>
        ) : (
          <div
            key={item.id}
            className={`grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-2.5 border-b border-zinc-600/50 last:border-0 items-center ${
              item.markedForCancel ? 'opacity-50' : ''
            } ${!item.usedRecently && !item.markedForCancel ? 'bg-amber-900/10' : ''}`}
          >
            <div className="min-w-0">
              <span
                className={`text-sm ${item.markedForCancel ? 'line-through text-zinc-500' : 'text-zinc-100'}`}
              >
                {item.name}
              </span>
              <span className="text-xs text-zinc-500 ml-2">due {item.dueDayOfMonth}</span>
              {!item.usedRecently && !item.markedForCancel && (
                <span className="text-xs text-amber-500 ml-2">unused</span>
              )}
            </div>
            <span className="text-sm text-zinc-300 tabular-nums">
              {fmt(item.monthlyAmount, state.currency)}/mo
            </span>
            <button
              disabled={toggling.has(item.id)}
              onClick={() => toggleCancel(item.id, item.markedForCancel)}
              className={`text-xs px-2 py-1 rounded border transition-colors disabled:opacity-40 ${
                item.markedForCancel
                  ? 'border-zinc-600 text-zinc-400 hover:border-zinc-400'
                  : 'border-red-800/60 text-red-400 hover:bg-red-900/20'
              }`}
            >
              {toggling.has(item.id) ? '…' : item.markedForCancel ? 'Undo' : 'Cancel'}
            </button>
            <div className="flex">
              <button
                onClick={() => {
                  setEditingId(item.id);
                  setForm({ ...item });
                }}
                className={cx.btnEdit}
              >
                Edit
              </button>
              <button onClick={() => remove(item.id)} className={cx.btnDel}>
                ×
              </button>
            </div>
          </div>
        ),
      )}

      {editingId === '__new__' && (
        <FormShell
          onSave={commit}
          onCancel={() => setEditingId(null)}
          saving={saving}
          canSave={canSave}
        >
          <SubFields form={form} onChange={setForm} />
        </FormShell>
      )}
    </Section>
  );
}

// ── Savings Goal ──────────────────────────────────────────────────────────────

function BucketFields({
  form,
  onChange,
}: {
  form: Partial<SavingsBucket>;
  onChange: (f: Partial<SavingsBucket>) => void;
}) {
  return (
    <div className="grid sm:grid-cols-3 gap-2">
      <input
        className={cx.input}
        placeholder="Name (e.g. TFSA)"
        value={form.name ?? ''}
        onChange={(e) => onChange({ ...form, name: e.target.value })}
      />
      <div className="flex items-center gap-2">
        <input
          type="number"
          className={cx.input}
          placeholder="0"
          value={
            form.percentageOfSavings != null
              ? Math.round(form.percentageOfSavings * 100)
              : ''
          }
          min={0}
          max={100}
          onChange={(e) =>
            onChange({ ...form, percentageOfSavings: (parseFloat(e.target.value) || 0) / 100 })
          }
        />
        <span className="text-sm text-zinc-400 shrink-0">%</span>
      </div>
      <input
        className={cx.input}
        placeholder="Notes (optional)"
        value={form.notes ?? ''}
        onChange={(e) => onChange({ ...form, notes: e.target.value })}
      />
    </div>
  );
}

function SavingsSection({ state, reload }: { state: BudgetState; reload: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<SavingsBucket>>({});
  const [rate, setRate] = useState(String(Math.round(state.savingsGoal.targetRate * 100)));
  const [rateSaving, setRateSaving] = useState(false);
  const [saving, setSaving] = useState(false);

  const rateDirty = rate !== String(Math.round(state.savingsGoal.targetRate * 100));
  const bucketTotal = state.savingsGoal.buckets.reduce((s, b) => s + b.percentageOfSavings, 0);
  const bucketsOk = state.savingsGoal.buckets.length === 0 || Math.abs(bucketTotal - 1) < 0.005;

  async function saveRate() {
    const n = parseFloat(rate);
    if (isNaN(n) || n < 0 || n > 100) return;
    setRateSaving(true);
    await post({ ...state, savingsGoal: { ...state.savingsGoal, targetRate: n / 100 } });
    await reload();
    setRateSaving(false);
  }

  function startAdd() {
    setEditingId('__new__');
    setForm({ id: uid(), name: '', percentageOfSavings: 0, notes: '' });
  }

  async function commit() {
    const updated =
      editingId === '__new__'
        ? [...state.savingsGoal.buckets, form as SavingsBucket]
        : state.savingsGoal.buckets.map((b) =>
            b.id === editingId ? ({ ...b, ...form } as SavingsBucket) : b,
          );
    setSaving(true);
    await post({ ...state, savingsGoal: { ...state.savingsGoal, buckets: updated } });
    await reload();
    setEditingId(null);
    setSaving(false);
  }

  async function remove(id: string) {
    await post({
      ...state,
      savingsGoal: {
        ...state.savingsGoal,
        buckets: state.savingsGoal.buckets.filter((b) => b.id !== id),
      },
    });
    await reload();
  }

  const canSave = !!form.name?.trim() && (form.percentageOfSavings ?? 0) >= 0;

  return (
    <Section
      title="Savings Goal"
      action={
        <button onClick={startAdd} className={cx.btnAdd}>
          + Bucket
        </button>
      }
    >
      {/* Target rate */}
      <div className="px-4 py-4 border-b border-zinc-600/50 flex items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Target savings rate</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              className={`${cx.input} w-20`}
              value={rate}
              min={0}
              max={100}
              onChange={(e) => setRate(e.target.value)}
            />
            <span className="text-sm text-zinc-400">%</span>
          </div>
        </div>
        <button disabled={!rateDirty || rateSaving} onClick={saveRate} className={cx.btnSave}>
          {rateSaving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {/* Bucket validation warning */}
      {!bucketsOk && (
        <div className="px-4 py-2 bg-amber-900/10 border-b border-zinc-600/50 text-xs text-amber-400">
          Buckets total {Math.round(bucketTotal * 100)}% — must equal 100%
        </div>
      )}

      {state.savingsGoal.buckets.length === 0 && editingId !== '__new__' && (
        <p className="px-4 py-3 text-sm text-zinc-500">
          No buckets. Add one to split savings across goals.
        </p>
      )}

      {state.savingsGoal.buckets.map((bucket) =>
        editingId === bucket.id ? (
          <FormShell
            key={bucket.id}
            onSave={commit}
            onCancel={() => setEditingId(null)}
            saving={saving}
            canSave={canSave}
          >
            <BucketFields form={form} onChange={setForm} />
          </FormShell>
        ) : (
          <div
            key={bucket.id}
            className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-2.5 border-b border-zinc-600/50 last:border-0 items-center"
          >
            <div className="min-w-0">
              <span className="text-sm text-zinc-100">{bucket.name}</span>
              {bucket.notes && (
                <span className="text-xs text-zinc-500 ml-2">{bucket.notes}</span>
              )}
            </div>
            <span className="text-sm text-zinc-300 tabular-nums">
              {Math.round(bucket.percentageOfSavings * 100)}%
            </span>
            <div className="flex">
              <button
                onClick={() => {
                  setEditingId(bucket.id);
                  setForm({ ...bucket });
                }}
                className={cx.btnEdit}
              >
                Edit
              </button>
              <button onClick={() => remove(bucket.id)} className={cx.btnDel}>
                ×
              </button>
            </div>
          </div>
        ),
      )}

      {editingId === '__new__' && (
        <FormShell
          onSave={commit}
          onCancel={() => setEditingId(null)}
          saving={saving}
          canSave={canSave}
        >
          <BucketFields form={form} onChange={setForm} />
        </FormShell>
      )}
    </Section>
  );
}

// ── Currency ──────────────────────────────────────────────────────────────────

function CurrencySection({ state, reload }: { state: BudgetState; reload: () => void }) {
  const [currency, setCurrency] = useState(state.currency);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!currency.trim()) return;
    setSaving(true);
    await post({ ...state, currency });
    await reload();
    setSaving(false);
  }

  return (
    <Section title="Currency">
      <div className="px-4 py-4 flex items-center gap-3">
        <input
          className={`${cx.input} w-20`}
          value={currency}
          maxLength={6}
          onChange={(e) => setCurrency(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
        <span className="text-xs text-zinc-500">
          prefix on all amounts, e.g.{' '}
          <span className="text-zinc-400">{currency || '$'}1,200</span>
        </span>
        <button
          disabled={saving || currency === state.currency || !currency.trim()}
          onClick={save}
          className={cx.btnSave}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Section>
  );
}

// ── Backup & Restore ──────────────────────────────────────────────────────────

function BackupSection({ state, reload }: { state: BudgetState; reload: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
    try {
      const data = JSON.parse(await file.text()) as BudgetState;
      const res = await fetch('/api/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      await reload();
    } catch {
      setError('Could not import — file may be invalid.');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  }

  return (
    <Section title="Backup & Restore">
      <div className="px-4 py-4 flex flex-col gap-3">
        <div className="flex gap-3">
          <button onClick={exportJSON} className={cx.btnSave}>
            Export JSON
          </button>
          <button
            disabled={importing}
            onClick={() => fileRef.current?.click()}
            className={cx.btnSave}
          >
            {importing ? 'Importing…' : 'Import JSON'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleImport}
          />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <p className="text-xs text-zinc-500">
          Export saves everything as a JSON file. Import overwrites current data.
        </p>
      </div>
    </Section>
  );
}

// ── Danger Zone ───────────────────────────────────────────────────────────────

function DangerSection() {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);

  async function startOver() {
    await fetch('/api/budget', { method: 'DELETE' });
    router.replace('/');
  }

  return (
    <Section title="Danger Zone">
      <div className="px-4 py-4 flex flex-col gap-3">
        {confirm ? (
          <>
            <p className="text-sm text-zinc-300">Delete all budget data permanently?</p>
            <div className="flex gap-3">
              <button
                onClick={startOver}
                className="text-xs px-3 py-1 bg-red-800 text-red-100 rounded hover:bg-red-700 transition-colors"
              >
                Yes, delete everything
              </button>
              <button onClick={() => setConfirm(false)} className={cx.btnSave}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={() => setConfirm(true)}
            className="text-xs w-fit px-3 py-1 border border-red-800/60 text-red-400 rounded hover:bg-red-900/20 transition-colors"
          >
            Start over
          </button>
        )}
        <p className="text-xs text-zinc-500">
          Wipes all data from the local database. Export first to keep a backup.
        </p>
      </div>
    </Section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { state, reload } = useBudget();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Settings</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Edit your budget inputs, subscriptions, and preferences.
        </p>
      </div>
      <IncomeSection state={state} reload={reload} />
      <FixedSection state={state} reload={reload} />
      <VarSection state={state} reload={reload} />
      <SubsSection state={state} reload={reload} />
      <SavingsSection state={state} reload={reload} />
      <CurrencySection state={state} reload={reload} />
      <BackupSection state={state} reload={reload} />
      <DangerSection />
    </div>
  );
}
