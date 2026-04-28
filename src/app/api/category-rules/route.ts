import db from '@/lib/db';
import { v4 as uuid } from 'uuid';
import type { CategoryRule } from '@/lib/types';

type RuleRow = { id: string; pattern: string; category_id: string; priority: number; created_at: string };

function rowToRule(r: RuleRow): CategoryRule {
  return { id: r.id, pattern: r.pattern, categoryId: r.category_id, priority: r.priority, createdAt: r.created_at };
}

export async function GET() {
  const rows = db.prepare('SELECT * FROM category_rules ORDER BY priority ASC').all() as RuleRow[];
  return Response.json({ rules: rows.map(rowToRule) });
}

export async function POST(request: Request) {
  const { pattern, categoryId, priority } = (await request.json()) as Partial<CategoryRule>;
  if (!pattern || !categoryId) return Response.json({ error: 'pattern and categoryId required' }, { status: 400 });

  const maxRow = db.prepare('SELECT MAX(priority) as m FROM category_rules').get() as { m: number | null };
  const p = priority ?? (maxRow.m != null ? maxRow.m + 10 : 10);

  const id = uuid();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO category_rules (id, pattern, category_id, priority, created_at) VALUES (?,?,?,?,?)')
    .run(id, pattern, categoryId, p, now);

  return Response.json({ rule: { id, pattern, categoryId: categoryId, priority: p, createdAt: now } });
}
