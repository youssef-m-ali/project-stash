'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { BudgetState } from '@/lib/types';
import { StepIncome } from '@/components/questionnaire/StepIncome';
import { StepFixedExpenses } from '@/components/questionnaire/StepFixedExpenses';
import { StepBuckets } from '@/components/questionnaire/StepBuckets';
import { StepAccounts } from '@/components/questionnaire/StepAccounts';

const STEP_LABELS = ['Income', 'Fixed expenses', 'Buckets', 'Accounts'];
const TOTAL_STEPS = STEP_LABELS.length;

function buildInitialDraft(): Partial<BudgetState> {
  return { schemaVersion: 4, currency: '$', accounts: [], buckets: [], fixedExpenses: [] };
}

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Partial<BudgetState>>(buildInitialDraft);

  function mergeDraft(slice: Partial<BudgetState>) {
    setDraft(prev => ({ ...prev, ...slice }));
  }

  function handleNext(slice: Partial<BudgetState>) {
    mergeDraft(slice);
    setStep(s => s + 1);
  }

  function handleBack() {
    setStep(s => Math.max(0, s - 1));
  }

  async function handleFinish(slice: Partial<BudgetState>) {
    const final = { ...draft, ...slice } as BudgetState;

    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(final),
    });

    await fetch('/api/periods/regenerate', { method: 'POST' });

    router.push('/dashboard');
  }

  const stepProps = { draft, onBack: handleBack };

  return (
    <div className="min-h-screen flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-2xl flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-zinc-100">Stash Up</h1>
          <p className="text-sm text-zinc-500">Set up your budget in {TOTAL_STEPS} quick steps.</p>
        </div>

        {/* Progress */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Step {step + 1} of {TOTAL_STEPS}</span>
            <span>{STEP_LABELS[step]}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-zinc-600">
            <div
              className="h-1.5 rounded-full bg-zinc-100 transition-all duration-300"
              style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
            />
          </div>
          <div className="flex gap-1">
            {STEP_LABELS.map((label, i) => (
              <div
                key={label}
                className={`flex-1 text-center text-[10px] font-medium truncate px-0.5 transition-colors ${
                  i === step ? 'text-zinc-100' : i < step ? 'text-zinc-500' : 'text-zinc-600'
                }`}
              >
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="bg-zinc-700 rounded-xl border border-zinc-600 p-6 md:p-8">
          {step === 0 && <StepIncome      {...stepProps} onNext={handleNext} />}
          {step === 1 && <StepFixedExpenses {...stepProps} onNext={handleNext} />}
          {step === 2 && <StepBuckets     {...stepProps} onNext={handleNext} />}
          {step === 3 && <StepAccounts    {...stepProps} onNext={handleFinish} />}
        </div>

        <p className="text-center text-xs text-zinc-600">
          100% local — your data never leaves your device.
        </p>
      </div>
    </div>
  );
}
