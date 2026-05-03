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

const DEFAULT_FIXED: Omit<FixedExpense, 'sortOrder'>[] = [
  { id: uuid(), name: 'Rent / Mortgage', amount: 1200, dueDayOfMonth: 1,  emoji: '🏠' },
  { id: uuid(), name: 'Electricity',     amount: 80,   dueDayOfMonth: 15, emoji: '💡' },
  { id: uuid(), name: 'Internet',        amount: 70,   dueDayOfMonth: 5,  emoji: '🌐' },
  { id: uuid(), name: 'Phone',           amount: 60,   dueDayOfMonth: 22, emoji: '📱' },
];

const expenseSchema = z.object({
  id:             z.string(),
  emoji:          z.string().nullable().default(null),
  name:           z.string().min(1, 'Required'),
  amount:         z.coerce.number().min(0, 'Must be 0 or more'),
  dueDayOfMonth:  z.coerce.number().int().min(1, 'Min 1').max(31, 'Max 31'),
});

const schema = z.object({
  expenses: z.array(expenseSchema),
});

type FormInput  = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

interface Props {
  draft: Partial<BudgetState>;
  onNext: (slice: Partial<BudgetState>) => void;
  onBack: () => void;
}

export function StepFixedExpenses({ draft, onNext, onBack }: Props) {
  const existing = draft.fixedExpenses ?? [];

  const { register, control, handleSubmit, formState: { errors } } =
    useForm<FormInput, unknown, FormOutput>({
      resolver: zodResolver(schema),
      defaultValues: {
        expenses: existing.length
          ? existing
          : DEFAULT_FIXED.map((e, i) => ({ ...e, sortOrder: i })),
      },
    });

  const { fields, append, remove } = useFieldArray({ control, name: 'expenses' });

  function onSubmit(values: FormOutput) {
    const fixedExpenses: FixedExpense[] = values.expenses.map((e, i) => ({
      id: e.id,
      name: e.name,
      amount: e.amount,
      dueDayOfMonth: e.dueDayOfMonth,
      emoji: e.emoji ?? null,
      sortOrder: i,
    }));
    onNext({ fixedExpenses });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-100">Fixed expenses</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Regular bills you pay every month — rent, utilities, subscriptions.
          You can skip this and add them later in Settings.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {fields.length > 0 && (
          <div className="hidden md:grid md:grid-cols-[40px_1fr_110px_80px_32px] gap-3 text-xs font-medium text-zinc-400 uppercase tracking-wide">
            <span>Icon</span>
            <span>Name</span>
            <span>Amount</span>
            <span>Due day</span>
            <span />
          </div>
        )}

        {fields.map((field, i) => {
          const rowErrors = errors.expenses?.[i];
          return (
            <div
              key={field.id}
              className="flex flex-col md:grid md:grid-cols-[40px_1fr_110px_80px_32px] gap-3 items-start md:items-center p-3 md:p-0 rounded-lg md:rounded-none border md:border-0 border-zinc-600/50"
            >
              {/* Emoji */}
              <div>
                <Label className="md:hidden mb-1">Icon</Label>
                <input
                  type="text"
                  maxLength={8}
                  placeholder="🏷"
                  className="w-10 text-center bg-zinc-700 border border-zinc-600 rounded-lg px-1 py-2 text-base focus:outline-none focus:border-zinc-400"
                  {...register(`expenses.${i}.emoji`)}
                />
              </div>

              {/* Name */}
              <div>
                <Label className="md:hidden mb-1">Name</Label>
                <Input
                  placeholder="e.g. Rent"
                  error={rowErrors?.name?.message}
                  {...register(`expenses.${i}.name`)}
                />
                <FieldError message={rowErrors?.name?.message} />
              </div>

              {/* Amount */}
              <div>
                <Label className="md:hidden mb-1">Amount ($)</Label>
                <div className="flex items-center gap-1">
                  <span className="text-zinc-500 text-sm">$</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    error={rowErrors?.amount?.message}
                    {...register(`expenses.${i}.amount`)}
                  />
                </div>
                <FieldError message={rowErrors?.amount?.message} />
              </div>

              {/* Due day */}
              <div>
                <Label className="md:hidden mb-1">Due day</Label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  placeholder="1"
                  error={rowErrors?.dueDayOfMonth?.message}
                  {...register(`expenses.${i}.dueDayOfMonth`)}
                />
                <FieldError message={rowErrors?.dueDayOfMonth?.message} />
              </div>

              <button
                type="button"
                onClick={() => remove(i)}
                className="text-zinc-400 hover:text-red-400 transition-colors text-lg leading-none self-center"
                aria-label="Remove"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => append({ id: uuid(), emoji: null, name: '', amount: 0, dueDayOfMonth: 1 })}
        className="text-sm text-zinc-500 hover:text-zinc-100 transition-colors self-start"
      >
        + Add expense
      </button>

      <div className="flex justify-between pt-2">
        <Button type="button" variant="secondary" onClick={onBack}>Back</Button>
        <Button type="submit">Next</Button>
      </div>
    </form>
  );
}
