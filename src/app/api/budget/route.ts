import db from '@/lib/db';
import type { BudgetState } from '@/lib/types';

export async function GET() {
  const row = db.prepare('SELECT data FROM budget_state WHERE id = 1').get() as { data: string } | undefined;
  if (!row) return Response.json(null);
  return Response.json(JSON.parse(row.data) as BudgetState);
}

export async function POST(request: Request) {
  const state = (await request.json()) as BudgetState;
  db.prepare(`
    INSERT INTO budget_state (id, data, saved) VALUES (1, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET data = excluded.data, saved = excluded.saved
  `).run(JSON.stringify(state));
  return Response.json({ ok: true });
}

export async function DELETE() {
  db.prepare('DELETE FROM budget_state').run();
  db.prepare('DELETE FROM actuals').run();
  return Response.json({ ok: true });
}
