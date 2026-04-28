import db from '@/lib/db';
import type { Actuals } from '@/lib/storage/adapter';

type ActualsRow = { month_key: string; data: string };

export async function GET() {
  const rows = db.prepare('SELECT month_key, data FROM actuals').all() as ActualsRow[];
  const actuals: Actuals = {};
  for (const row of rows) actuals[row.month_key] = JSON.parse(row.data);
  return Response.json(actuals);
}

export async function POST(request: Request) {
  const actuals = (await request.json()) as Actuals;
  const upsert = db.prepare(`
    INSERT INTO actuals (month_key, data) VALUES (?, ?)
    ON CONFLICT(month_key) DO UPDATE SET data = excluded.data
  `);
  const replaceAll = db.transaction((data: Actuals) => {
    db.prepare('DELETE FROM actuals').run();
    for (const [key, val] of Object.entries(data)) {
      upsert.run(key, JSON.stringify(val));
    }
  });
  replaceAll(actuals);
  return Response.json({ ok: true });
}
