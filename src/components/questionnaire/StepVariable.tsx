'use client';

import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import type { BudgetState, VariableExpense } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FieldError } from '@/components/ui/FieldError';

const rowSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Required'),
  monthlyBudget: z.coerce.number().min(0, 'Must be ≥ 0'),
  isCap: z.boolean(),
});

const schema = z.object({ rows: z.array(rowSchema) });
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

const DEFAULTS: VariableExpense[] = [
  { id: uuid(), name: 'Groceries', monthlyBudget: 0, isCap: false },
  { id: uuid(), name: 'Dining out', monthlyBudget: 0, isCap: true },
  { id: uuid(), name: 'Coffee', monthlyBudget: 0, isCap: false },
  { id: uuid(), name: 'Entertainment', monthlyBudget: 0, isCap: false },
  { id: uuid(), name: 'Personal care', monthlyBudget: 0, isCap: false },
  { id: uuid(), name: 'Gas', monthlyBudget: 0, isCap: false },
  { id: uuid(), name: 'Buffer', monthlyBudget: 0, isCap: false },
];

interface Props {
  draft: Partial<BudgetState>;
  onNext: (slice: Partial<BudgetState>) => void;
  onBack: () => void;
}

export function StepVariable({ draft, onNext, onBack }: Props) {
  const existing = draft.variableExpenses ?? [];
  const initialRows = existing.length ? existing : DEFAULTS;

  const { register, control, handleSubmit, formState: { errors } } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { rows: initialRows },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'rows' });

  function onSubmit(values: FormOutput) {
    const kept = values.rows.filter((r) => r.monthlyBudget > 0) as VariableExpense[];
    onNext({ variableExpenses: kept });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Variable expenses</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Set a monthly budget for each category. Leave at 0 to skip. &ldquo;Hard cap&rdquo; means
          you&apos;ll treat it as a strict limit rather than a soft target.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="hidden md:grid grid-cols-[1fr_110px_auto_32px] gap-2 text-xs font-medium text-zinc-400 uppercase tracking-wide">
          <span>Category</span>
          <span>Monthly ($)</span>
          <span>Hard cap?</span>
          <span></span>
        </div>

        {fields.map((field, i) => {
          const rowErrors = errors.rows?.[i];
          return (
            <div key={field.id} className="flex flex-col md:grid md:grid-cols-[1fr_110px_auto_32px] gap-2 items-start md:items-center p-3 md:p-0 rounded-lg md:rounded-none border md:border-0 border-zinc-100 dark:border-zinc-800">
              <div>
                <Input
                  placeholder="Category name"
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
                  error={rowErrors?.monthlyBudget?.message}
                  {...register(`rows.${i}.monthlyBudget`)}
                />
                <FieldError message={rowErrors?.monthlyBudget?.message} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  className="rounded accent-zinc-700"
                  {...register(`rows.${i}.isCap`)}
                />
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Hard cap</span>
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
        onClick={() => append({ id: uuid(), name: '', monthlyBudget: 0, isCap: false })}
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
