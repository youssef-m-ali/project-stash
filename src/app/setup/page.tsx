'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { BudgetState } from '@/lib/types';
import { localStorageAdapter } from '@/lib/storage/localStorage';
import { StepIncome } from '@/components/questionnaire/StepIncome';
import { StepFixed } from '@/components/questionnaire/StepFixed';
import { StepVariable } from '@/components/questionnaire/StepVariable';
import { StepSubscriptions } from '@/components/questionnaire/StepSubscriptions';
import { StepSavings } from '@/components/questionnaire/StepSavings';
import { StepReview } from '@/components/questionnaire/StepReview';
import { sampleBudgetState } from '@/lib/budget/sampleData';

const STEP_LABELS = [
  'Income',
  'Fixed expenses',
  'Variable expenses',
  'Subscriptions',
  'Savings goal',
  'Review',
];

const TOTAL_STEPS = STEP_LABELS.length;

function buildInitialDraft(): Partial<BudgetState> {
  return {
    schemaVersion: 1,
    currency: '$',
    fixedExpenses: [],
    variableExpenses: [],
    subscriptions: [],
    savingsGoal: { targetRate: 0.3, buckets: [] },
  };
}

export default function SetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Partial<BudgetState>>(buildInitialDraft);

  useEffect(() => {
    if (searchParams.get('sample') === '1') {
      const s = sampleBudgetState();
      localStorageAdapter.saveState(s);
      router.replace('/dashboard');
    }
  }, [searchParams, router]);

  function mergeDraft(slice: Partial<BudgetState>) {
    setDraft((prev) => ({ ...prev, ...slice }));
  }

  function handleNext(slice: Partial<BudgetState>) {
    mergeDraft(slice);
    setStep((s) => s + 1);
  }

  function handleBack() {
    setStep((s) => Math.max(0, s - 1));
  }

  function handleFinish(slice: Partial<BudgetState>) {
    const final = { ...draft, ...slice } as BudgetState;
    final.createdAt = new Date().toISOString();
    final.updatedAt = new Date().toISOString();
    localStorageAdapter.saveState(final);
    router.push('/dashboard');
  }

  const stepProps = { draft, onBack: handleBack };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-2xl flex flex-col gap-8">
        {/* Progress */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Step {step + 1} of {TOTAL_STEPS}</span>
            <span>{STEP_LABELS[step]}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className="h-1.5 rounded-full bg-zinc-900 dark:bg-zinc-100 transition-all duration-300"
              style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
            />
          </div>
          <div className="flex gap-1">
            {STEP_LABELS.map((label, i) => (
              <div
                key={label}
                className={`flex-1 text-center text-[10px] font-medium truncate px-0.5 transition-colors ${
                  i === step
                    ? 'text-zinc-900 dark:text-zinc-100'
                    : i < step
                    ? 'text-zinc-500'
                    : 'text-zinc-300 dark:text-zinc-700'
                }`}
              >
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 md:p-8">
          {step === 0 && <StepIncome {...stepProps} onNext={handleNext} />}
          {step === 1 && <StepFixed {...stepProps} onNext={handleNext} />}
          {step === 2 && <StepVariable {...stepProps} onNext={handleNext} />}
          {step === 3 && <StepSubscriptions {...stepProps} onNext={handleNext} />}
          {step === 4 && <StepSavings {...stepProps} onNext={handleNext} />}
          {step === 5 && <StepReview {...stepProps} onFinish={handleFinish} />}
        </div>
      </div>
    </div>
  );
}
