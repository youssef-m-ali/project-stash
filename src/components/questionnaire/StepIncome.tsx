'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, nextFriday, getDay } from 'date-fns';
import type { BudgetState } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { FieldError } from '@/components/ui/FieldError';

const schema = z.object({
  netPerPaycheck: z.coerce.number().positive('Must be greater than 0'),
  firstPaycheckDate: z.string().min(1, 'Required'),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

interface Props {
  draft: Partial<BudgetState>;
  onNext: (slice: Partial<BudgetState>) => void;
  onBack: () => void;
}

export function StepIncome({ draft, onNext }: Props) {
  const defaultDate = draft.income?.firstPaycheckDate ?? format(nextFriday(new Date()), 'yyyy-MM-dd');

  const { register, handleSubmit, formState: { errors } } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      netPerPaycheck: draft.income?.netPerPaycheck ?? ('' as unknown as number),
      firstPaycheckDate: defaultDate,
    },
  });

  function onSubmit(values: FormOutput) {
    const d = new Date(values.firstPaycheckDate + 'T12:00:00');
    onNext({
      income: {
        netPerPaycheck: values.netPerPaycheck,
        frequency: 'biweekly',
        firstPaycheckDate: values.firstPaycheckDate,
        payDayOfWeek: getDay(d) as 0 | 1 | 2 | 3 | 4 | 5 | 6,
      },
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-100">Income</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Enter your take-home pay — what actually hits your bank account after taxes.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="netPerPaycheck" required>Net per paycheck ($)</Label>
          <Input
            id="netPerPaycheck"
            type="number"
            min="0"
            step="0.01"
            placeholder="e.g. 2200"
            error={errors.netPerPaycheck?.message}
            {...register('netPerPaycheck')}
          />
          <FieldError message={errors.netPerPaycheck?.message} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="firstPaycheckDate" required>First paycheck date</Label>
          <Input
            id="firstPaycheckDate"
            type="date"
            error={errors.firstPaycheckDate?.message}
            {...register('firstPaycheckDate')}
          />
          <FieldError message={errors.firstPaycheckDate?.message} />
          <p className="text-xs text-zinc-400">The app will generate biweekly dates from this date forward.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Pay frequency</Label>
          <div className="flex items-center gap-2 rounded-lg border border-zinc-600 px-3 py-2 bg-zinc-800">
            <input type="radio" checked readOnly disabled className="accent-zinc-600" />
            <span className="text-sm text-zinc-500">Biweekly (every 2 weeks)</span>
            <span className="ml-auto text-xs text-zinc-400">More options coming soon</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit">Next</Button>
      </div>
    </form>
  );
}
