'use client';

import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import type { BudgetState, FixedExpense } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { FieldError } from '@/components/ui/FieldError';
import { Select } from '@/components/ui/Select';

const rowSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Required'),
  amount: z.coerce.number().min(0, 'Must be ≥ 0'),
  dueDayOfMonth: z.coerce.number().int().min(1).max(31),
  category: z.enum(['housing', 'utilities', 'transport', 'insurance', 'subscription', 'other']),
  skip: z.boolean().optional(),
});

const schema = z.object({ rows: z.array(rowSchema) });
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

const CATEGORIES = [
  { value: 'housing', label: 'Housing' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'transport', label: 'Transport' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'subscription', label: 'Subscription' },
  { value: 'other', label: 'Other' },
] as const;

const DEFAULTS: Omit<FixedExpense, 'id'>[] = [
  { name: 'Rent / mortgage', amount: 0, dueDayOfMonth: 1, category: 'housing' },
  { name: 'Utilities', amount: 0, dueDayOfMonth: 15, category: 'utilities' },
  { name: 'Phone', amount: 0, dueDayOfMonth: 20, category: 'utilities' },
  { name: 'Internet', amount: 0, dueDayOfMonth: 20, category: 'utilities' },
  { name: 'Car payment', amount: 0, dueDayOfMonth: 1, category: 'transport' },
  { name: 'Car insurance', amount: 0, dueDayOfMonth: 10, category: 'insurance' },
];

interface Props {
  draft: Partial<BudgetState>;
  onNext: (slice: Partial<BudgetState>) => void;
  onBack: () => void;
}

export function StepFixed({ draft, onNext, onBack }: Props) {
  const existing = draft.fixedExpenses ?? [];
  const initialRows = existing.length
    ? existing.map((e) => ({ ...e, skip: false }))
    : DEFAULTS.map((d) => ({ ...d, id: uuid(), skip: false }));

  const { register, control, handleSubmit, formState: { errors } } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { rows: initialRows },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'rows' });

  function onSubmit(values: FormOutput) {
    const kept = values.rows
      .filter((r) => !r.skip && r.amount > 0)
      .map(({ skip: _skip, ...rest }) => rest as FixedExpense);
    onNext({ fixedExpenses: kept });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Fixed expenses</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Monthly bills with a predictable amount and due date. Leave amount at 0 and check
          &ldquo;Skip&rdquo; for items that don&apos;t apply.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {/* Header */}
        <div className="hidden md:grid grid-cols-[1fr_100px_60px_130px_32px] gap-2 text-xs font-medium text-zinc-400 uppercase tracking-wide">
          <span>Name</span>
          <span>Monthly ($)</span>
          <span>Due day</span>
          <span>Category</span>
          <span></span>
        </div>

        {fields.map((field, i) => {
          const rowErrors = errors.rows?.[i];
          return (
            <div key={field.id} className="flex flex-col md:grid md:grid-cols-[1fr_100px_60px_130px_32px] gap-2 items-start md:items-center p-3 md:p-0 rounded-lg md:rounded-none border md:border-0 border-zinc-100 dark:border-zinc-800">
              <div>
                <Input
                  placeholder="Name"
                  error={rowErrors?.name?.message}
                  {...register(`rows.${i}.name`)}
                />
                <FieldError message={rowErrors?.name?.message} />
              </div>
              <div>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  error={rowErrors?.amount?.message}
                  {...register(`rows.${i}.amount`)}
                />
                <FieldError message={rowErrors?.amount?.message} />
              </div>
              <div>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  placeholder="1"
                  {...register(`rows.${i}.dueDayOfMonth`)}
                />
              </div>
              <div>
                <Select {...register(`rows.${i}.category`)}>
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </Select>
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-zinc-400 hover:text-red-500 transition-colors text-lg leading-none self-center"
                aria-label="Remove row"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => append({ id: uuid(), name: '', amount: 0, dueDayOfMonth: 1, category: 'other', skip: false })}
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors self-start"
      >
        + Add another
      </button>

      <div className="flex justify-between pt-2">
        <Button type="button" variant="secondary" onClick={onBack}>Back</Button>
        <Button type="submit">Next</Button>
      </div>
    </form>
  );
}
