import db from '@/lib/db';
import type { CategoryRule } from '@/lib/types';

type RuleRow = { id: string; pattern: string; category_id: string; priority: number; created_at: string };

export async function PUT(request: Request, ctx: RouteContext<'/api/category-rules/[id]'>) {
  const { id } = await ctx.params;
  const body = (await request.json()) as Partial<CategoryRule>;

  const updates: string[] = [];
  const values: (string | number)[] = [];
  if (body.pattern)    { updates.push('pattern = ?');     values.push(body.pattern); }
  if (body.categoryId) { updates.push('category_id = ?'); values.push(body.categoryId); }
  if (body.priority != null) { updates.push('priority = ?'); values.push(body.priority); }

  if (updates.length > 0) {
    db.prepare(`UPDATE category_rules SET ${updates.join(', ')} WHERE id = ?`).run(...values, id);
  }

  const row = db.prepare('SELECT * FROM category_rules WHERE id = ?').get(id) as RuleRow | undefined;
  if (!row) return Response.json({ error: 'not found' }, { status: 404 });

  return Response.json({ rule: { id: row.id, pattern: row.pattern, categoryId: row.category_id, priority: row.priority, createdAt: row.created_at } });
}

export async function DELETE(_req: Request, ctx: RouteContext<'/api/category-rules/[id]'>) {
  const { id } = await ctx.params;
  db.prepare('DELETE FROM category_rules WHERE id = ?').run(id);
  return Response.json({ ok: true });
}
