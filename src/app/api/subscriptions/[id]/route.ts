import db from '@/lib/db';

export async function PATCH(request: Request, ctx: RouteContext<'/api/subscriptions/[id]'>) {
  const { id } = await ctx.params;
  const { markedForCancel } = (await request.json()) as { markedForCancel: boolean };
  db.prepare('UPDATE subscriptions SET marked_for_cancel = ? WHERE id = ?')
    .run(markedForCancel ? 1 : 0, id);
  return Response.json({ ok: true });
}
