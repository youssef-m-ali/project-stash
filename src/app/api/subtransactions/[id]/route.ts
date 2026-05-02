import db from '@/lib/db';

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const result = db.prepare('DELETE FROM subtransactions WHERE id = ?').run(id);
  if (result.changes === 0) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json({ ok: true });
}
