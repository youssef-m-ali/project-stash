interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: 'green' | 'red' | 'neutral';
}

export function StatCard({ label, value, sub, accent = 'neutral' }: StatCardProps) {
  const accentClass =
    accent === 'green' ? 'text-emerald-400' :
    accent === 'red'   ? 'text-red-400' :
                         'text-zinc-100';
  return (
    <div className="bg-zinc-700 rounded-xl border border-zinc-600 p-5 flex flex-col gap-1">
      <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide">{label}</span>
      <span className={`text-3xl font-bold tabular-nums ${accentClass}`}>{value}</span>
      {sub && <span className="text-sm text-zinc-500">{sub}</span>}
    </div>
  );
}
