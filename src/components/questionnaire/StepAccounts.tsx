'use client';

import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import type { BudgetState } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { FieldError } from '@/components/ui/FieldError';
import { Select } from '@/components/ui/Select';

const accountSchema = z.object({
  id: z.string(),
  label: z.string().min(1, 'Required'),
  kind: z.enum(['chequing', 'credit-card']),
  isPassThrough: z.boolean(),
});

const schema = z.object({ accounts: z.array(accountSchema) });
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

interface Props {
  draft: Partial<BudgetState>;
  onNext: (slice: Partial<BudgetState>) => void;
  onBack: () => void;
}

export function StepAccounts({ draft, onNext, onBack }: Props) {
  const existing = draft.accounts ?? [];

  const { register, control, handleSubmit, formState: { errors } } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { accounts: existing.length ? existing : [] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'accounts' });

  function onSubmit(values: FormOutput) {
    onNext({ accounts: values.accounts });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-100">Bank accounts</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Add each account you want to track. Mark pass-through accounts (e.g. an account
          you only use to receive transfers or pay off credit cards) — their transactions
          will be auto-ignored during import.
        </p>
      </div>

      {fields.length === 0 && (
        <p className="text-sm text-zinc-500 italic">No accounts added yet. You can skip this step and add accounts later in Settings.</p>
      )}

      <div className="flex flex-col gap-4">
        {fields.length > 0 && (
          <div className="hidden md:grid grid-cols-[1fr_130px_auto_32px] gap-3 text-xs font-medium text-zinc-400 uppercase tracking-wide">
            <span>Label</span>
            <span>Type</span>
            <span>Pass-through?</span>
            <span />
          </div>
        )}

        {fields.map((field, i) => {
          const rowErrors = errors.accounts?.[i];
          return (
            <div
              key={field.id}
              className="flex flex-col md:grid md:grid-cols-[1fr_130px_auto_32px] gap-3 items-start md:items-center p-3 md:p-0 rounded-lg md:rounded-none border md:border-0 border-zinc-600/50"
            >
              <div>
                <Label className="md:hidden mb-1">Label</Label>
                <Input
                  placeholder="e.g. Main chequing, Travel Visa"
                  error={rowErrors?.label?.message}
                  {...register(`accounts.${i}.label`)}
                />
                <FieldError message={rowErrors?.label?.message} />
              </div>

              <div>
                <Label className="md:hidden mb-1">Type</Label>
                <Select {...register(`accounts.${i}.kind`)}>
                  <option value="chequing">Chequing</option>
                  <option value="credit-card">Credit card</option>
                </Select>
              </div>

              <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  className="rounded accent-zinc-400"
                  {...register(`accounts.${i}.isPassThrough`)}
                />
                <span className="text-sm text-zinc-400">Pass-through</span>
              </label>

              <button
                type="button"
                onClick={() => remove(i)}
                className="text-zinc-400 hover:text-red-400 transition-colors text-lg leading-none self-center"
                aria-label="Remove account"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => append({ id: uuid(), label: '', kind: 'chequing', isPassThrough: false })}
        className="text-sm text-zinc-500 hover:text-zinc-100 transition-colors self-start"
      >
        + Add account
      </button>

      <div className="flex justify-between pt-2">
        <Button type="button" variant="secondary" onClick={onBack}>Back</Button>
        <Button type="submit">Next</Button>
      </div>
    </form>
  );
}
