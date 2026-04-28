'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface Props {
  fixed: number;
  variable: number;
  savings: number;
  currency: string;
}

const COLORS = ['#a1a1aa', '#71717a', '#34d399'];

export function SpendingPieChart({ fixed, variable, savings, currency }: Props) {
  const data = [
    { name: 'Fixed', value: Math.round(fixed) },
    { name: 'Variable', value: Math.round(variable) },
    { name: 'Savings', value: Math.round(Math.max(0, savings)) },
  ].filter((d) => d.value > 0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function fmtTooltip(value: any) {
    const n = typeof value === 'number' ? value : 0;
    return [`${currency}${n.toLocaleString()}`, ''];
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={70}
          outerRadius={110}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={fmtTooltip}
          contentStyle={{ background: '#3f3f46', border: '1px solid #52525b', borderRadius: 8, color: '#f4f4f5' }}
          itemStyle={{ color: '#f4f4f5' }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value) => <span style={{ color: '#a1a1aa', fontSize: 12 }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
