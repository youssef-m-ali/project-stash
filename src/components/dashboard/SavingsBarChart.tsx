'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import type { MonthlySummary } from '@/lib/types';

interface Props {
  summaries: MonthlySummary[];
  currency: string;
}

export function SavingsBarChart({ summaries, currency }: Props) {
  const data = summaries.map((s) => ({
    month: format(parseISO(s.monthKey + '-01'), 'MMM'),
    savings: Math.max(0, Math.round(s.budgetedSavings)),
    isExtra: s.paycheckCount === 3,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} barSize={32} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fill: '#a1a1aa', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#a1a1aa', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${currency}${(v / 1000).toFixed(0)}k`}
          width={40}
        />
        <Tooltip
          cursor={{ fill: '#52525b33' }}
          contentStyle={{ background: '#3f3f46', border: '1px solid #52525b', borderRadius: 8, color: '#f4f4f5' }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any) => [`${currency}${(value as number).toLocaleString()}`, 'Savings']}
        />
        <Bar dataKey="savings" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.isExtra ? '#34d399' : '#a1a1aa'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
