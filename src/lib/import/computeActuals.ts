import db from '@/lib/db';
import type { Actuals } from '@/lib/storage/adapter';

type TxRow = { month_key: string; category_id: string; total: number };

export function computeActuals(): void {
  const rows = db.prepare(`
    SELECT month_key, category_id, SUM(amount) AS total
    FROM transactions
    WHERE status = 'active' AND category_id IS NOT NULL
    GROUP BY month_key, category_id
  `).all() as TxRow[];

  // Uncategorized active transactions — surface as '__uncategorized__'
  type UncatRow = { month_key: string; total: number };
  const uncatRows = db.prepare(`
    SELECT month_key, SUM(amount) AS total
    FROM transactions
    WHERE status = 'active' AND category_id IS NULL
    GROUP BY month_key
  `).all() as UncatRow[];

  const actuals: Actuals = {};
  for (const row of rows) {
    actuals[row.month_key] ??= {};
    actuals[row.month_key][row.category_id] = row.total;
  }
  for (const row of uncatRows) {
    actuals[row.month_key] ??= {};
    actuals[row.month_key]['__uncategorized__'] = row.total;
  }

  const upsert = db.prepare(`
    INSERT INTO actuals (month_key, data) VALUES (?, ?)
    ON CONFLICT(month_key) DO UPDATE SET data = excluded.data
  `);
  const recompute = db.transaction(() => {
    db.prepare('DELETE FROM actuals').run();
    for (const [key, val] of Object.entries(actuals)) {
      upsert.run(key, JSON.stringify(val));
    }
  });
  recompute();
}
