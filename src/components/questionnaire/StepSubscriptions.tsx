'use client';

import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import type { BudgetState } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FieldError } from '@/components/ui/FieldError';

const rowSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Required'),
  monthlyAmount: z.coerce.number().min(0, 'Must be ≥ 0'),
  dueDayOfMonth: z.coerce.number().int().min(1).max(31).default(1),
  usedRecently: z.boolean(),
  markedForCancel: z.boolean(),
});

const schema = z.object({ rows: z.array(rowSchema) });
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

interface Props {
  draft: Partial<BudgetState>;
  onNext: (slice: Partial<BudgetState>) => void;
  onBack: () => void;
}

export function StepSubscriptions({ draft, onNext, onBack }: Props) {
  const existing = draft.subscriptions ?? [];
  const initialRows = existing.length
    ? existing
    : [{ id: uuid(), name: '', monthlyAmount: 0, dueDayOfMonth: 1, usedRecently: true, markedForCancel: false }];

  const { register, control, handleSubmit, formState: { errors } } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { rows: initialRows },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'rows' });

  function onSubmit(values: FormOutput) {
    const kept = values.rows.filter((r) => r.monthlyAmount > 0 && r.name.trim().length > 0);
    onNext({ subscriptions: kept });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-100">Subscriptions</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Pull your last 90 days of bank/card statements to catch recurring charges. Most
          people miss 2–3. Leave rows empty to skip.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="hidden md:grid grid-cols-[1fr_110px_auto_auto_32px] gap-2 text-xs font-medium text-zinc-400 uppercase tracking-wide">
          <span>Service</span>
          <span>Monthly ($)</span>
          <span>Used lately?</span>
          <span>Cancel?</span>
          <span></span>
        </div>

        {fields.map((field, i) => {
          const rowErrors = errors.rows?.[i];
          return (
            <div key={field.id} className="flex flex-col md:grid md:grid-cols-[1fr_110px_auto_auto_32px] gap-2 items-start md:items-center p-3 md:p-0 rounded-lg md:rounded-none border md:border-0 border-zinc-600/50">
              <div>
                <Input
                  placeholder="e.g. Netflix, Spotify"
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
                  error={rowErrors?.monthlyAmount?.message}
                  {...register(`rows.${i}.monthlyAmount`)}
                />
                <FieldError message={rowErrors?.monthlyAmount?.message} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
                <input type="checkbox" className="rounded accent-zinc-700" {...register(`rows.${i}.usedRecently`)} />
                <span className="text-sm text-zinc-400">Used lately</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
                <input type="checkbox" className="rounded accent-red-500" {...register(`rows.${i}.markedForCancel`)} />
                <span className="text-sm text-zinc-400">Cancel</span>
              </label>
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
        onClick={() => append({ id: uuid(), name: '', monthlyAmount: 0, usedRecently: true, markedForCancel: false })}
        className="text-sm text-zinc-500 hover:text-zinc-100 transition-colors self-start"
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
