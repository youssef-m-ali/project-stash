import db from '@/lib/db';
import { computeActuals } from '@/lib/import/computeActuals';

interface PatchBody {
  categoryId?: string | null;
  status?: 'active' | 'ignored';
}

export async function PATCH(request: Request, ctx: RouteContext<'/api/transactions/[id]'>) {
  const { id } = await ctx.params;
  const body = (await request.json()) as PatchBody;

  const updates: string[] = [];
  const values: (string | null)[] = [];

  if ('categoryId' in body) {
    updates.push('category_id = ?');
    values.push(body.categoryId ?? null);
  }
  if ('status' in body) {
    updates.push('status = ?');
    values.push(body.status ?? 'active');
  }

  if (updates.length === 0) return Response.json({ ok: true });

  db.prepare(`UPDATE transactions SET ${updates.join(', ')} WHERE id = ?`).run(...values, id);
  computeActuals();

  return Response.json({ ok: true });
}
