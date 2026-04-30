'use client';

import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import type { BudgetState, Bucket } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { FieldError } from '@/components/ui/FieldError';

const PRESET_COLORS = [
  { value: '#10b981', label: 'Green' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#ef4444', label: 'Red' },
  { value: '#6b7280', label: 'Gray' },
];

const DEFAULT_BUCKETS: Omit<Bucket, 'sortOrder'>[] = [
  { id: uuid(), name: 'Groceries',      amountPerPaycheck: 300, color: '#10b981' },
  { id: uuid(), name: 'Dining Out',     amountPerPaycheck: 150, color: '#f59e0b' },
  { id: uuid(), name: 'Gas',            amountPerPaycheck: 100, color: '#3b82f6' },
  { id: uuid(), name: 'Entertainment',  amountPerPaycheck: 80,  color: '#8b5cf6' },
  { id: uuid(), name: 'Utilities',      amountPerPaycheck: 200, color: '#6b7280' },
  { id: uuid(), name: 'Savings',        amountPerPaycheck: 800, color: '#22c55e' },
];

const bucketSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Required'),
  amountPerPaycheck: z.coerce.number().min(0, 'Must be 0 or more'),
  color: z.string().default('#6b7280'),
});

const schema = z.object({
  buckets: z.array(bucketSchema).min(1, 'Add at least one bucket'),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

interface Props {
  draft: Partial<BudgetState>;
  onNext: (slice: Partial<BudgetState>) => void;
  onBack: () => void;
}

export function StepBuckets({ draft, onNext, onBack }: Props) {
  const existing = draft.buckets ?? [];

  const { register, control, handleSubmit, watch, formState: { errors } } =
    useForm<FormInput, unknown, FormOutput>({
      resolver: zodResolver(schema),
      defaultValues: {
        buckets: existing.length
          ? existing
          : DEFAULT_BUCKETS.map((b, i) => ({ ...b, sortOrder: i })),
      },
    });

  const { fields, append, remove } = useFieldArray({ control, name: 'buckets' });
  const watchedBuckets = watch('buckets');
  const totalPerPaycheck = watchedBuckets?.reduce(
    (sum, b) => sum + (Number(b.amountPerPaycheck) || 0),
    0,
  ) ?? 0;

  const netPerPaycheck = draft.income?.netPerPaycheck ?? 0;
  const remainder = netPerPaycheck - totalPerPaycheck;

  function onSubmit(values: FormOutput) {
    const buckets: Bucket[] = values.buckets.map((b, i) => ({
      id: b.id,
      name: b.name,
      amountPerPaycheck: b.amountPerPaycheck,
      color: b.color,
      sortOrder: i,
    }));
    onNext({ buckets });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-100">Spending buckets</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Define your spending categories and how much you plan to spend in each per paycheck.
          You can always add, remove, or adjust these later.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {fields.length > 0 && (
          <div className="hidden md:grid grid-cols-[1fr_120px_140px_32px] gap-3 text-xs font-medium text-zinc-400 uppercase tracking-wide">
            <span>Bucket name</span>
            <span>$/paycheck</span>
            <span>Color</span>
            <span />
          </div>
        )}

        {fields.map((field, i) => {
          const rowErrors = errors.buckets?.[i];
          return (
            <div
              key={field.id}
              className="flex flex-col md:grid md:grid-cols-[1fr_120px_140px_32px] gap-3 items-start md:items-center p-3 md:p-0 rounded-lg md:rounded-none border md:border-0 border-zinc-600/50"
            >
              <div>
                <Label className="md:hidden mb-1">Name</Label>
                <Input
                  placeholder="e.g. Groceries"
                  error={rowErrors?.name?.message}
                  {...register(`buckets.${i}.name`)}
                />
                <FieldError message={rowErrors?.name?.message} />
              </div>

              <div>
                <Label className="md:hidden mb-1">$/paycheck</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  error={rowErrors?.amountPerPaycheck?.message}
                  {...register(`buckets.${i}.amountPerPaycheck`)}
                />
                <FieldError message={rowErrors?.amountPerPaycheck?.message} />
              </div>

              <div className="flex gap-1.5 flex-wrap">
                {PRESET_COLORS.map(c => (
                  <label key={c.value} className="relative cursor-pointer" title={c.label}>
                    <input
                      type="radio"
                      value={c.value}
                      className="sr-only"
                      {...register(`buckets.${i}.color`)}
                    />
                    <div
                      className="w-6 h-6 rounded-full border-2 transition-all"
                      style={{
                        backgroundColor: c.value,
                        borderColor: watchedBuckets?.[i]?.color === c.value
                          ? 'white'
                          : 'transparent',
                      }}
                    />
                  </label>
                ))}
              </div>

              <button
                type="button"
                onClick={() => remove(i)}
                className="text-zinc-400 hover:text-red-400 transition-colors text-lg leading-none self-center"
                aria-label="Remove bucket"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => append({ id: uuid(), name: '', amountPerPaycheck: 0, color: '#6b7280' })}
        className="text-sm text-zinc-500 hover:text-zinc-100 transition-colors self-start"
      >
        + Add bucket
      </button>

      {/* Totals footer */}
      {netPerPaycheck > 0 && (
        <div className="rounded-lg border border-zinc-600 bg-zinc-800/60 p-3 text-sm flex justify-between items-center">
          <span className="text-zinc-400">Total planned per paycheck</span>
          <span className={`font-medium tabular-nums ${remainder < 0 ? 'text-red-400' : 'text-zinc-200'}`}>
            ${totalPerPaycheck.toFixed(0)} / ${netPerPaycheck.toFixed(0)}
            <span className="ml-2 text-xs text-zinc-500">
              ({remainder >= 0 ? `$${remainder.toFixed(0)} unallocated` : `$${Math.abs(remainder).toFixed(0)} over`})
            </span>
          </span>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button type="button" variant="secondary" onClick={onBack}>Back</Button>
        <Button type="submit">Next</Button>
      </div>
    </form>
  );
}
