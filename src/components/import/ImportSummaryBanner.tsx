import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

interface Props {
  inserted: number;
  skipped: number;
  months: string[];
  onImportMore: () => void;
}

export function ImportSummaryBanner({ inserted, skipped, months, onImportMore }: Props) {
  return (
    <div className="bg-emerald-900/25 border border-emerald-700 rounded-xl p-6 flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-emerald-400">Import complete</h2>
        <p className="text-sm text-zinc-300 mt-1">
          <span className="font-semibold text-zinc-100">{inserted}</span> transaction{inserted !== 1 ? 's' : ''} imported
          {skipped > 0 && <>, <span className="font-semibold text-zinc-400">{skipped}</span> already existed and were skipped</>}.
        </p>
        {months.length > 0 && (
          <p className="text-sm text-zinc-400 mt-1">
            Actuals updated for: {months.join(', ')}
          </p>
        )}
      </div>
      <div className="flex gap-3">
        <Link to="/review">
          <Button>Review transactions</Button>
        </Link>
        <Button variant="secondary" onClick={onImportMore}>Import more</Button>
      </div>
    </div>
  );
}
