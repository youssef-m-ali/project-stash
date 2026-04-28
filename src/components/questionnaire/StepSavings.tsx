'use client';

import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import type { BudgetState, SavingsBucket } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { FieldError } from '@/components/ui/FieldError';

const bucketSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Required'),
  percentageOfSavings: z.coerce.number().min(0).max(100, 'Max 100%'),
  notes: z.string().optional(),
});

const schema = z.object({
  targetRatePct: z.coerce.number().min(10).max(80),
  buckets: z.array(bucketSchema),
}).superRefine((val, ctx) => {
  const total = val.buckets.reduce((s, b) => s + (Number(b.percentageOfSavings) || 0), 0);
  if (val.buckets.length > 0 && Math.abs(total - 100) > 0.5) {
    ctx.addIssue({ code: 'custom', path: ['buckets'], message: `Bucket %s must sum to 100% (currently ${Math.round(total)}%)` });
  }
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

interface Props {
  draft: Partial<BudgetState>;
  onNext: (slice: Partial<BudgetState>) => void;
  onBack: () => void;
}

function defaultBuckets(): SavingsBucket[] {
  return [{ id: uuid(), name: 'General savings', percentageOfSavings: 100 }];
}

export function StepSavings({ draft, onNext, onBack }: Props) {
  const existingGoal = draft.savingsGoal;
  const incomePerPaycheck = draft.income?.netPerPaycheck ?? 0;

  const { register, control, handleSubmit, formState: { errors } } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      targetRatePct: Math.round((existingGoal?.targetRate ?? 0.3) * 100),
      buckets: existingGoal?.buckets?.length ? existingGoal.buckets.map((b) => ({
        ...b, percentageOfSavings: Math.round(b.percentageOfSavings * 100),
      })) : defaultBuckets(),
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'buckets' });
  const watchedRate = useWatch({ control, name: 'targetRatePct' });
  const watchedBuckets = useWatch({ control, name: 'buckets' });

  const monthlyIncome = incomePerPaycheck * 26 / 12;
  const monthlySavings = monthlyIncome * (Number(watchedRate) / 100);

  const bucketTotal = watchedBuckets?.reduce(
    (s, b) => s + (Number(b.percentageOfSavings) || 0), 0,
  ) ?? 0;

  function onSubmit(values: FormOutput) {
    onNext({
      savingsGoal: {
        targetRate: values.targetRatePct / 100,
        buckets: values.buckets.map((b) => ({
          ...b,
          percentageOfSavings: Number(b.percentageOfSavings) / 100,
        })),
      },
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Savings goal</h2>
        <p className="mt-1 text-sm text-zinc-500">Set your target savings rate and name your buckets.</p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="targetRatePct">Target savings rate</Label>
          <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tabular-nums">
            {Number(watchedRate ?? 30)}%
          </span>
        </div>
        <input
          id="targetRatePct"
          type="range"
          min={10}
          max={80}
          step={1}
          className="w-full accent-zinc-900 dark:accent-zinc-100"
          {...register('targetRatePct')}
        />
        <div className="flex justify-between text-xs text-zinc-400">
          <span>10%</span>
          <span>80%</span>
        </div>
        {incomePerPaycheck > 0 && (
          <p className="text-sm text-zinc-500">
            ≈ <span className="font-medium text-zinc-700 dark:text-zinc-300">${Math.round(monthlySavings).toLocaleString()}</span> / month
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Label>Savings buckets</Label>
          <span className={`text-xs font-medium ${Math.abs(bucketTotal - 100) < 0.5 ? 'text-emerald-600' : 'text-red-500'}`}>
            {Math.round(bucketTotal)}% allocated
          </span>
        </div>

        {errors.buckets && !Array.isArray(errors.buckets) && (
          <FieldError message={(errors.buckets as { message?: string }).message} />
        )}

        <div className="hidden md:grid grid-cols-[1fr_90px_32px] gap-2 text-xs font-medium text-zinc-400 uppercase tracking-wide">
          <span>Bucket name</span>
          <span>% of savings</span>
          <span></span>
        </div>

        {fields.map((field, i) => {
          const rowErrors = errors.buckets?.[i] as Record<string, { message?: string }> | undefined;
          const pctVal = Number(watchedBuckets?.[i]?.percentageOfSavings ?? 0);
          const bucketDollars = incomePerPaycheck > 0
            ? Math.round(monthlySavings * pctVal / 100)
            : null;
          return (
            <div key={field.id} className="flex flex-col md:grid md:grid-cols-[1fr_90px_32px] gap-2 items-start md:items-center">
              <div>
                <Input
                  placeholder="e.g. TFSA, Roth IRA, House fund"
                  error={rowErrors?.name?.message}
                  {...register(`buckets.${i}.name`)}
                />
                <FieldError message={rowErrors?.name?.message} />
              </div>
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  placeholder="0"
                  error={rowErrors?.percentageOfSavings?.message}
                  {...register(`buckets.${i}.percentageOfSavings`)}
                />
                {bucketDollars !== null && (
                  <span className="absolute -bottom-4 left-0 text-xs text-zinc-400">
                    ~${bucketDollars.toLocaleString()}/mo
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-zinc-400 hover:text-red-500 transition-colors text-lg leading-none self-center"
                aria-label="Remove bucket"
              >
                ×
              </button>
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => append({ id: uuid(), name: '', percentageOfSavings: 0 })}
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors self-start mt-6"
        >
          + Add bucket
        </button>
      </div>

      <div className="flex justify-between pt-2">
        <Button type="button" variant="secondary" onClick={onBack}>Back</Button>
        <Button type="submit">Next</Button>
      </div>
    </form>
  );
}
